import { allCards, type CardType } from "../data/cards";
import { blackMarketPresets } from "../data/constants";
import { drawCardsWithRefill } from "./deck";
import type { CardInstance, PlayerId, SecondaryDamageItem, SecondaryDamageSource } from "./types";
import type { GameAction } from "./actions";
import { createNewGame } from "./setup";
import type { GameState, PlayerState } from "./types";
import { createPendingReaction, getBaseAttackDamage, getGrenadeSplashTargets, resolveAttack, resolveHealing, resolveSecondaryDamage } from "./combat";
import {
  canPlayerAct,
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
  const debugHandSnapshots = shouldCaptureHandSnapshots() ? getHandSnapshots(state) : [];
  const handSnapshots = state.settings.debugHandSnapshots ? debugHandSnapshots : [];
  return {
    ...state,
    log: [
      ...state.log,
      {
        id: `log_${state.log.length + 1}_${Date.now()}`,
        round: state.round,
        message,
        debugHandSnapshots,
        handSnapshots
      }
    ]
  };
}

function shouldCaptureHandSnapshots(): boolean {
  return import.meta.env.DEV;
}

function getHandSnapshots(state: GameState): GameState["log"][number]["handSnapshots"] {
  return state.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    health: player.health,
    cards: player.hand.map((card) => ({ ...card }))
  }));
}

function setLogSnapshotVisibility(state: GameState, visible: boolean): GameState {
  return {
    ...state,
    log: state.log.map((entry) => ({
      ...entry,
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

function advanceTurn(state: GameState): GameState {
  const livingPlayers = state.players.filter((player) => !player.eliminated);
  if (livingPlayers.length <= 1 || getWinningTeamId(state)) {
    return completeGame(state, getWinner(state), getWinningTeamId(state));
  }

  const allLivingActed = state.players.every((player) => player.eliminated || player.actedThisRound);
  const nextLivingIndex = findNextLivingIndex(state.players, state.currentPlayerIndex);
  const roundRobinFirstPlayerIndex =
    state.settings.turnOrder === "roundRobin" && state.players[state.firstPlayerIndex].eliminated
      ? findNextLivingIndex(state.players, state.firstPlayerIndex)
      : state.firstPlayerIndex;
  const nextRound = state.settings.turnOrder === "roundRobin" ? nextLivingIndex === roundRobinFirstPlayerIndex : allLivingActed;
  const collapseState = nextRound ? logPlayerHealthChanges(state.players, applyCollapseDamage(state), "collapse") : state;
  const collapseGameOver = nextRound ? completeGameIfOver(collapseState, state.players) : null;
  if (collapseGameOver) {
    return collapseGameOver;
  }

  const transitionState = nextRound ? expireActiveEvent(collapseState) : state;

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
      actionsRemaining: index === currentPlayerIndex ? transitionState.settings.actionsPerTurn : player.actionsRemaining
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

function completeGameIfOver(state: GameState, beforePlayers: PlayerState[]): GameState | null {
  const winnerTeamId = getWinningTeamId(state);
  if (state.players.filter((player) => !player.eliminated).length > 1 && !winnerTeamId) {
    return null;
  }

  return completeGame(state, getWinner(state) ?? breakEliminationTie(beforePlayers), winnerTeamId);
}

function completeGame(state: GameState, winner: PlayerState | null, winnerTeamId = getWinningTeamId(state)): GameState {
  const teamWinner = winnerTeamId ? state.players.find((player) => player.teamId === winnerTeamId && !player.eliminated) : null;
  const gameOverState = {
    ...state,
    phase: "gameOver" as const,
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

function logPlayerHealthChanges(beforePlayers: PlayerState[], afterState: GameState, source: string): GameState {
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

    const draw = drawCardsResolvingMixedEvents(state, 3, player.id, true);
    return enforceHandLimit(
      updatePlayer(draw.state, player.id, (currentPlayer) => ({
        ...currentPlayer,
        hand: [...currentPlayer.hand, ...draw.drawn]
      })),
      player.id
    );
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
    const drawnState = state.players.filter((player) => !player.eliminated).reduce((nextState, player) => {
      const draw = drawCardsResolvingMixedEvents(nextState, 1, player.id, true);
      return updatePlayer(draw.state, player.id, (currentPlayer) => ({
        ...currentPlayer,
        hand: [...currentPlayer.hand, ...draw.drawn]
      }));
    }, state);

    return drawnState;
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
    const livingPlayers = state.players.filter((player) => !player.eliminated);
    const sourceIndex = Math.max(0, livingPlayers.findIndex((player) => player.id === sourcePlayerId));
    const playerOrder = [...livingPlayers.slice(sourceIndex), ...livingPlayers.slice(0, sourceIndex)].map((player) => player.id);
    return {
      ...state,
      pendingBlackMarket: {
        card: eventCard ?? { instanceId: `active_${eventId}_${state.log.length}`, definitionId: eventId },
        playerOrder,
        currentIndex: 0
      }
    };
  }

  return state;
}

function expireActiveEvent(state: GameState): GameState {
  if (!state.activeEvent) {
    return state;
  }

  return {
    ...state,
    activeEvent: null,
    eventDiscardPile: [...state.eventDiscardPile, state.activeEvent.card]
  };
}

function drawCardsResolvingMixedEvents(state: GameState, count: number, playerId: PlayerId, replaceEvents: boolean) {
  const drawn: CardInstance[] = [];
  let nextState = state;

  while (drawn.length < count && (nextState.mainDeck.length > 0 || nextState.discardPile.length > 0)) {
    const draw = drawCardsWithRefill(nextState.mainDeck, nextState.discardPile, 1);
    const card = draw.drawn[0];
    const definition = getCardDefinitionById(card?.definitionId ?? "");
    nextState = {
      ...nextState,
      mainDeck: draw.mainDeck,
      discardPile: draw.discardPile
    };

    if (!card) {
      break;
    }

    if (definition?.type === "event") {
      nextState = resolveDrawnEvent(nextState, card, playerId);
      if (!replaceEvents) {
        break;
      }
      continue;
    }

    drawn.push(card);
  }

  return {
    state: nextState,
    drawn
  };
}

function resolveDrawnEvent(state: GameState, eventCard: CardInstance, playerId: PlayerId): GameState {
  const definition = getCardDefinitionById(eventCard.definitionId);
  const player = getPlayer(state, playerId);
  const stateWithoutActiveEvent = state;

  if (!definition || definition.type !== "event" || !player) {
    return state;
  }

  if (definition.timing === "immediate") {
    const shouldShowEventDialog = stateWithoutActiveEvent.players.some((candidate) => !candidate.eliminated && candidate.controller.type === "human");
    const eventState = {
      ...stateWithoutActiveEvent,
      pendingEventDialog: shouldShowEventDialog ? { card: eventCard, playerId } : null,
      eventDiscardPile:
        [...stateWithoutActiveEvent.eventDiscardPile, eventCard]
    };
    const eventLoggedState = log(eventState, `${player.name} drew ${definition.name}.`);
    let resolved = logPlayerHealthChanges(state.players, applyImmediateEvent(eventLoggedState, definition.id, playerId, eventCard), definition.name);
    if (definition.id === "event_critical_condition") {
      resolved = log(resolved, getCriticalConditionSummary(state.players, resolved.players));
    }
    return resolved;
  }

  if (definition.timing === "thisRound" || definition.timing === "ongoing") {
    return log(
      {
        ...stateWithoutActiveEvent,
        pendingEventDialog: {
          card: eventCard,
          playerId
        },
        activeEvent: {
          card: eventCard,
          timing: definition.timing,
          sourcePlayerId: playerId
        }
      },
      `${player.name} drew ${definition.name}. Event: ${definition.name}.`
    );
  }

  return log(
    {
      ...stateWithoutActiveEvent,
      pendingEventDialog: {
        card: eventCard,
        playerId
      },
      eventDiscardPile: [...stateWithoutActiveEvent.eventDiscardPile, eventCard]
    },
    `${player.name} drew ${definition.name}.`
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
  return getCurrentPlayer(state).hand.length > state.settings.maxHandSize;
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

function normalizeSettings(settings: GameState["settings"]): GameState["settings"] {
  return {
    ...settings,
    blackMarketCustom: {
      ...settings.blackMarketCustom,
      actionCost: 0
    },
    maxHealth: Math.max(1, settings.maxHealth, settings.startingHealth),
    maxHandSize: Math.max(1, settings.maxHandSize, settings.startingHandSize)
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (
    state.phase === "gameOver" &&
    action.type !== "RESET_GAME" &&
    action.type !== "UPDATE_SETTINGS" &&
    action.type !== "ACKNOWLEDGE_EVENT_DIALOG"
  ) {
    return state;
  }

  if (state.pendingEventDialog && action.type !== "ACKNOWLEDGE_EVENT_DIALOG" && action.type !== "RESET_GAME" && action.type !== "UPDATE_SETTINGS") {
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
      return { ...state, pendingEventDialog: null };
    case "DRAW_CARD": {
      if (!canPlayerAct(state, action.playerId) || (state.mainDeck.length === 0 && state.discardPile.length === 0)) {
        return state;
      }

      const draw = drawCardsResolvingMixedEvents(state, 1, action.playerId, false);
      let nextState = draw.state;

      nextState = updatePlayer(nextState, action.playerId, (player) => ({
        ...player,
        hand: [...player.hand, ...draw.drawn]
      }));
      if (draw.drawn.length === 0) {
        return nextState;
      }

      nextState = spendAction(nextState, action.playerId);
      return log(enforceHandLimit(nextState, action.playerId), `${getCurrentPlayer(state).name} drew 1 card.`);
    }
    case "DISCARD_CARD": {
      const player = getPlayer(state, action.playerId);
      const card = player?.hand.find((handCard) => handCard.instanceId === action.cardInstanceId);

      if (
        !player ||
        !card ||
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

      return log(enforceHandLimit(transferredState, target.id), `${player.name} transferred ${getCardDefinitionById(card.definitionId)?.name ?? "a card"} to ${target.name}.`);
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

      return log(enforceHandLimit(nextState, player.id), `${player.name} kept 1 card from Search and discarded ${discarded.length}.`);
    }
    case "RESOLVE_SUPPLY_DROP_PICK": {
      const pending = state.pendingSupplyDrop;
      const expectedPlayerId = pending?.playerOrder[pending.currentIndex];
      const player = expectedPlayerId ? getPlayer(state, expectedPlayerId) : undefined;
      const picked = action.cardInstanceId ? pending?.revealedCards.find((card) => card.instanceId === action.cardInstanceId) : null;

      if (!pending || !player || action.playerId !== expectedPlayerId || (action.cardInstanceId && !picked)) {
        return state;
      }

      const revealedCards = picked ? pending.revealedCards.filter((card) => card.instanceId !== picked.instanceId) : pending.revealedCards;
      const nextIndex = pending.currentIndex + 1;
      const finished = nextIndex >= pending.playerOrder.length || revealedCards.length === 0;
      let nextState = {
        ...state,
        pendingSupplyDrop: finished
          ? null
          : {
              ...pending,
              currentIndex: nextIndex,
              revealedCards
            },
        discardPile: finished ? [...state.discardPile, ...revealedCards] : state.discardPile,
        players: state.players.map((candidate) =>
          candidate.id === player.id && picked
            ? {
                ...candidate,
                hand: [...candidate.hand, picked]
              }
            : candidate
        )
      };
      if (picked) {
        nextState = enforceHandLimit(nextState, player.id);
      }

      return log(nextState, picked ? `${player.name} claimed a Supply Drop card.` : `${player.name} passed on Supply Drop.`);
    }
    case "START_BLACK_MARKET": {
      const pendingBlackMarket = state.pendingBlackMarket;
      const expectedPlayerId = pendingBlackMarket?.playerOrder[pendingBlackMarket.currentIndex];
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

      const reveal = drawCardsResolvingMixedEvents(state, marketConfig.revealCount, player.id, true);
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

      return log(nextState, `${player.name} used the Black Market and must choose ${marketConfig.keepCount} card${marketConfig.keepCount === 1 ? "" : "s"}.`);
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
      const nextState = advanceBlackMarket({
        ...state,
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
      });

      return log(enforceHandLimit(nextState, player.id), `${player.name} bought ${kept.length} Black Market card${kept.length === 1 ? "" : "s"} and discarded ${unkept.length}.`);
    }
    case "PASS_BLACK_MARKET": {
      const pendingBlackMarket = state.pendingBlackMarket;
      const expectedPlayerId = pendingBlackMarket?.playerOrder[pendingBlackMarket.currentIndex];
      const player = getPlayer(state, action.playerId);
      if (!pendingBlackMarket || action.playerId !== expectedPlayerId || !player) {
        return state;
      }

      return log(advanceBlackMarket(state), `${player.name} passed on the Black Market.`);
    }
    case "RESOLVE_PENDING_STEAL": {
      const pending = state.pendingSteal;
      const player = pending ? getPlayer(state, pending.playerId) : undefined;
      const target = pending ? getPlayer(state, pending.targetPlayerId) : undefined;
      const stolen = target?.hand.find((card) => card.instanceId === action.cardInstanceId);

      if (!pending || !player || !target || !stolen || action.playerId !== player.id || action.targetPlayerId !== target.id) {
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

      return log(enforceHandLimit(nextState, player.id), `${player.name} stole 1 card from ${target.name}.`);
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
        const draw = drawCardsResolvingMixedEvents(stateBeforeDraw, definition.draw ?? 0, player.id, true);
        const nextState = {
          ...updatePlayer(draw.state, player.id, (currentPlayer) => ({
            ...currentPlayer,
            hand: [...currentPlayer.hand, ...draw.drawn]
          })),
          discardPile: [...draw.state.discardPile, card]
        };
        const message =
          player.id === target.id
            ? `${player.name} played ${definition.name} and healed ${healedAmount}.`
            : `${player.name} played ${definition.name} on ${target.name} and healed ${healedAmount}.`;

        return log(enforceHandLimit(nextState, player.id), message);
      }

      const result = resolveHealing(state, player, card, definition, target);
      return result.messages.reduce((nextState, message) => log(nextState, message), enforceHandLimit(result.state, player.id));
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
        target.eliminated ||
        target.id === attacker.id ||
        target.id === defender.id ||
        areTeammates(defender, target)
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
      if (state.settings.allowSecondaryDefense) {
        const redirectedState = {
          ...stateBeforeRedirect,
          pendingSecondaryDamage: {
            attackerId: attacker.id,
            defenderId: target.id,
            weapon: pending.weapon,
            baseDamage: pending.baseDamage,
            source: "ricochet" as const,
            remaining: []
          },
          discardPile: [
            ...stateBeforeRedirect.discardPile,
            pending.decoy,
            ...(reloadActive ? [] : [pending.weapon])
          ],
          reloadPlayerIds: reloadActive ? stateBeforeRedirect.reloadPlayerIds.filter((playerId) => playerId !== attacker.id) : stateBeforeRedirect.reloadPlayerIds,
          attackBonuses: omitKey(stateBeforeRedirect.attackBonuses, attacker.id),
          players: stateBeforeRedirect.players.map((player) =>
            player.id === attacker.id
              ? {
                  ...player,
                  hand: reloadActive ? player.hand : player.hand.filter((card) => card.instanceId !== pending.weapon.instanceId),
                  attackedThisRound: true,
                  actedThisRound: true,
                  actionsRemaining: Math.max(0, player.actionsRemaining - 1)
                }
              : player
          )
        };
        return log(redirectedState, `${defender.name} redirected ${attacker.name}'s attack to ${target.name}. ${target.name} may defend.`);
      }

      const result = resolveAttack(stateBeforeRedirect, attacker, target, pending.weapon, pending.decoy, {
        keepWeaponInHand: reloadActive
      });
      const resolvedState = reloadActive ? consumeReload(result.state, attacker.id) : result.state;
      return result.messages.reduce((nextState, message) => log(nextState, message), resolvedState);
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

      const result = createPendingReaction(paidState, updatedAttacker, updatedTarget, weapon);
      return result.messages.reduce(
        (nextState, message) => log(nextState, message),
        log(result.state, `${attacker.name} discarded a card to attack through Intimidate.`)
      );
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
        const result = resolveMinigunAttack(state, attacker, weapon);
        return result.messages.reduce((nextState, message) => log(nextState, message), result.state);
      }

      if (!target || target.eliminated || !isHostileTarget(attacker, target) || state.smokeProtectedPlayerIds.includes(target.id)) {
        return state;
      }

      const intimidatingPlayers = state.intimidations[attacker.id] ?? [];
      if (intimidatingPlayers.includes(target.id)) {
        const availableCostCards = attacker.hand.filter((card) => card.instanceId !== weapon.instanceId);
        if (availableCostCards.length === 0) {
          return log(state, `${attacker.name} must discard 1 card to attack ${target.name}, but has no extra cards.`);
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
        const hasRedirectTarget = state.players.some(
          (player) => !player.eliminated && player.id !== attacker.id && player.id !== defender.id
        );
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
      if (getCurrentPlayer(state).id !== action.playerId) {
        return state;
      }

      if (currentPlayerOverHandLimit(state)) {
        return log(state, `${getCurrentPlayer(state).name} must discard down to ${state.settings.maxHandSize} cards before ending turn.`);
      }

      const ended = updatePlayer(state, action.playerId, (player) => ({
        ...player,
        actionsRemaining: 0,
        actedThisRound: true
      }));
      return advanceTurn(
        log(
          {
            ...ended,
            reloadPlayerIds: ended.reloadPlayerIds.filter((playerId) => playerId !== action.playerId)
          },
          `${getCurrentPlayer(state).name} ended their turn.`
        )
      );
    }
    case "RESET_GAME":
      return {
        ...state,
        phase: "setup"
      };
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
    baseDamageOverride: hitDamage,
    keepWeaponInHand: !isFinalHit || reloadActive,
    spendAction: multiHit.hitsRemaining === 2,
    clearAttackBonuses: true
  });
  const nextDefender = getPlayer(result.state, defender.id);
  const shouldContinue =
    !isFinalHit &&
    nextDefender &&
    !nextDefender.eliminated &&
    !result.state.smokeProtectedPlayerIds.includes(defender.id) &&
    result.state.phase !== "gameOver";

  if (!shouldContinue || !nextDefender) {
    const shouldDiscardInterruptedWeapon = !isFinalHit && !reloadActive;
    const interruptedState = shouldDiscardInterruptedWeapon ? discardInterruptedWeapon(result.state, attacker.id, weapon) : result.state;
    return {
      ...result,
      state: {
        ...interruptedState,
        reloadPlayerIds: isFinalHit || reloadActive ? interruptedState.reloadPlayerIds.filter((playerId) => playerId !== attacker.id) : interruptedState.reloadPlayerIds,
        pendingMultiHitAttack: null
      }
    };
  }

  return {
    ...result,
    state: {
      ...result.state,
      pendingMultiHitAttack: {
        ...multiHit,
        hitsRemaining: multiHit.hitsRemaining - 1
      },
      pendingReaction: {
        attackerId: attacker.id,
        defenderId: defender.id,
        weapon,
        baseDamage: multiHit.hitDamage
      }
    },
    messages: [...result.messages, `${attacker.name}'s SMG fires again at ${defender.name}.`]
  };
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
    resolveCounterDamage: !deferCounterDamage
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

function resolveMinigunAttack(state: GameState, attacker: PlayerState, weapon: CardInstance) {
  const weaponDefinition = getCardDefinitionById(weapon.definitionId);
  if (!weaponDefinition) {
    return { state, messages: [] };
  }

  const reloadActive = state.reloadPlayerIds.includes(attacker.id);
  const damagedPlayerIds = state.players
    .filter((player) => !player.eliminated && isHostileTarget(attacker, player) && !state.smokeProtectedPlayerIds.includes(player.id))
    .map((player) => player.id);
  const damageByPlayerId = Object.fromEntries(
    state.players
      .filter((player) => damagedPlayerIds.includes(player.id))
      .map((player) => [player.id, getBaseAttackDamage(state, attacker, player, weaponDefinition)])
  );
  const maxDamage = Math.max(0, ...Object.values(damageByPlayerId));
  if (state.settings.allowSecondaryDefense) {
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
    return enqueueSecondaryDamage(
      baseState,
      [`${attacker.name} swept the field with Minigun for ${maxDamage} damage to each other player.`],
      damagedPlayerIds.map((playerId) => ({
        attackerId: attacker.id,
        defenderId: playerId,
        weapon,
        baseDamage: damageByPlayerId[playerId] ?? 0,
        source: "minigun"
      }))
    );
  }

  const eliminatedHands = state.players
    .filter((player) => damagedPlayerIds.includes(player.id) && player.health <= (damageByPlayerId[player.id] ?? 0))
    .flatMap((player) => player.hand);
  const eliminatedCount = state.players.filter((player) => damagedPlayerIds.includes(player.id) && player.health <= (damageByPlayerId[player.id] ?? 0)).length;
  const players = state.players.map((player) => {
    if (player.id === attacker.id) {
      const rewardedHealth = applyEliminationHealthReward(player.health, eliminatedCount, state);
      return {
        ...player,
        hand: [...(reloadActive ? player.hand : player.hand.filter((card) => card.instanceId !== weapon.instanceId)), ...eliminatedHands],
        health: rewardedHealth,
        eliminations: player.eliminations + eliminatedCount,
        attackedThisRound: true,
        actedThisRound: true,
        actionsRemaining: Math.max(0, player.actionsRemaining - 1)
      };
    }

    if (damagedPlayerIds.includes(player.id)) {
      const damage = damageByPlayerId[player.id] ?? 0;
      const health = Math.max(0, player.health - damage);
      return {
        ...player,
        health,
        hand: health === 0 ? [] : player.hand,
        eliminated: health === 0
      };
    }

    return player;
  });
  let nextState: GameState = {
    ...state,
    players,
    discardPile: reloadActive ? state.discardPile : [...state.discardPile, weapon],
    reloadPlayerIds: reloadActive ? state.reloadPlayerIds.filter((playerId) => playerId !== attacker.id) : state.reloadPlayerIds,
    attackBonuses: omitKey(state.attackBonuses, attacker.id)
  };
  const winner = getWinner(nextState);
  const winnerTeamId = getWinningTeamId(nextState);
  const messages = [`${attacker.name} swept the field with Minigun for ${maxDamage} damage to each other player.`];

  players
    .filter((player) => damagedPlayerIds.includes(player.id) && player.eliminated)
    .forEach((player) => messages.push(`${player.name} was eliminated.`));
  const rewardGain = state.players.find((player) => player.id === attacker.id)
    ? (players.find((player) => player.id === attacker.id)?.health ?? attacker.health) - attacker.health
    : 0;
  if (rewardGain > 0) {
    messages.push(`${attacker.name} recovered ${rewardGain} health from elimination reward.`);
  }

  if (winner || winnerTeamId) {
    nextState = {
      ...nextState,
      phase: "gameOver",
      winnerId: winner?.id ?? players.find((player) => player.teamId === winnerTeamId && !player.eliminated)?.id ?? null,
      winnerTeamId
    };
    messages.push(winnerTeamId ? `${labelTeam(winnerTeamId)} is the last team standing.` : `${winner!.name} wins.`);
  }

  return {
    state: nextState,
    messages
  };
}

function applyEliminationHealthReward(health: number, eliminations: number, state: GameState): number {
  if (health <= 0 || eliminations <= 0 || state.settings.eliminationHealthReward <= 0) {
    return health;
  }

  return Math.min(state.settings.maxHealth, health + eliminations * state.settings.eliminationHealthReward);
}

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
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

function advanceBlackMarket(state: GameState): GameState {
  const pending = state.pendingBlackMarket;
  if (!pending) {
    return state;
  }

  const currentIndex = pending.currentIndex + 1;
  return {
    ...state,
    pendingBlackMarket:
      currentIndex >= pending.playerOrder.length
        ? null
        : {
            ...pending,
            currentIndex
          }
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
      actionsRemaining: currentPlayer.actionsRemaining + 2
    }));
    message = `${player.name} played Adrenaline, gained an action, and lost 2 health.`;
  }

  if (definitionId === "ability_steal" && target) {
    if (target.hand.length === 0) {
      return log(nextState, `${player.name} played Steal, but ${target.name} had no cards.`);
    }

    nextState = {
      ...nextState,
      pendingSteal: {
        playerId: player.id,
        targetPlayerId: target.id
      }
    };
    message = `${player.name} played Steal and must choose 1 card from ${target.name}.`;
  }

  if (definitionId === "ability_search") {
    const discardWithoutSearch = nextState.discardPile.filter((discardedCard) => discardedCard.instanceId !== card.instanceId);
    const searchDraw = drawCardsResolvingMixedEvents({ ...nextState, discardPile: discardWithoutSearch }, 3, player.id, true);
    nextState = {
      ...searchDraw.state,
      discardPile: [...searchDraw.state.discardPile, card],
      pendingSearch: {
        playerId: player.id,
        cards: searchDraw.drawn
      }
    };
    message = `${player.name} searched and must keep 1 of ${searchDraw.drawn.length} cards.`;
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

function enforceHandLimit(state: GameState, playerId: string): GameState {
  void playerId;
  return state;
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

  if (allowedIds.length === 0) {
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

function breakEliminationTie(players: PlayerState[]): PlayerState | null {
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
  return tied.length === 1 ? winner : null;
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
