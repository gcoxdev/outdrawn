import { omitKey } from "./record";
import { getRicochetTargets } from "./rules";
import { accumulateDamageDealt, recordEffects, recordHealthChanges } from "./effects";
import { acceptsDecisionAction, getPlayerDecision } from "./decisions";
import { allCards, type CardType } from "../data/cards";
import { blackMarketPresets } from "../data/constants";
import { drawCardsWithRefill, shuffleWithState } from "./deck";
import { finalizeEliminations } from "./elimination";
import { normalizeSettings } from "./settings";
import type { CardInstance, DrawContinuation, PlayerId, SecondaryDamageItem, SecondaryDamageSource } from "./types";
import type { GameAction } from "./actions";
import { createNewGame, createSetupState } from "./setup";
import type { GameState, PlayerState } from "./types";
import { createPendingReaction, getBaseAttackDamage, getGrenadeSplashTargets, resolveAttack, resolveHealing, resolveSecondaryDamage } from "./combat";
import { DEBUG_SNAPSHOT_LOG_LIMIT, getHandSnapshots, shouldCaptureHandSnapshots } from "./logSnapshots";
import {
  canPlayerAct,
  canPlayerEndTurn,
  hasPendingDecision,
  canPlayerDraw,
  areTeammates,
  getCardDefinitionById,
  getCurrentPlayer,
  getPlayer,
  getWinner,
  getWinningTeamId,
  isHostileTarget,
  labelTeam
} from "./rules";

function log(state: GameState, message: string): GameState {
  const debugHandSnapshots = shouldCaptureHandSnapshots(state.settings.debugHandSnapshots)
    ? getHandSnapshots(state.players)
    : [];
  const handSnapshots = state.settings.debugHandSnapshots ? debugHandSnapshots : [];
  return {
    ...state,
    log: [
      ...state.log.slice(-999).map((entry, index, entries) =>
        index <= entries.length - DEBUG_SNAPSHOT_LOG_LIMIT && entry.debugHandSnapshots.length
          ? { ...entry, debugHandSnapshots: [], handSnapshots: [] }
          : entry
      ),
      {
        id: `log_${(Number(state.log.at(-1)?.id.split("_")[1]) || 0) + 1}`,
        round: state.round,
        message,
        debugHandSnapshots,
        handSnapshots
      }
    ]
  };
}

function setLogSnapshotVisibility(state: GameState, visible: boolean): GameState {
  return {
    ...state,
    log: state.log.map((entry) => ({
      ...entry,
      debugHandSnapshots: visible ? entry.debugHandSnapshots : [],
      handSnapshots: visible ? entry.debugHandSnapshots : []
    }))
  };
}

function updatePlayer(state: GameState, playerId: string, updater: (player: PlayerState) => PlayerState): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? updater(player) : player))
  };
}

function spendAction(state: GameState, playerId: string): GameState {
  return updatePlayer(state, playerId, (player) => ({
    ...player,
    actionsRemaining: Math.max(0, player.actionsRemaining - 1),
    actedThisRound: true
  }));
}

function spendDraw(state: GameState, playerId: string): GameState {
  const player = getPlayer(state, playerId);
  if (player && player.freeDrawsRemaining > 0) {
    return updatePlayer(state, playerId, (currentPlayer) => ({
      ...currentPlayer,
      freeDrawsRemaining: Math.max(0, currentPlayer.freeDrawsRemaining - 1),
      actedThisRound: true
    }));
  }

  return spendAction(state, playerId);
}

function advanceTurn(state: GameState): GameState {
  const livingPlayers = state.players.filter((player) => !player.eliminated);
  if (livingPlayers.length <= 1 || getWinningTeamId(state)) {
    return completeGame(state, getWinner(state), getWinningTeamId(state));
  }

  // Losing the round starter can move the first living seat to the very next
  // player. That does not finish the round while survivors still await a turn.
  const nextRound = state.players.every((player) => player.eliminated || player.actedThisRound);
  const roundRobinFirstPlayerIndex =
    state.settings.turnOrder === "roundRobin" && state.players[state.firstPlayerIndex].eliminated
      ? findNextLivingIndex(state.players, state.firstPlayerIndex)
      : state.firstPlayerIndex;
  const collapseState = nextRound ? logPlayerHealthChanges(state.players, finalizeEliminations(applyCollapseDamage(state)), "collapse") : state;
  const collapseGameOver = nextRound ? completeGameIfOver(collapseState, state.players) : null;
  if (collapseGameOver) {
    return collapseGameOver;
  }

  const transitionState = nextRound ? collapseState : state;

  const firstPlayerIndex =
    state.settings.turnOrder === "roundRobin"
      ? transitionState.players[roundRobinFirstPlayerIndex].eliminated
        ? findNextLivingIndex(transitionState.players, roundRobinFirstPlayerIndex)
        : roundRobinFirstPlayerIndex
      : nextRound
        ? findNextLivingIndex(transitionState.players, transitionState.firstPlayerIndex)
        : transitionState.firstPlayerIndex;
  const currentPlayerIndex = nextRound ? firstPlayerIndex : findNextLivingIndex(transitionState.players, transitionState.currentPlayerIndex);

  const players = transitionState.players.map((player, index) => {
    const resetForRound = nextRound
      ? {
          actedThisRound: false,
          attackedThisRound: false
        }
      : {};

    return {
      ...player,
      ...resetForRound,
      actionsRemaining: index === currentPlayerIndex ? transitionState.settings.actionsPerTurn : player.actionsRemaining,
      freeDrawsRemaining: index === currentPlayerIndex ? transitionState.settings.freeDrawsPerTurn : player.freeDrawsRemaining
    };
  });

  const advanced = {
    ...transitionState,
    round: nextRound ? transitionState.round + 1 : transitionState.round,
    players,
    firstPlayerIndex,
    currentPlayerIndex,
    markedTargets: nextRound ? {} : transitionState.markedTargets
  };
  advanced.smokeProtectedPlayerIds = advanced.smokeProtectedPlayerIds.filter(
    (playerId) => playerId !== advanced.players[currentPlayerIndex].id
  );
  advanced.intimidations = clearIntimidationsAgainst(advanced.intimidations, advanced.players[currentPlayerIndex].id);

  return log(
    advanced,
    nextRound
      ? `Round ${advanced.round} begins. ${advanced.players[currentPlayerIndex].name} is up.`
      : `${advanced.players[currentPlayerIndex].name} is up.`
  );
}

function completeGameIfOver(state: GameState, beforePlayers: PlayerState[], breakTie = true): GameState | null {
  const winnerTeamId = getWinningTeamId(state);
  if (state.players.filter((player) => !player.eliminated).length > 1 && !winnerTeamId) {
    return null;
  }

  const survivor = getWinner(state);
  const tiebreak = !survivor && breakTie ? breakEliminationTie(beforePlayers.filter(player => !player.eliminated)) : null;
  const winner = survivor ?? tiebreak?.winner ?? null;
  if (state.players.every(player => player.eliminated)) {
    state = { ...state, outcome: { kind: winner ? "tiebreak" : "tie", description: winner
      ? `Everyone fell in the final effect. ${tiebreak!.description}`
      : breakTie ? "Everyone fell in the final effect. The leading players were tied on eliminations, pre-effect health, and pre-effect hand size."
      : "The final combat sequence left nobody alive. No winner is declared." } };
  }
  return completeGame(state, winner, winnerTeamId ?? winner?.teamId ?? null);
}

function completeGame(state: GameState, winner: PlayerState | null, winnerTeamId = getWinningTeamId(state)): GameState {
  const teamWinner = winnerTeamId ? state.players.find((player) => player.teamId === winnerTeamId && !player.eliminated) : null;
  const gameOverState = {
    ...state,
    phase: "gameOver" as const,
    pendingEventDialog: null,
    eventDialogQueue: [],
    drawContinuations: [],
    discardPile: [...state.discardPile, ...(state.drawContinuations ?? []).flatMap(job => [...job.cards, ...(job.playedCard ? [job.playedCard] : [])])],
    pendingReaction: null,
    pendingRedirect: null,
    pendingAttackCost: null,
    pendingMultiHitAttack: null,
    pendingDiscard: null,
    pendingSearch: null,
    pendingMarketSearch: null,
    pendingBlackMarket: null,
    pendingSteal: null,
    pendingSecondaryDamage: null,
    selectedCardId: null,
    winnerId: winner?.id ?? teamWinner?.id ?? null,
    winnerTeamId
  };

  return log(
    gameOverState,
    winnerTeamId
      ? `${labelTeam(winnerTeamId)} is the last team standing.`
      : winner
        ? `${winner.name} wins.`
        : "No winner remains."
  );
}

function logPlayerHealthChanges(beforePlayers: PlayerState[], afterState: GameState, source: string, cardDefinitionId?: string): GameState {
  afterState = recordHealthChanges(beforePlayers, afterState, source === "collapse" ? "collapse" : "event", cardDefinitionId);
  return afterState.players.reduce((nextState, player) => {
    const before = beforePlayers.find((candidate) => candidate.id === player.id);
    if (!before) {
      return nextState;
    }

    const damage = before.health - player.health;
    let updated = nextState;
    if (damage > 0) {
      updated = log(updated, `${player.name} took ${damage} ${source} damage.`);
    }

    if (!before.eliminated && player.eliminated) {
      updated = log(updated, `${player.name} was eliminated by ${source}.`);
    }

    return updated;
  }, afterState);
}

function applyImmediateEvent(state: GameState, eventId: string, sourcePlayerId?: PlayerId, eventCard?: CardInstance): GameState {
  if (eventId === "event_pressure_zone") {
    return {
      ...state,
      players: state.players.map((player) => {
        if (player.eliminated) {
          return player;
        }
        const health = Math.max(0, player.health - 1);
        return { ...player, health, eliminated: health === 0 };
      })
    };
  }

  if (eventId === "event_supply_drop") {
    const player = sourcePlayerId ? getPlayer(state, sourcePlayerId) : undefined;
    if (!player) {
      return state;
    }

    return queueDraws(state, [{ playerId: player.id, remaining: 3, cards: [], destination: "hand", replaceEvents: true }]);
  }

  if (eventId === "event_bounty") {
    const living = state.players.filter((player) => !player.eliminated);
    const highestHealth = Math.max(...living.map((player) => player.health));
    return {
      ...state,
      players: state.players.map((player) => {
        if (player.eliminated || player.health !== highestHealth) {
          return player;
        }
        const health = Math.max(0, player.health - 2);
        return { ...player, health, eliminated: health === 0 };
      })
    };
  }

  if (eventId === "event_high_ground") {
    return queueDraws(state, state.players.filter(player => !player.eliminated).map(player => ({
      playerId: player.id, remaining: 1, cards: [], destination: "hand", replaceEvents: true
    })));
  }

  if (eventId === "event_low_ammo") {
    const playersNeedingChoice: PlayerId[] = [];
    const players = state.players.map((player) => {
      if (player.eliminated) {
        return player;
      }

      const weapons = player.hand.filter((card) => getCardDefinitionById(card.definitionId)?.type === "weapon");
      if (weapons.length > 0) {
        playersNeedingChoice.push(player.id);
        return player;
      }

      const health = Math.max(0, player.health - 3);
      return {
        ...player,
        health,
        eliminated: health === 0
      };
    });

    return scheduleForcedDiscard({
      ...state,
      players
    }, playersNeedingChoice, "weapon", "Low Ammo");
  }

  if (eventId === "event_critical_condition") {
    return {
      ...state,
      players: state.players.map((player) => {
        if (player.eliminated || player.health > 10) {
          return player;
        }

        const damage = player.health < 5 ? 2 : 1;
        const health = Math.max(0, player.health - damage);
        return {
          ...player,
          health,
          eliminated: health === 0
        };
      })
    };
  }

  if (eventId === "event_no_cover") {
    const playersNeedingChoice: PlayerId[] = [];
    const players = state.players.map((player) => {
      if (player.eliminated) {
        return player;
      }

      const defenses = player.hand.filter((card) => getCardDefinitionById(card.definitionId)?.type === "defense");
      if (defenses.length > 0) {
        playersNeedingChoice.push(player.id);
        return player;
      }

      const health = Math.max(0, player.health - 2);
      return { ...player, health, eliminated: health === 0 };
    });

    return scheduleForcedDiscard({
      ...state,
      players
    }, playersNeedingChoice, "defense", "No Cover");
  }

  if (eventId === "event_black_market") {
    if (!sourcePlayerId) {
      return state;
    }

    return {
      ...state,
      pendingBlackMarket: {
        card: eventCard ?? { instanceId: `active_${eventId}_${state.log.length}`, definitionId: eventId },
        playerId: sourcePlayerId
      }
    };
  }

  return state;
}

function queueDraws(state: GameState, jobs: DrawContinuation[]): GameState {
  return { ...state, drawContinuations: [...jobs, ...(state.drawContinuations ?? [])] };
}

function hasInteractiveEffect(state: GameState): boolean {
  return getPlayerDecision(state) !== null;
}

/** Draw jobs form a stack: nested events finish before the interrupted draw resumes. */
function resumeDraws(state: GameState): GameState {
  let next = state;
  while (next.phase === "action" && next.drawContinuations?.length && !hasInteractiveEffect(next)) {
    const [job, ...rest] = next.drawContinuations;
    const player = getPlayer(next, job.playerId);
    if (!player || player.eliminated || job.remaining === 0 || (!next.mainDeck.length && !next.discardPile.length)) {
      next = { ...next, drawContinuations: rest,
        discardPile: [...next.discardPile, ...(job.playedCard ? [job.playedCard] : [])] };
      if (!player || player.eliminated) {
        next = { ...next, discardPile: [...next.discardPile, ...job.cards] };
      } else if (job.destination === "search" && job.cards.length) {
        next = log({ ...next, pendingSearch: { playerId: job.playerId, cards: job.cards } }, `${player.name} searched and must keep 1 of ${job.cards.length} cards.`);
      } else {
        next = updatePlayer(next, job.playerId, current => ({ ...current, hand: [...current.hand, ...job.cards] }));
        if (job.destination === "search") next = log(next, `${player.name} searched but found no cards.`);
        if (job.spendDraw && job.cards.length) next = log(spendDraw(next, job.playerId), `${player.name} drew 1 card.`);
      }
      continue;
    }
    const draw = drawCardsWithRefill(next.mainDeck, next.discardPile, 1, next.deckRandomState);
    const card = draw.drawn[0];
    const isEvent = getCardDefinitionById(card.definitionId)?.type === "event";
    const updatedJob = { ...job,
      remaining: isEvent ? (job.replaceEvents ? job.remaining : 0) : job.remaining - 1,
      cards: isEvent ? job.cards : [...job.cards, card] };
    next = { ...next, mainDeck: draw.mainDeck, discardPile: draw.discardPile, deckRandomState: draw.deckRandomState, drawContinuations: [updatedJob, ...rest] };
    if (isEvent) next = resolveDrawnEvent(next, card, job.playerId);
  }
  return next;
}

function expireTurnEffects(state: GameState): GameState {
  const playerId = getCurrentPlayer(state).id;
  return { ...state, attackBonuses: omitKey(state.attackBonuses, playerId),
    reloadPlayerIds: state.reloadPlayerIds.filter(id => id !== playerId), selectedCardId: null };
}

function drawMarketCardsSkippingEvents(state: GameState, count: number) {
  const drawn: CardInstance[] = [];
  const eventCards: CardInstance[] = [];
  let nextState = state;

  while (drawn.length < count && (nextState.mainDeck.length > 0 || nextState.discardPile.length > 0)) {
    const draw = drawCardsWithRefill(nextState.mainDeck, nextState.discardPile, 1, nextState.deckRandomState);
    const card = draw.drawn[0];
    const definition = getCardDefinitionById(card?.definitionId ?? "");
    nextState = {
      ...nextState,
      mainDeck: draw.mainDeck,
      deckRandomState: draw.deckRandomState,
      discardPile: draw.discardPile
    };

    if (!card) {
      break;
    }

    if (definition?.type === "event") {
      eventCards.push(card);
      continue;
    }

    drawn.push(card);
  }

  return {
    state: {
      ...nextState,
      eventDiscardPile: [...nextState.eventDiscardPile, ...eventCards]
    },
    drawn
  };
}

function resolveDrawnEvent(state: GameState, eventCard: CardInstance, playerId: PlayerId): GameState {
  const definition = getCardDefinitionById(eventCard.definitionId);
  const player = getPlayer(state, playerId);

  if (!definition || definition.type !== "event" || !player) {
    return state;
  }

  if (definition.timing === "immediate") {
    const shouldShowEventDialog = state.players.some((candidate) => !candidate.eliminated && candidate.controller.type === "human");
    const eventState = {
      ...state,
      resolvedEventCount: (state.resolvedEventCount ?? 0) + 1,
      pendingEventDialog: state.pendingEventDialog ?? (shouldShowEventDialog ? { card: eventCard, playerId } : null),
      eventDialogQueue: shouldShowEventDialog && state.pendingEventDialog
        ? [...(state.eventDialogQueue ?? []), { card: eventCard, playerId }] : state.eventDialogQueue,
      eventDiscardPile:
        [...state.eventDiscardPile, eventCard]
    };
    const eventLoggedState = log(eventState, `${player.name} drew ${definition.name}.`);
    const applied = finalizeEliminations(applyImmediateEvent(eventLoggedState, definition.id, playerId, eventCard));
    const shouldLogDirectHealthChanges = eventDirectlyChangesHealth(definition.id);
    let resolved = shouldLogDirectHealthChanges ? logPlayerHealthChanges(state.players, applied, definition.name, definition.id) : applied;
    if (definition.id === "event_critical_condition") {
      resolved = log(resolved, getCriticalConditionSummary(state.players, resolved.players));
    }
    if (resolved.phase === "gameOver") {
      return resolved;
    }
    return completeGameIfOver(resolved, state.players) ?? resolved;
  }

  return log(
    {
      ...state,
      pendingEventDialog: {
        card: eventCard,
        playerId
      },
      eventDiscardPile: [...state.eventDiscardPile, eventCard]
    },
    `${player.name} drew ${definition.name}.`
  );
}

function eventDirectlyChangesHealth(eventId: string): boolean {
  return (
    eventId === "event_pressure_zone" ||
    eventId === "event_bounty" ||
    eventId === "event_low_ammo" ||
    eventId === "event_critical_condition" ||
    eventId === "event_no_cover"
  );
}

function applyCollapseDamage(state: GameState): GameState {
  const damage = state.round >= 8 ? 2 : state.round >= 3 ? 1 : 0;
  if (damage === 0) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) => {
      if (player.eliminated) {
        return player;
      }

      const health = Math.max(0, player.health - damage);
      return {
        ...player,
        health,
        eliminated: health === 0
      };
    })
  };
}

function findNextLivingIndex(players: PlayerState[], startIndex: number): number {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (startIndex + offset) % players.length;
    if (!players[index].eliminated) {
      return index;
    }
  }

  return startIndex;
}

function currentPlayerOverHandLimit(state: GameState): boolean {
  const player = getCurrentPlayer(state);
  return !player.eliminated && player.hand.length > state.settings.maxHandSize;
}

function getCriticalConditionSummary(beforePlayers: PlayerState[], afterPlayers: PlayerState[]): string {
  const affected = afterPlayers
    .map((after) => {
      const before = beforePlayers.find((player) => player.id === after.id);
      const damage = before ? before.health - after.health : 0;
      return damage > 0 ? `${after.name} for ${damage} damage` : null;
    })
    .filter((message): message is string => Boolean(message));

  if (affected.length === 0) {
    return "Critical Condition affected no one.";
  }

  return `Critical Condition affected ${formatList(affected)}.`;
}

function formatList(items: string[]): string {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function getBlackMarketConfig(state: GameState) {
  return state.settings.blackMarketPreset === "custom" ? state.settings.blackMarketCustom : blackMarketPresets[state.settings.blackMarketPreset];
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const input = { ...state, resolvedEffects: [] };
  let next = reduceGameAction(input, action);
  if (next === input) return state;
  if (next.phase === "setup") return next;
  next = finalizeEliminations(next);
  if (next.phase === "action") next = resumeMultiHit(resumeDraws(next));
  if (next.phase === "action" && !hasPendingDecision(next)) {
    next = completeGameIfOver(next, state.players, false) ?? next;
    if (next.phase === "action" && getCurrentPlayer(next).eliminated) next = advanceTurn(expireTurnEffects(next));
  }
  if (next.phase === "gameOver" && !next.outcome) {
    const winner = next.players.find(player => player.id === next.winnerId);
    const kind = !winner && !next.winnerTeamId ? "tie" : winner?.eliminated ? "tiebreak" : next.winnerTeamId ? "team" : "survivor";
    next = { ...next, outcome: { kind, description: kind === "tie" ? "The match ended with nobody alive and no winner declared." : kind === "tiebreak" ? "Everyone fell in the final effect. Most eliminations, then pre-effect health, then pre-effect hand size determined the winner." : kind === "team" ? "Only the winning team remains." : "The last survivor takes the match." } };
  }
  next = accumulateDamageDealt(next);
  const oldLogIds = new Set(state.log.map(entry => entry.id));
  const participantIds = new Set<string>();
  const addReferences = (value: object) => Object.entries(value).forEach(([key, id]) => {
    if (["playerId", "attackerId", "defenderId", "targetPlayerId", "sourcePlayerId"].includes(key) && typeof id === "string") participantIds.add(id);
  });
  addReferences(action);
  const decision = getPlayerDecision(state);
  if (decision) { participantIds.add(decision.playerId); addReferences(decision.pending); }
  next.players.forEach((player, index) => { if (player !== state.players[index] && (player.health !== state.players[index]?.health || player.hand.length !== state.players[index]?.hand.length || player.hand.some((card, cardIndex) => card.instanceId !== state.players[index]?.hand[cardIndex]?.instanceId))) participantIds.add(player.id); });
  if (next.currentPlayerIndex !== state.currentPlayerIndex || action.type === "END_TURN") participantIds.add(getCurrentPlayer(next).id);
  next = { ...next, log: next.log.map(entry => oldLogIds.has(entry.id) ? entry : { ...entry, participantIds: [...participantIds] }) };
  return next;
}

function reduceGameAction(state: GameState, action: GameAction): GameState {
  if (
    state.phase === "gameOver" &&
    action.type !== "RESET_GAME" &&
    action.type !== "RESTART_GAME" &&
    action.type !== "UPDATE_SETTINGS" &&
    action.type !== "ACKNOWLEDGE_EVENT_DIALOG"
  ) {
    return state;
  }

  if (!acceptsDecisionAction(state, action)) {
    return state;
  }

  switch (action.type) {
    case "START_GAME":
      return createNewGame(action.playerSetups ?? action.playerNames, Math.random, normalizeSettings(action.settings ?? state.settings));
    case "UPDATE_SETTINGS":
      return setLogSnapshotVisibility({ ...state, settings: normalizeSettings(action.settings) }, action.settings.debugHandSnapshots);
    case "SELECT_CARD":
      return { ...state, selectedCardId: action.cardInstanceId };
    case "ACKNOWLEDGE_EVENT_DIALOG":
      return { ...state, pendingEventDialog: state.eventDialogQueue?.[0] ?? null, eventDialogQueue: state.eventDialogQueue?.slice(1) ?? [] };
    case "DRAW_CARD": {
      if (!canPlayerDraw(state, action.playerId) || (state.mainDeck.length === 0 && state.discardPile.length === 0)) {
        return state;
      }

      return queueDraws(state, [{ playerId: action.playerId, remaining: 1, cards: [], destination: "hand", replaceEvents: false, spendDraw: true }]);
    }
    case "DISCARD_CARD": {
      const player = getPlayer(state, action.playerId);
      const card = player?.hand.find((handCard) => handCard.instanceId === action.cardInstanceId);

      if (
        !player ||
        !card ||
        !canPlayerEndTurn(state, action.playerId) ||
        player.eliminated ||
        state.pendingReaction ||
        state.pendingRedirect ||
        state.pendingAttackCost ||
        state.pendingMultiHitAttack ||
        state.pendingSecondaryDamage
      ) {
        return state;
      }

      const nextState = updatePlayer(state, action.playerId, (currentPlayer) => ({
        ...currentPlayer,
        hand: currentPlayer.hand.filter((handCard) => handCard.instanceId !== card.instanceId)
      }));

      return log(
        {
          ...nextState,
          discardPile: [...nextState.discardPile, card],
          selectedCardId: state.selectedCardId === card.instanceId ? null : state.selectedCardId
        },
        `${player.name} discarded ${getCardDefinitionById(card.definitionId)?.name ?? "a card"}.`
      );
    }
    case "DISCARD_CARDS": {
      const player = getPlayer(state, action.playerId);
      const selectedIds = Array.from(new Set(action.cardInstanceIds));
      const selected = player?.hand.filter((card) => selectedIds.includes(card.instanceId)) ?? [];

      if (
        !player ||
        !canPlayerEndTurn(state, action.playerId) ||
        player.eliminated ||
        selected.length !== selectedIds.length ||
        state.pendingReaction ||
        state.pendingRedirect ||
        state.pendingAttackCost ||
        state.pendingMultiHitAttack ||
        state.pendingSecondaryDamage
      ) {
        return state;
      }

      const nextState = {
        ...state,
        discardPile: [...state.discardPile, ...selected],
        selectedCardId: selected.some((card) => card.instanceId === state.selectedCardId) ? null : state.selectedCardId,
        players: state.players.map((candidate) =>
          candidate.id === player.id
            ? {
                ...candidate,
                hand: candidate.hand.filter((card) => !selectedIds.includes(card.instanceId))
              }
            : candidate
        )
      };

      return log(nextState, `${player.name} discarded ${selected.length} card${selected.length === 1 ? "" : "s"}.`);
    }
    case "TRANSFER_CARD": {
      if (!canPlayerAct(state, action.playerId)) {
        return state;
      }

      const player = getCurrentPlayer(state);
      const target = getPlayer(state, action.targetPlayerId);
      const card = player.hand.find((handCard) => handCard.instanceId === action.cardInstanceId);

      if (
        !target ||
        !card ||
        target.eliminated ||
        target.id === player.id ||
        !areTeammates(player, target) ||
        !state.settings.allowTeamCardTransfer
      ) {
        return state;
      }

      const transferredState = {
          ...state,
          selectedCardId: state.selectedCardId === card.instanceId ? null : state.selectedCardId,
          players: state.players.map((candidate) => {
            if (candidate.id === player.id) {
              return {
                ...candidate,
                hand: candidate.hand.filter((handCard) => handCard.instanceId !== card.instanceId),
                actionsRemaining: Math.max(0, candidate.actionsRemaining - 1),
                actedThisRound: true
              };
            }

            if (candidate.id === target.id) {
              return {
                ...candidate,
                hand: [...candidate.hand, card]
              };
            }

            return candidate;
          })
        };

      return log(transferredState, `${player.name} transferred a card to ${target.name}.`);
    }
    case "RESOLVE_PENDING_DISCARD": {
      const pendingDiscard = state.pendingDiscard;
      const player = pendingDiscard ? getPlayer(state, pendingDiscard.playerId) : undefined;

      if (!pendingDiscard || !player || action.playerId !== player.id) {
        return state;
      }

      const discardableCards = pendingDiscard.allowedCardInstanceIds
        ? player.hand.filter((card) => pendingDiscard.allowedCardInstanceIds!.includes(card.instanceId))
        : player.hand;
      const selectedIds = action.cardInstanceIds.slice(0, pendingDiscard.count);
      if (selectedIds.length < Math.min(pendingDiscard.count, discardableCards.length)) {
        return state;
      }

      const selected = discardableCards.filter((card) => selectedIds.includes(card.instanceId));
      if (selected.length !== selectedIds.length) {
        return state;
      }

      const nextState = {
        ...state,
        pendingDiscard: null,
        discardPile: [...state.discardPile, ...selected],
        selectedCardId: selected.some((card) => card.instanceId === state.selectedCardId) ? null : state.selectedCardId,
        players: state.players.map((candidate) =>
          candidate.id === player.id
            ? {
                ...candidate,
                hand: candidate.hand.filter((card) => !selectedIds.includes(card.instanceId))
              }
            : candidate
        )
      };

      const continuedState =
        pendingDiscard.continuation?.type === "forced_discard"
          ? scheduleForcedDiscard(
              nextState,
              pendingDiscard.continuation.remainingPlayerIds,
              pendingDiscard.continuation.cardType,
              pendingDiscard.continuation.reason
            )
          : nextState;

      return log(continuedState, `${player.name} discarded ${selected.length} cards for ${pendingDiscard.reason}.`);
    }
    case "RESOLVE_PENDING_SEARCH": {
      const pendingSearch = state.pendingSearch;
      const player = pendingSearch ? getPlayer(state, pendingSearch.playerId) : undefined;
      const kept = pendingSearch?.cards.find((card) => card.instanceId === action.keepCardInstanceId);

      if (!pendingSearch || !player || action.playerId !== player.id || !kept) {
        return state;
      }

      const discarded = pendingSearch.cards.filter((card) => card.instanceId !== kept.instanceId);
      const nextState = {
        ...state,
        pendingSearch: null,
        discardPile: [...state.discardPile, ...discarded],
        players: state.players.map((candidate) =>
          candidate.id === player.id
            ? {
                ...candidate,
                hand: [...candidate.hand, kept]
              }
            : candidate
        )
      };

      return log(nextState, `${player.name} kept 1 card from Search and discarded ${discarded.length}.`);
    }
    case "START_BLACK_MARKET": {
      const pendingBlackMarket = state.pendingBlackMarket;
      const expectedPlayerId = pendingBlackMarket?.playerId;
      if (!pendingBlackMarket || action.playerId !== expectedPlayerId || state.pendingMarketSearch) {
        return state;
      }

      const player = getPlayer(state, action.playerId);
      const marketConfig = getBlackMarketConfig(state);
      if (!player || player.eliminated) {
        return state;
      }

      const selectedIds = action.cardInstanceIds.slice(0, marketConfig.discardCost);
      const selected = player.hand.filter((card) => selectedIds.includes(card.instanceId));

      if (
        player.health <= marketConfig.healthCost ||
        selected.length !== marketConfig.discardCost ||
        new Set(selectedIds).size !== marketConfig.discardCost
      ) {
        return state;
      }

      const reveal = drawMarketCardsSkippingEvents(state, marketConfig.revealCount);
      const nextState = {
        ...reveal.state,
        discardPile: [...reveal.state.discardPile, ...selected],
        pendingMarketSearch: {
          playerId: player.id,
          cards: reveal.drawn,
          keepCount: Math.min(marketConfig.keepCount, reveal.drawn.length)
        },
        players: state.players.map((candidate) =>
          candidate.id === player.id
            ? {
                ...candidate,
                hand: candidate.hand.filter((card) => !selectedIds.includes(card.instanceId)),
                health: candidate.health - marketConfig.healthCost,
                actionsRemaining: candidate.actionsRemaining
              }
            : candidate
        )
      };

      return log(recordHealthChanges(state.players, nextState, "market", "event_black_market", player.id), `${player.name} used the Black Market and must choose ${marketConfig.keepCount} card${marketConfig.keepCount === 1 ? "" : "s"}.`);
    }
    case "RESOLVE_MARKET_SEARCH": {
      const pending = state.pendingMarketSearch;
      const player = pending ? getPlayer(state, pending.playerId) : undefined;
      const keepIds = action.keepCardInstanceIds.slice(0, pending?.keepCount ?? 0);
      const kept = pending?.cards.filter((card) => keepIds.includes(card.instanceId)) ?? [];

      if (!pending || !player || action.playerId !== player.id || kept.length !== pending.keepCount || new Set(keepIds).size !== pending.keepCount) {
        return state;
      }

      const unkept = pending.cards.filter((card) => !keepIds.includes(card.instanceId));
      const nextState = {
        ...state,
        pendingBlackMarket: null,
        pendingMarketSearch: null,
        discardPile: [...state.discardPile, ...unkept],
        players: state.players.map((candidate) =>
          candidate.id === player.id
            ? {
                ...candidate,
                hand: [...candidate.hand, ...kept]
              }
            : candidate
        )
      };

      return log(nextState, `${player.name} bought ${kept.length} Black Market card${kept.length === 1 ? "" : "s"} and discarded ${unkept.length}.`);
    }
    case "PASS_BLACK_MARKET": {
      const pendingBlackMarket = state.pendingBlackMarket;
      const expectedPlayerId = pendingBlackMarket?.playerId;
      const player = getPlayer(state, action.playerId);
      if (!pendingBlackMarket || action.playerId !== expectedPlayerId || !player) {
        return state;
      }

      return log({ ...state, pendingBlackMarket: null }, `${player.name} passed on the Black Market.`);
    }
    case "RESOLVE_PENDING_STEAL": {
      const pending = state.pendingSteal;
      const player = pending ? getPlayer(state, pending.playerId) : undefined;
      const target = pending ? getPlayer(state, pending.targetPlayerId) : undefined;
      const stolen = target?.hand.find((card) => card.instanceId === action.cardInstanceId);

      if (!pending || !player || !target || !stolen || !pending.cardInstanceIds.includes(action.cardInstanceId) || action.playerId !== player.id || action.targetPlayerId !== target.id) {
        return state;
      }

      const nextState = {
        ...state,
        pendingSteal: null,
        players: state.players.map((candidate) => {
          if (candidate.id === player.id) {
            return { ...candidate, hand: [...candidate.hand, stolen] };
          }

          if (candidate.id === target.id) {
            return { ...candidate, hand: candidate.hand.filter((card) => card.instanceId !== stolen.instanceId) };
          }

          return candidate;
        })
      };

      return log(nextState, `${player.name} stole 1 card from ${target.name}.`);
    }
    case "PLAY_HEALING": {
      if (!canPlayerAct(state, action.playerId)) {
        return state;
      }

      const player = getCurrentPlayer(state);
      const card = player.hand.find((handCard) => handCard.instanceId === action.cardInstanceId);
      const definition = card ? getCardDefinitionById(card.definitionId) : undefined;
      const target = action.targetPlayerId ? getPlayer(state, action.targetPlayerId) : player;

      if (
        !card ||
        !definition ||
        definition.type !== "healing" ||
        !target ||
        target.eliminated ||
        (target.id !== player.id && !areTeammates(player, target)) ||
        (target.id !== player.id && !state.settings.allowTeamHealing) ||
        player.actionsRemaining < (definition.actionsCost ?? 1)
      ) {
        return state;
      }

      if ((definition.heal ?? 0) > 0 && target.health >= state.settings.maxHealth && !definition.draw) {
        return state;
      }

      if ((definition.draw ?? 0) > 0) {
        const heal = definition.heal ?? 0;
        const actionsCost = definition.actionsCost ?? 1;
        const nextHealth = Math.min(state.settings.maxHealth, target.health + heal);
        const healedAmount = nextHealth - target.health;
        const stateBeforeDraw: GameState = {
          ...state,
          players: state.players.map((candidate) =>
            candidate.id === player.id
              ? {
                  ...candidate,
                  health: candidate.id === target.id ? nextHealth : candidate.health,
                  hand: candidate.hand.filter((handCard) => handCard.instanceId !== card.instanceId),
                  actionsRemaining: Math.max(0, candidate.actionsRemaining - actionsCost),
                  actedThisRound: true
                }
              : candidate.id === target.id
                ? {
                    ...candidate,
                    health: nextHealth
                  }
                : candidate
          )
        };
        const nextState = queueDraws(recordEffects(stateBeforeDraw, { kind: "healing", source: "healing", cardDefinitionId: card.definitionId, sourcePlayerId: player.id, playerId: target.id, amount: healedAmount }), [{ playerId: player.id, remaining: definition.draw ?? 0,
          cards: [], destination: "hand", replaceEvents: true, playedCard: card }]);
        const message =
          player.id === target.id
            ? `${player.name} played ${definition.name} and healed ${healedAmount}.`
            : `${player.name} played ${definition.name} on ${target.name} and healed ${healedAmount}.`;

        return log(nextState, message);
      }

      const result = resolveHealing(state, player, card, definition, target);
      return result.messages.reduce((nextState, message) => log(nextState, message), result.state);
    }
    case "PLAY_ABILITY": {
      if (!canPlayerAct(state, action.playerId)) {
        return state;
      }

      const player = getCurrentPlayer(state);
      const card = player.hand.find((handCard) => handCard.instanceId === action.cardInstanceId);
      const definition = card ? getCardDefinitionById(card.definitionId) : undefined;
      const target = action.targetPlayerId ? getPlayer(state, action.targetPlayerId) : undefined;

      if (!card || !definition || definition.type !== "ability") {
        return state;
      }

      if (definition.target === "onePlayer" && (!target || target.eliminated || !isHostileTarget(player, target))) {
        return state;
      }

      if (target && state.smokeProtectedPlayerIds.includes(target.id)) {
        return state;
      }

      return resolveAbility(state, player, card, definition.id, target);
    }
    case "RESOLVE_PENDING_REDIRECT": {
      const pending = state.pendingRedirect;
      const defender = pending ? getPlayer(state, pending.defenderId) : undefined;
      const attacker = pending ? getPlayer(state, pending.attackerId) : undefined;
      const target = getPlayer(state, action.targetPlayerId);

      if (
        !pending ||
        !defender ||
        !attacker ||
        !target ||
        action.defenderId !== defender.id ||
        !getRicochetTargets(state, attacker.id, defender.id).some(candidate => candidate.id === target.id)
      ) {
        return state;
      }

      const stateBeforeRedirect = {
        ...state,
        pendingRedirect: null,
        players: state.players.map((player) =>
          player.id === defender.id
            ? {
                ...player,
                hand: player.hand.filter((cardInstance) => cardInstance.instanceId !== pending.decoy.instanceId)
              }
            : player
        )
      };
      const reloadActive = stateBeforeRedirect.reloadPlayerIds.includes(attacker.id);
      const multi = state.pendingMultiHitAttack;
      const keepWeapon = reloadActive || Boolean(multi && multi.hitsRemaining > 1);
      const spendAttackAction = !multi || multi.hitsRemaining === 2;
      // Marks belong to the recipient, not the projectile. Preserve the hit's
      // other bonuses; SMG's second hit never receives target bonuses.
      const markAdjustment = !multi || multi.hitsRemaining === 2
        ? (state.markedTargets[target.id] ?? 0) - (state.markedTargets[defender.id] ?? 0)
        : 0;
      const creditToDefender = target.id === attacker.id || areTeammates(attacker, target);
      const redirectedState = {
        ...stateBeforeRedirect,
        pendingSecondaryDamage: {
          // A redirect onto the firing side credits the Ricochet player.
          attackerId: creditToDefender ? defender.id : attacker.id,
          defenderId: target.id,
          weapon: pending.weapon,
          baseDamage: pending.baseDamage + markAdjustment,
          source: "ricochet" as const,
          remaining: []
        },
        discardPile: [
          ...stateBeforeRedirect.discardPile,
          pending.decoy,
          ...(keepWeapon ? [] : [pending.weapon])
        ],
        reloadPlayerIds: reloadActive && !multi ? stateBeforeRedirect.reloadPlayerIds.filter((playerId) => playerId !== attacker.id) : stateBeforeRedirect.reloadPlayerIds,
        attackBonuses: omitKey(stateBeforeRedirect.attackBonuses, attacker.id),
        players: stateBeforeRedirect.players.map((player) =>
          player.id === attacker.id
            ? {
                ...player,
                hand: keepWeapon ? player.hand : player.hand.filter((card) => card.instanceId !== pending.weapon.instanceId),
                attackedThisRound: true,
                actedThisRound: true,
                actionsRemaining: spendAttackAction ? Math.max(0, player.actionsRemaining - 1) : player.actionsRemaining
              }
            : player
        )
      };
      const redirected = log(finishMultiHit(redirectedState), `${defender.name} redirected ${attacker.name}'s attack to ${target.name}.${state.settings.allowSecondaryDefense ? ` ${target.name} may defend.` : ""}`);
      if (state.settings.allowSecondaryDefense) return redirected;
      const result = resolveCurrentSecondaryDamage(redirected, null);
      return result.messages.reduce((nextState, message) => log(nextState, message), result.state);
    }

    case "RESOLVE_PENDING_ATTACK_COST": {
      const pending = state.pendingAttackCost;
      const attacker = pending ? getPlayer(state, pending.attackerId) : undefined;
      const target = pending ? getPlayer(state, pending.targetPlayerId) : undefined;
      const weapon = attacker?.hand.find((card) => card.instanceId === pending?.weaponInstanceId);
      const costCard = attacker?.hand.find((card) => card.instanceId === action.cardInstanceId);

      if (
        !pending ||
        !attacker ||
        !target ||
        !weapon ||
        !costCard ||
        action.attackerId !== attacker.id ||
        costCard.instanceId === weapon.instanceId
      ) {
        return state;
      }

      const paidState = {
        ...state,
        pendingAttackCost: null,
        discardPile: [...state.discardPile, costCard],
        players: state.players.map((player) =>
          player.id === attacker.id
            ? {
                ...player,
                hand: player.hand.filter((card) => card.instanceId !== costCard.instanceId)
              }
            : player
        )
      };
      const updatedAttacker = getPlayer(paidState, attacker.id);
      const updatedTarget = getPlayer(paidState, target.id);

      if (!updatedAttacker || !updatedTarget) {
        return state;
      }

      const attacked = reduceGameAction({ ...paidState, intimidations: {
        ...paidState.intimidations,
        [attacker.id]: (paidState.intimidations[attacker.id] ?? []).filter(id => id !== target.id)
      } }, { type: "ATTACK", attackerId: attacker.id, targetPlayerId: target.id, weaponInstanceId: weapon.instanceId });
      return log({ ...attacked, intimidations: paidState.intimidations }, `${attacker.name} discarded a card to attack through Intimidate.`);
    }
    case "ATTACK": {
      if (!canPlayerAct(state, action.attackerId)) {
        return state;
      }

      const attacker = getCurrentPlayer(state);
      const target = action.targetPlayerId ? getPlayer(state, action.targetPlayerId) : undefined;
      const weapon = attacker.hand.find((card) => card.instanceId === action.weaponInstanceId);
      const weaponDefinition = weapon ? getCardDefinitionById(weapon.definitionId) : undefined;

      if (
        state.pendingRedirect ||
        state.pendingAttackCost ||
        state.pendingMultiHitAttack ||
        state.pendingSecondaryDamage ||
        !weapon ||
        weaponDefinition?.type !== "weapon"
      ) {
        return state;
      }

      if (weaponDefinition.id === "weapon_minigun") {
        const result = resolveMinigunAttack(state, attacker, weapon, action.damageByTarget ?? {});
        return result.messages.reduce((nextState, message) => log(nextState, message), result.state);
      }

      if (!target || target.eliminated || !isHostileTarget(attacker, target) || state.smokeProtectedPlayerIds.includes(target.id)) {
        return state;
      }

      const intimidatingPlayers = state.intimidations[attacker.id] ?? [];
      if (intimidatingPlayers.includes(target.id)) {
        const availableCostCards = attacker.hand.filter((card) => card.instanceId !== weapon.instanceId);
        if (availableCostCards.length === 0) {
          return state;
        }

        return log(
          {
            ...state,
            pendingAttackCost: {
              attackerId: attacker.id,
              targetPlayerId: target.id,
              weaponInstanceId: weapon.instanceId,
              sourcePlayerId: target.id
            }
          },
          `${attacker.name} must discard 1 card to attack ${target.name}.`
        );
      }

      if (weaponDefinition.id === "weapon_smg") {
        const hitDamage = 2;
        const baseDamage = getBaseAttackDamage(state, attacker, target, weaponDefinition, hitDamage);
        return log(
          {
            ...state,
            pendingReaction: {
              attackerId: attacker.id,
              defenderId: target.id,
              weapon,
              baseDamage
            },
            pendingMultiHitAttack: {
              attackerId: attacker.id,
              defenderId: target.id,
              weapon,
              hitsRemaining: 2,
              hitDamage
            }
          },
          `${attacker.name} played SMG targeting ${target.name}.`
        );
      }

      const result = createPendingReaction(state, attacker, target, weapon);
      return result.messages.reduce((nextState, message) => log(nextState, message), result.state);
    }
    case "PLAY_REACTION": {
      const pending = state.pendingReaction;
      const defender = pending ? getPlayer(state, pending.defenderId) : undefined;
      const attacker = pending ? getPlayer(state, pending.attackerId) : undefined;
      const reaction = defender?.hand.find((card) => card.instanceId === action.reactionCardInstanceId);
      const reactionDefinition = reaction ? getCardDefinitionById(reaction.definitionId) : undefined;

      if (
        !pending ||
        !defender ||
        !attacker ||
        action.defenderId !== defender.id ||
        !reaction ||
        (reactionDefinition?.type !== "defense" && !reactionDefinition?.isLethalDefense)
      ) {
        return state;
      }

      if (reactionDefinition.isLethalDefense && pending.baseDamage < defender.health) {
        return state;
      }

      if (reactionDefinition.id === "defense_decoy") {
        const hasRedirectTarget = getRicochetTargets(state, attacker.id, defender.id).length > 0;
        if (!hasRedirectTarget) {
          return state;
        }

        return log(
          {
            ...state,
            pendingReaction: null,
            pendingRedirect: {
              ...pending,
              decoy: reaction
            }
          },
          `${defender.name} played Ricochet and must choose a new target.`
        );
      }

      const result = resolvePendingAttack(state, attacker, defender, pending.weapon, reaction);
      return result.messages.reduce((nextState, message) => log(nextState, message), result.state);
    }
    case "SKIP_REACTION": {
      const pending = state.pendingReaction;
      const defender = pending ? getPlayer(state, pending.defenderId) : undefined;
      const attacker = pending ? getPlayer(state, pending.attackerId) : undefined;

      if (!pending || !defender || !attacker || action.defenderId !== defender.id) {
        return state;
      }

      const result = resolvePendingAttack(state, attacker, defender, pending.weapon, null);
      return result.messages.reduce((nextState, message) => log(nextState, message), result.state);
    }
    case "PLAY_SECONDARY_REACTION": {
      const pending = state.pendingSecondaryDamage;
      const defender = pending ? getPlayer(state, pending.defenderId) : undefined;
      const reaction = defender?.hand.find((card) => card.instanceId === action.reactionCardInstanceId);
      const reactionDefinition = reaction ? getCardDefinitionById(reaction.definitionId) : undefined;

      if (
        !pending ||
        !defender ||
        action.defenderId !== defender.id ||
        !reaction ||
        (reactionDefinition?.type !== "defense" && !reactionDefinition?.isLethalDefense) ||
        reactionDefinition?.id === "defense_decoy"
      ) {
        return state;
      }

      if (reactionDefinition.isLethalDefense && pending.baseDamage < defender.health) {
        return state;
      }

      const result = resolveCurrentSecondaryDamage(state, reaction);
      return result.messages.reduce((nextState, message) => log(nextState, message), result.state);
    }
    case "SKIP_SECONDARY_REACTION": {
      const pending = state.pendingSecondaryDamage;
      const defender = pending ? getPlayer(state, pending.defenderId) : undefined;

      if (!pending || !defender || action.defenderId !== defender.id) {
        return state;
      }

      const result = resolveCurrentSecondaryDamage(state, null);
      return result.messages.reduce((nextState, message) => log(nextState, message), result.state);
    }
    case "PASS_ACTION": {
      if (!canPlayerAct(state, action.playerId)) {
        return state;
      }

      const nextState = spendAction(state, action.playerId);
      return log(nextState, `${getCurrentPlayer(state).name} passed an action.`);
    }
    case "END_TURN": {
      if (!canPlayerEndTurn(state, action.playerId)) {
        return state;
      }

      if (currentPlayerOverHandLimit(state)) {
        return state;
      }

      const ended = updatePlayer(state, action.playerId, (player) => ({
        ...player,
        actionsRemaining: 0,
        actedThisRound: true
      }));
      return advanceTurn(
        log(
          expireTurnEffects(ended),
          `${getCurrentPlayer(state).name} ended their turn.`
        )
      );
    }
    case "RESET_GAME":
      return createSetupState(state.settings);
    case "RESTART_GAME":
      return createNewGame(
        state.players.map((player) => ({
          name: player.name,
          controller: player.controller,
          teamId: player.teamId
        })),
        Math.random,
        state.settings
      );
    default:
      return state;
  }
}

export const cardDefinitions = allCards;

function resolvePendingAttack(
  state: GameState,
  attacker: PlayerState,
  defender: PlayerState,
  weapon: CardInstance,
  reaction: CardInstance | null
) {
  const multiHit = state.pendingMultiHitAttack;
  const reloadActive = state.reloadPlayerIds.includes(attacker.id);
  const weaponDefinition = getCardDefinitionById(weapon.definitionId);
  const reactionDefinition = getCardDefinitionById(reaction?.definitionId ?? "");
  const counterDamage = getReactionCounterDamage(reactionDefinition, state.pendingReaction?.baseDamage ?? 0);
  const deferSplash = state.settings.allowSecondaryDefense && weaponDefinition?.id === "weapon_grenade" && !multiHit;
  const deferCounterDamage = state.settings.allowSecondaryDefense && counterDamage > 0;

  if (!multiHit || multiHit.weapon.instanceId !== weapon.instanceId) {
    const result = resolveAttack(state, attacker, defender, weapon, reaction, {
      keepWeaponInHand: reloadActive,
      deferGameOver: true,
      resolveSplash: !deferSplash,
      resolveCounterDamage: !deferCounterDamage
    });
    const stateAfterReload = reloadActive ? consumeReload(result.state, attacker.id) : result.state;
    const counterItems = deferCounterDamage
      ? [
          {
            attackerId: defender.id,
            defenderId: attacker.id,
            weapon,
            baseDamage: counterDamage,
            source: reactionDefinition?.id === "defense_backfire" ? ("backfire" as const) : ("counterattack" as const)
          }
        ]
      : [];
    const splashItems = deferSplash ? getGrenadeSplashItems(stateAfterReload, state.players, attacker.id, defender.id, weapon) : [];
    return enqueueSecondaryDamage(stateAfterReload, result.messages, [...counterItems, ...splashItems]);
  }

  const isFinalHit = multiHit.hitsRemaining <= 1;
  const hitDamage = multiHit.hitsRemaining === 2 ? (state.pendingReaction?.baseDamage ?? multiHit.hitDamage) : multiHit.hitDamage;
  const result = resolveAttack(state, attacker, defender, weapon, reaction, {
    deferGameOver: true,
    baseDamageOverride: hitDamage,
    keepWeaponInHand: !isFinalHit || reloadActive,
    spendAction: multiHit.hitsRemaining === 2,
    resolveCounterDamage: !deferCounterDamage,
    clearAttackBonuses: true
  });
  const afterHit = finishMultiHit(result.state);
  return enqueueSecondaryDamage(afterHit, result.messages, deferCounterDamage ? [{
    attackerId: defender.id, defenderId: attacker.id, weapon, baseDamage: counterDamage,
    source: reactionDefinition?.id === "defense_backfire" ? "backfire" : "counterattack"
  }] : []);
}

function finishMultiHit(state: GameState): GameState {
  if (!state.pendingMultiHitAttack) return state;
  return { ...state, pendingReaction: null, pendingMultiHitAttack: {
    ...state.pendingMultiHitAttack, hitsRemaining: state.pendingMultiHitAttack.hitsRemaining - 1
  } };
}

function resumeMultiHit(state: GameState): GameState {
  const multi = state.pendingMultiHitAttack;
  if (!multi || state.pendingReaction || state.pendingRedirect || state.pendingSecondaryDamage) return state;
  const attacker = getPlayer(state, multi.attackerId), defender = getPlayer(state, multi.defenderId);
  // Revive can discard the shooter's weapon between hits without eliminating them.
  const stillHoldingWeapon = attacker?.hand.some(card => card.instanceId === multi.weapon.instanceId);
  if (!attacker || !defender || !stillHoldingWeapon || attacker.eliminated || defender.eliminated || multi.hitsRemaining <= 0 || state.smokeProtectedPlayerIds.includes(defender.id)) {
    const cleaned = state.reloadPlayerIds.includes(multi.attackerId) ? state : discardInterruptedWeapon(state, multi.attackerId, multi.weapon);
    return { ...consumeReload(cleaned, multi.attackerId), pendingMultiHitAttack: null };
  }
  return log({ ...state, pendingReaction: {
    attackerId: multi.attackerId, defenderId: multi.defenderId, weapon: multi.weapon, baseDamage: multi.hitDamage
  } }, `${attacker.name}'s SMG fires again at ${defender.name}.`);
}

function getGrenadeSplashItems(
  state: GameState,
  beforePlayers: PlayerState[],
  attackerId: PlayerId,
  targetId: PlayerId,
  weapon: CardInstance
): SecondaryDamageItem[] {
  const weaponDefinition = getCardDefinitionById(weapon.definitionId);
  const splashDamage = weaponDefinition?.splashDamage ?? 0;
  if (splashDamage <= 0) {
    return [];
  }

  return getGrenadeSplashTargets(beforePlayers, attackerId, targetId)
    .filter((target) => {
      const current = getPlayer(state, target.id);
      const attacker = getPlayer(state, attackerId);
      return current && attacker && !current.eliminated && !areTeammates(attacker, current);
    })
    .map((target) => ({
      attackerId,
      defenderId: target.id,
      weapon,
      baseDamage: splashDamage,
      source: "splash" as const
    }));
}

function enqueueSecondaryDamage(state: GameState, messages: string[], items: SecondaryDamageItem[]) {
  const pendingItems = items.filter((item) => {
    const defender = getPlayer(state, item.defenderId);
    return state.phase !== "gameOver" && defender && !defender.eliminated && item.baseDamage > 0;
  });

  if (pendingItems.length === 0) {
    return { state, messages };
  }

  const [next, ...remaining] = pendingItems;
  const defender = getPlayer(state, next.defenderId);
  return {
    state: {
      ...state,
      pendingSecondaryDamage: {
        ...next,
        remaining
      }
    },
    messages: [...messages, `${defender?.name ?? "A player"} may defend against ${getSecondarySourceName(next.source)}.`]
  };
}

function resolveCurrentSecondaryDamage(state: GameState, reaction: CardInstance | null) {
  const pending = state.pendingSecondaryDamage;
  const attacker = pending ? getPlayer(state, pending.attackerId) : undefined;
  const defender = pending ? getPlayer(state, pending.defenderId) : undefined;

  if (!pending || !attacker || !defender) {
    return { state, messages: [] };
  }

  const baseState = { ...state, pendingSecondaryDamage: null };
  const reactionDefinition = getCardDefinitionById(reaction?.definitionId ?? "");
  const counterDamage = getReactionCounterDamage(reactionDefinition, pending.baseDamage);
  const deferCounterDamage = state.settings.allowSecondaryDefense && counterDamage > 0;
  const result = resolveSecondaryDamage(baseState, attacker, defender, pending.weapon, pending.baseDamage, pending.source, reaction, {
    resolveCounterDamage: !deferCounterDamage, deferGameOver: true
  });
  const counterItems: SecondaryDamageItem[] = deferCounterDamage
    ? [
        {
          attackerId: defender.id,
          defenderId: attacker.id,
          weapon: pending.weapon,
          baseDamage: counterDamage,
          source: reactionDefinition?.id === "defense_backfire" ? "backfire" : "counterattack"
        }
      ]
    : [];
  const remainingItems = [...counterItems, ...pending.remaining];
  if (result.state.phase === "gameOver" || remainingItems.length === 0) {
    return result;
  }

  const [next, ...remaining] = remainingItems;
  const nextDefender = getPlayer(result.state, next.defenderId);
  if (!nextDefender || nextDefender.eliminated) {
    return enqueueSecondaryDamage(result.state, result.messages, remaining);
  }

  return {
    ...result,
    state: {
      ...result.state,
      pendingSecondaryDamage: {
        ...next,
        remaining
      }
    },
    messages: [...result.messages, `${nextDefender.name} may defend against ${getSecondarySourceName(next.source)}.`]
  };
}

function getReactionCounterDamage(reactionDefinition: ReturnType<typeof getCardDefinitionById>, baseDamage: number): number {
  if (reactionDefinition?.id === "defense_counterattack") {
    return reactionDefinition.damage ?? 3;
  }

  if (reactionDefinition?.id === "defense_backfire") {
    return baseDamage;
  }

  return 0;
}

function getSecondarySourceName(source: SecondaryDamageSource): string {
  if (source === "splash") {
    return "Grenade splash damage";
  }

  if (source === "ricochet") {
    return "Ricochet";
  }

  if (source === "minigun") {
    return "Minigun damage";
  }

  return source === "backfire" ? "Backfire damage" : "Counterattack damage";
}

function resolveMinigunAttack(state: GameState, attacker: PlayerState, weapon: CardInstance, requestedDamageByTarget: Record<PlayerId, number>) {
  const weaponDefinition = getCardDefinitionById(weapon.definitionId);
  if (!weaponDefinition) {
    return { state, messages: [] };
  }

  const allocation = getValidMinigunAllocation(state, attacker, weaponDefinition, requestedDamageByTarget);
  if (!allocation) {
    return { state, messages: [] };
  }

  const reloadActive = state.reloadPlayerIds.includes(attacker.id);
  const damagedPlayerIds = Object.keys(allocation);
  const damageByPlayerId = allocation;
  const baseState: GameState = {
    ...state,
    discardPile: reloadActive ? state.discardPile : [...state.discardPile, weapon],
    reloadPlayerIds: reloadActive ? state.reloadPlayerIds.filter((playerId) => playerId !== attacker.id) : state.reloadPlayerIds,
    attackBonuses: omitKey(state.attackBonuses, attacker.id),
    players: state.players.map((player) =>
      player.id === attacker.id
        ? {
            ...player,
            hand: reloadActive ? player.hand : player.hand.filter((card) => card.instanceId !== weapon.instanceId),
            attackedThisRound: true,
            actedThisRound: true,
            actionsRemaining: Math.max(0, player.actionsRemaining - 1)
          }
        : player
    )
  };
  const messages = [`${attacker.name} allocated ${sumValues(damageByPlayerId)} Minigun damage across ${damagedPlayerIds.length} opponent${damagedPlayerIds.length === 1 ? "" : "s"}.`];
  const hits: SecondaryDamageItem[] = damagedPlayerIds.map(playerId => ({
    attackerId: attacker.id, defenderId: playerId, weapon,
    baseDamage: damageByPlayerId[playerId], source: "minigun"
  }));
  if (state.settings.allowSecondaryDefense) return enqueueSecondaryDamage(baseState, messages, hits);

  // Resolve the same hits without opening reaction windows. Victory waits until
  // every allocated hit has applied, just as it does with secondary defense on.
  let nextState = baseState;
  for (const hit of hits) {
    const result = resolveSecondaryDamage(nextState, getPlayer(nextState, attacker.id)!, getPlayer(nextState, hit.defenderId)!, weapon, hit.baseDamage, hit.source, null, { deferGameOver: true });
    nextState = result.state;
    messages.push(...result.messages);
  }
  return { state: nextState, messages };
}

function getValidMinigunAllocation(
  state: GameState,
  attacker: PlayerState,
  weaponDefinition: NonNullable<ReturnType<typeof getCardDefinitionById>>,
  requestedDamageByTarget: Record<PlayerId, number>
): Record<PlayerId, number> | null {
  const pool = getMinigunDamagePool(state, attacker, weaponDefinition);
  const perTargetCap = weaponDefinition.maxDamagePerTarget ?? 3;
  const entries = Object.entries(requestedDamageByTarget)
    .map(([playerId, damage]) => [playerId, Math.floor(Number(damage))] as const)
    .filter(([, damage]) => damage > 0);

  if (entries.length === 0) {
    return null;
  }

  const allocation: Record<PlayerId, number> = {};
  for (const [playerId, damage] of entries) {
    const target = getPlayer(state, playerId);
    if (!target || target.eliminated || !isHostileTarget(attacker, target) || state.smokeProtectedPlayerIds.includes(target.id)) {
      return null;
    }

    if (damage > perTargetCap) {
      return null;
    }

    allocation[playerId] = (allocation[playerId] ?? 0) + damage;
    if (allocation[playerId] > perTargetCap) {
      return null;
    }
  }

  if (sumValues(allocation) > pool) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(allocation).map(([playerId, damage]) => [playerId, damage + (state.markedTargets[playerId] ?? 0)])
  );
}

function getMinigunDamagePool(
  state: GameState,
  attacker: PlayerState,
  weaponDefinition: NonNullable<ReturnType<typeof getCardDefinitionById>>
): number {
  return (weaponDefinition.damage ?? 0) + (state.attackBonuses[attacker.id] ?? 0);
}

function sumValues(record: Record<string, number>): number {
  return Object.values(record).reduce((total, value) => total + value, 0);
}

function consumeReload(state: GameState, playerId: PlayerId): GameState {
  return {
    ...state,
    reloadPlayerIds: state.reloadPlayerIds.filter((candidate) => candidate !== playerId)
  };
}

function discardInterruptedWeapon(state: GameState, attackerId: PlayerId, weapon: CardInstance): GameState {
  const attacker = getPlayer(state, attackerId);
  if (!attacker?.hand.some((card) => card.instanceId === weapon.instanceId)) {
    return state;
  }

  return {
    ...state,
    discardPile: [...state.discardPile, weapon],
    selectedCardId: state.selectedCardId === weapon.instanceId ? null : state.selectedCardId,
    players: state.players.map((player) =>
      player.id === attackerId
        ? {
            ...player,
            hand: player.hand.filter((card) => card.instanceId !== weapon.instanceId)
          }
        : player
    )
  };
}

function resolveAbility(
  state: GameState,
  player: PlayerState,
  card: { instanceId: string; definitionId: string },
  definitionId: string,
  target: PlayerState | undefined
): GameState {
  const abilityName = getCardDefinitionById(definitionId)?.name ?? "Ability";
  const basePlayer = {
    ...player,
    hand: player.hand.filter((handCard) => handCard.instanceId !== card.instanceId),
    actionsRemaining: Math.max(0, player.actionsRemaining - 1),
    actedThisRound: true
  };
  let nextState: GameState = {
    ...state,
    discardPile: [...state.discardPile, card],
    selectedCardId: state.selectedCardId === card.instanceId ? null : state.selectedCardId,
    players: state.players.map((candidate) => (candidate.id === player.id ? basePlayer : candidate))
  };
  let message = `${player.name} played ${abilityName}.`;

  if (definitionId === "ability_ambush") {
    nextState = {
      ...nextState,
      attackBonuses: {
        ...nextState.attackBonuses,
        [player.id]: (nextState.attackBonuses[player.id] ?? 0) + 3
      }
    };
    message = `${player.name} played Ambush. Their next attack gets +3 damage.`;
  }

  if (definitionId === "ability_adrenaline") {
    nextState = updatePlayer(nextState, player.id, (currentPlayer) => ({
      ...currentPlayer,
      health: Math.max(0, currentPlayer.health - 2),
      eliminated: currentPlayer.health <= 2,
      actionsRemaining: currentPlayer.actionsRemaining + 2
    }));
    nextState = recordHealthChanges(state.players, nextState, "ability", definitionId, player.id);
    message = `${player.name} played Adrenaline, gained an action, and lost 2 health.`;
  }

  if (definitionId === "ability_steal" && target) {
    if (target.hand.length === 0) {
      return log(nextState, `${player.name} played Steal, but ${target.name} had no cards.`);
    }

    const order = shuffleWithState(target.hand.map(card => card.instanceId), nextState.deckRandomState);
    nextState = {
      ...nextState,
      deckRandomState: order.randomState,
      pendingSteal: {
        playerId: player.id,
        targetPlayerId: target.id,
        cardInstanceIds: order.shuffled
      }
    };
    message = `${player.name} played Steal and must choose 1 card from ${target.name}.`;
  }

  if (definitionId === "ability_search") {
    return queueDraws({ ...nextState, discardPile: nextState.discardPile.filter(discarded => discarded.instanceId !== card.instanceId) },
      [{ playerId: player.id, remaining: 3, cards: [], destination: "search", replaceEvents: true, playedCard: card }]);
  }

  if (definitionId === "ability_reload") {
    nextState = {
      ...nextState,
      reloadPlayerIds: Array.from(new Set([...nextState.reloadPlayerIds, player.id]))
    };
    message = `${player.name} played Reload. Their next weapon stays in hand after use.`;
  }

  if (definitionId === "ability_disarm" && target) {
    const weapon = getHighestDamageWeapon(target.hand);
    if (!weapon) {
      return log(nextState, `${player.name} played Disarm, but ${target.name} had no weapon cards.`);
    }

    nextState = {
      ...nextState,
      discardPile: [...nextState.discardPile, weapon],
      players: nextState.players.map((candidate) =>
        candidate.id === target.id
          ? {
              ...candidate,
              hand: candidate.hand.filter((card) => card.instanceId !== weapon.instanceId)
            }
          : candidate
      )
    };
    message = `${player.name} disarmed ${target.name}, discarding ${getCardDefinitionById(weapon.definitionId)?.name ?? "a weapon"}.`;
  }

  if (definitionId === "ability_sabotage" && target) {
    nextState = {
      ...nextState,
      pendingDiscard: {
        sourcePlayerId: player.id,
        playerId: target.id,
        count: Math.min(2, target.hand.length),
        reason: "Sabotage"
      }
    };
    message = `${player.name} sabotaged ${target.name}. ${target.name} must discard ${Math.min(2, target.hand.length)} cards.`;
  }

  if (definitionId === "ability_mark_target" && target) {
    nextState = {
      ...nextState,
      markedTargets: {
        ...nextState.markedTargets,
        [target.id]: (nextState.markedTargets[target.id] ?? 0) + 1
      }
    };
    message = `${player.name} marked ${target.name}. Attacks against them get +1 damage this round.`;
  }

  if (definitionId === "ability_intimidate" && target) {
    nextState = {
      ...nextState,
      intimidations: {
        ...nextState.intimidations,
        [target.id]: Array.from(new Set([...(nextState.intimidations[target.id] ?? []), player.id]))
      }
    };
    message = `${player.name} intimidated ${target.name}. ${target.name} must discard 1 card to attack them before their next turn.`;
  }

  return log(nextState, message);
}

function clearIntimidationsAgainst(intimidations: Record<string, string[]>, sourcePlayerId: string): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(intimidations)
      .map(([targetId, sourceIds]) => [targetId, sourceIds.filter((id) => id !== sourcePlayerId)] as const)
      .filter(([, sourceIds]) => sourceIds.length > 0)
  );
}

function scheduleForcedDiscard(state: GameState, playerIds: PlayerId[], cardType: CardType, reason: string): GameState {
  const [nextPlayerId, ...remainingPlayerIds] = playerIds;
  const player = nextPlayerId ? getPlayer(state, nextPlayerId) : undefined;
  if (!player) {
    return state;
  }

  const allowedIds = player.hand
    .filter((card) => getCardDefinitionById(card.definitionId)?.type === cardType)
    .map((card) => card.instanceId);

  if (player.eliminated || allowedIds.length === 0) {
    return scheduleForcedDiscard(state, remainingPlayerIds, cardType, reason);
  }

  return {
    ...state,
    pendingDiscard: {
      sourcePlayerId: nextPlayerId,
      playerId: nextPlayerId,
      count: 1,
      reason,
      allowedCardInstanceIds: allowedIds,
      continuation: {
        type: "forced_discard",
        remainingPlayerIds,
        cardType,
        reason
      }
    }
  };
}

function breakEliminationTie(players: PlayerState[]): { winner: PlayerState; description: string } | null {
  const candidates = [...players].sort(
    (left, right) => right.eliminations - left.eliminations || right.health - left.health || right.hand.length - left.hand.length
  );
  const winner = candidates[0];
  if (!winner) {
    return null;
  }

  const tied = candidates.filter(
    (player) => player.eliminations === winner.eliminations && player.health === winner.health && player.hand.length === winner.hand.length
  );
  if (tied.length !== 1) return null;

  const runnerUp = candidates[1];
  if (!runnerUp) return { winner, description: `${winner.name} was the only player alive before the final effect.` };
  // Compare the highest-ranked rival; players who lost an earlier criterion
  // must not influence the health or hand-size comparison.
  const comparison = (value: number, other: number) => candidates.length === 2
    ? `${value} vs. ${runnerUp.name}’s ${other}`
    : `${value}; the next highest among the remaining contenders was ${other}`;
  let description: string;
  if (winner.eliminations !== runnerUp.eliminations) {
    description = `${winner.name} wins on eliminations: ${comparison(winner.eliminations, runnerUp.eliminations)}.`;
  } else if (winner.health !== runnerUp.health) {
    description = `Eliminations were tied. ${winner.name} wins on health before the final effect: ${comparison(winner.health, runnerUp.health)}.`;
  } else {
    description = `Eliminations and health were tied. ${winner.name} wins on cards in hand before the final effect: ${comparison(winner.hand.length, runnerUp.hand.length)}.`;
  }
  return { winner, description };
}

function getHighestDamageWeapon(hand: CardInstance[]): CardInstance | null {
  return hand
    .filter((card) => getCardDefinitionById(card.definitionId)?.type === "weapon")
    .sort((left, right) => {
      const leftDamage = getCardDefinitionById(left.definitionId)?.damage ?? 0;
      const rightDamage = getCardDefinitionById(right.definitionId)?.damage ?? 0;
      return rightDamage - leftDamage;
    })[0] ?? null;
}
