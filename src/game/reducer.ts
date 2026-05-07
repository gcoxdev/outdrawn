import { allCards } from "../data/cards";
import { drawCardsWithRefill } from "./deck";
import type { CardInstance, PlayerId } from "./types";
import type { GameAction } from "./actions";
import { createNewGame } from "./setup";
import type { GameState, PlayerState } from "./types";
import { createPendingReaction, resolveAttack, resolveHealing } from "./combat";
import {
  canPlayerAct,
  getCardDefinitionById,
  getCurrentPlayer,
  getPlayer,
  getWinner
} from "./rules";

function log(state: GameState, message: string): GameState {
  return {
    ...state,
    log: [
      ...state.log,
      {
        id: `log_${state.log.length + 1}_${Date.now()}`,
        round: state.round,
        message,
        handSnapshots: shouldCaptureHandSnapshots(state) ? getHandSnapshots(state) : []
      }
    ]
  };
}

function shouldCaptureHandSnapshots(state: GameState): boolean {
  return import.meta.env.DEV && state.settings.debugHandSnapshots;
}

function getHandSnapshots(state: GameState): GameState["log"][number]["handSnapshots"] {
  return state.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    health: player.health,
    cards: player.hand.map((card) => ({ ...card }))
  }));
}

function refreshLogSnapshots(state: GameState): GameState {
  return {
    ...state,
    log: state.log.map((entry) => ({
      ...entry,
      handSnapshots: []
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
  if (livingPlayers.length <= 1) {
    const winner = getWinner(state);
    return {
      ...state,
      phase: "gameOver",
      winnerId: winner?.id ?? null
    };
  }

  const allLivingActed = state.players.every((player) => player.eliminated || player.actedThisRound);
  const nextRound = allLivingActed;
  const collapseState = nextRound ? logPlayerHealthChanges(state.players, applyCollapseDamage(state), "collapse") : state;
  const pressureState =
    nextRound && collapseState.activeEvent?.card.definitionId === "event_pressure_zone"
      ? logPlayerHealthChanges(collapseState.players, applyPressureZone(collapseState), "Pressure Zone")
      : collapseState;
  const nextEventDefinition = nextRound ? getCardDefinitionById(pressureState.eventDeck[0]?.definitionId ?? "") : undefined;
  const transitionState = nextRound
    ? logPlayerHealthChanges(pressureState.players, resolveRoundTransition(pressureState), nextEventDefinition?.name ?? "event")
    : state;
  const livingAfterTransition = transitionState.players.filter((player) => !player.eliminated);
  const postTransitionWinner = getWinner(transitionState);
  if (livingAfterTransition.length <= 1) {
    const tiebreaker = postTransitionWinner ?? breakEliminationTie(state.players);
    return {
      ...transitionState,
      phase: "gameOver",
      winnerId: tiebreaker?.id ?? null
    };
  }

  const firstPlayerIndex = nextRound
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
      ? `Round ${advanced.round} begins. Event: ${nextEventDefinition?.name ?? "none"}. ${advanced.players[currentPlayerIndex].name} is up.`
      : `${advanced.players[currentPlayerIndex].name} is up.`
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

function resolveRoundTransition(state: GameState): GameState {
  const stateWithoutExpiredEvent = state.activeEvent
    ? {
        ...state,
        activeEvent: null,
        eventDiscardPile: [...state.eventDiscardPile, state.activeEvent.card]
      }
    : state;
  const [eventCard, ...eventDeck] = stateWithoutExpiredEvent.eventDeck;
  const eventDefinition = eventCard ? getCardDefinitionById(eventCard.definitionId) : undefined;

  if (!eventCard || !eventDefinition || eventDefinition.type !== "event") {
    return stateWithoutExpiredEvent;
  }

  if (eventDefinition.timing === "immediate") {
    return applyImmediateEvent({
      ...stateWithoutExpiredEvent,
      eventDeck,
      eventDiscardPile: [...stateWithoutExpiredEvent.eventDiscardPile, eventCard]
    }, eventDefinition.id);
  }

  if (eventDefinition.timing === "thisRound" || eventDefinition.timing === "ongoing") {
    return {
      ...stateWithoutExpiredEvent,
      eventDeck,
      activeEvent: {
        card: eventCard,
        timing: eventDefinition.timing
      }
    };
  }

  return {
    ...stateWithoutExpiredEvent,
    eventDeck,
    eventDiscardPile: [...stateWithoutExpiredEvent.eventDiscardPile, eventCard]
  };
}

function applyImmediateEvent(state: GameState, eventId: string): GameState {
  if (eventId === "event_supply_drop") {
    const reveal = drawCardsWithRefill(state.mainDeck, state.discardPile, 3);
    return {
      ...state,
      mainDeck: reveal.mainDeck,
      discardPile: reveal.discardPile,
      pendingSupplyDrop: {
        playerOrder: [...state.players]
          .filter((player) => !player.eliminated)
          .sort((left, right) => left.health - right.health)
          .map((player) => player.id),
        currentIndex: 0,
        revealedCards: reveal.drawn
      }
    };
  }

  if (eventId === "event_low_ammo") {
    const discardedWeapons: CardInstance[] = [];
    const players = state.players.map((player) => {
      if (player.eliminated) {
        return player;
      }

      const weapon = getHighestDamageWeapon(player.hand);
      if (!weapon) {
        const health = Math.max(0, player.health - 3);
        return {
          ...player,
          health,
          eliminated: health === 0
        };
      }

      discardedWeapons.push(weapon);
      return {
        ...player,
        hand: player.hand.filter((card) => card.instanceId !== weapon.instanceId)
      };
    });

    return {
      ...state,
      players,
      discardPile: [...state.discardPile, ...discardedWeapons]
    };
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

  return state;
}

function applyPressureZone(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.eliminated || player.attackedThisRound) {
        return player;
      }

      const health = Math.max(0, player.health - 1);
      return {
        ...player,
        health,
        eliminated: health === 0
      };
    })
  };
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

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_GAME":
      return createNewGame(action.playerSetups ?? action.playerNames, Math.random, action.settings ?? state.settings);
    case "UPDATE_SETTINGS":
      if (!action.settings.debugHandSnapshots) {
        return refreshLogSnapshots({ ...state, settings: action.settings });
      }

      if (!state.settings.debugHandSnapshots) {
        return log({ ...state, settings: action.settings }, "Debug hand snapshots enabled.");
      }

      return { ...state, settings: action.settings };
    case "SELECT_CARD":
      return { ...state, selectedCardId: action.cardInstanceId };
    case "DRAW_CARD": {
      if (!canPlayerAct(state, action.playerId) || (state.mainDeck.length === 0 && state.discardPile.length === 0)) {
        return state;
      }

      const draw = drawCardsWithRefill(state.mainDeck, state.discardPile, 1);
      let nextState = {
        ...state,
        mainDeck: draw.mainDeck,
        discardPile: draw.discardPile
      };
      nextState = updatePlayer(nextState, action.playerId, (player) => ({
        ...player,
        hand: [...player.hand, ...draw.drawn]
      }));
      nextState = spendAction(nextState, action.playerId);
      return log(nextState, `${getCurrentPlayer(state).name} drew 1 card.`);
    }
    case "DISCARD_CARD": {
      const player = getPlayer(state, action.playerId);
      const card = player?.hand.find((handCard) => handCard.instanceId === action.cardInstanceId);

      if (!player || !card || state.pendingReaction || state.pendingRedirect || state.pendingAttackCost || state.pendingMultiHitAttack) {
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
    case "RESOLVE_PENDING_DISCARD": {
      const pendingDiscard = state.pendingDiscard;
      const player = pendingDiscard ? getPlayer(state, pendingDiscard.playerId) : undefined;

      if (!pendingDiscard || !player || action.playerId !== player.id) {
        return state;
      }

      const selectedIds = action.cardInstanceIds.slice(0, pendingDiscard.count);
      if (selectedIds.length < Math.min(pendingDiscard.count, player.hand.length)) {
        return state;
      }

      const selected = player.hand.filter((card) => selectedIds.includes(card.instanceId));
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

      return log(nextState, `${player.name} discarded ${selected.length} cards for ${pendingDiscard.reason}.`);
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
      if (!canPlayerAct(state, action.playerId) || state.activeEvent?.card.definitionId !== "event_black_market") {
        return state;
      }

      const player = getCurrentPlayer(state);
      const selectedIds = action.cardInstanceIds.slice(0, 2);
      const selected = player.hand.filter((card) => selectedIds.includes(card.instanceId));

      if (selected.length !== 2 || new Set(selectedIds).size !== 2) {
        return state;
      }

      const reveal = drawCardsWithRefill(state.mainDeck, state.discardPile, 3);
      const nextState = {
        ...state,
        mainDeck: reveal.mainDeck,
        discardPile: [...reveal.discardPile, ...selected],
        pendingMarketSearch: {
          playerId: player.id,
          cards: reveal.drawn
        },
        players: state.players.map((candidate) =>
          candidate.id === player.id
            ? {
                ...candidate,
                hand: candidate.hand.filter((card) => !selectedIds.includes(card.instanceId)),
                actionsRemaining: Math.max(0, candidate.actionsRemaining - 1),
                actedThisRound: true
              }
            : candidate
        )
      };

      return log(nextState, `${player.name} used the Black Market and must choose 1 card.`);
    }
    case "RESOLVE_MARKET_SEARCH": {
      const pending = state.pendingMarketSearch;
      const player = pending ? getPlayer(state, pending.playerId) : undefined;
      const kept = pending?.cards.find((card) => card.instanceId === action.keepCardInstanceId);

      if (!pending || !player || action.playerId !== player.id || !kept) {
        return state;
      }

      const discarded = pending.cards.filter((card) => card.instanceId !== kept.instanceId);
      const nextState = {
        ...state,
        pendingMarketSearch: null,
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

      return log(enforceHandLimit(nextState, player.id), `${player.name} bought 1 Black Market card and discarded ${discarded.length}.`);
    }
    case "PLAY_HEALING": {
      if (!canPlayerAct(state, action.playerId)) {
        return state;
      }

      const player = getCurrentPlayer(state);
      const card = player.hand.find((handCard) => handCard.instanceId === action.cardInstanceId);
      const definition = card ? getCardDefinitionById(card.definitionId) : undefined;

      if (!card || !definition || definition.type !== "healing" || player.actionsRemaining < (definition.actionsCost ?? 1)) {
        return state;
      }

      if ((definition.heal ?? 0) > 0 && player.health >= state.settings.maxHealth && !definition.draw) {
        return state;
      }

      const result = resolveHealing(state, player, card, definition);
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

      if (definition.target === "onePlayer" && (!target || target.eliminated || target.id === player.id)) {
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
        target.id === defender.id
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
        !weapon ||
        weaponDefinition?.type !== "weapon"
      ) {
        return state;
      }

      if (weaponDefinition.id === "weapon_minigun") {
        const result = resolveMinigunAttack(state, attacker, weapon);
        return result.messages.reduce((nextState, message) => log(nextState, message), result.state);
      }

      if (!target || target.eliminated || target.id === attacker.id || state.smokeProtectedPlayerIds.includes(target.id)) {
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
        return log(
          {
            ...state,
            pendingReaction: {
              attackerId: attacker.id,
              defenderId: target.id,
              weapon,
              baseDamage: 2
            },
            pendingMultiHitAttack: {
              attackerId: attacker.id,
              defenderId: target.id,
              weapon,
              hitsRemaining: 2,
              hitDamage: 2
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

  if (!multiHit || multiHit.weapon.instanceId !== weapon.instanceId) {
    const result = resolveAttack(state, attacker, defender, weapon, reaction, {
      keepWeaponInHand: reloadActive
    });
    return reloadActive ? { ...result, state: consumeReload(result.state, attacker.id) } : result;
  }

  const isFinalHit = multiHit.hitsRemaining <= 1;
  const result = resolveAttack(state, attacker, defender, weapon, reaction, {
    baseDamageOverride: multiHit.hitDamage,
    keepWeaponInHand: !isFinalHit || reloadActive,
    spendAction: multiHit.hitsRemaining === 2,
    clearAttackBonuses: isFinalHit
  });
  const nextDefender = getPlayer(result.state, defender.id);
  const shouldContinue =
    !isFinalHit &&
    nextDefender &&
    !nextDefender.eliminated &&
    !result.state.smokeProtectedPlayerIds.includes(defender.id) &&
    result.state.phase !== "gameOver";

  if (!shouldContinue || !nextDefender) {
    return {
      ...result,
      state: {
        ...result.state,
        reloadPlayerIds: isFinalHit ? result.state.reloadPlayerIds.filter((playerId) => playerId !== attacker.id) : result.state.reloadPlayerIds,
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

function resolveMinigunAttack(state: GameState, attacker: PlayerState, weapon: CardInstance) {
  const weaponDefinition = getCardDefinitionById(weapon.definitionId);
  const damage = weaponDefinition?.damage ?? 1;
  const reloadActive = state.reloadPlayerIds.includes(attacker.id);
  const damagedPlayerIds = state.players
    .filter((player) => !player.eliminated && player.id !== attacker.id && !state.smokeProtectedPlayerIds.includes(player.id))
    .map((player) => player.id);
  const eliminatedHands = state.players
    .filter((player) => damagedPlayerIds.includes(player.id) && player.health <= damage)
    .flatMap((player) => player.hand);
  const eliminatedCount = state.players.filter((player) => damagedPlayerIds.includes(player.id) && player.health <= damage).length;
  const players = state.players.map((player) => {
    if (player.id === attacker.id) {
      return {
        ...player,
        hand: [...(reloadActive ? player.hand : player.hand.filter((card) => card.instanceId !== weapon.instanceId)), ...eliminatedHands],
        eliminations: player.eliminations + eliminatedCount,
        attackedThisRound: true,
        actedThisRound: true,
        actionsRemaining: Math.max(0, player.actionsRemaining - 1)
      };
    }

    if (damagedPlayerIds.includes(player.id)) {
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
  const messages = [`${attacker.name} swept the field with Minigun for ${damage} damage to each other player.`];

  players
    .filter((player) => damagedPlayerIds.includes(player.id) && player.eliminated)
    .forEach((player) => messages.push(`${player.name} was eliminated.`));

  if (winner) {
    nextState = {
      ...nextState,
      phase: "gameOver",
      winnerId: winner.id
    };
    messages.push(`${winner.name} is the last hand standing.`);
  }

  return {
    state: nextState,
    messages
  };
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
    const stolen = target.hand[0];
    if (!stolen) {
      return log(nextState, `${player.name} played Steal, but ${target.name} had no cards.`);
    }

    nextState = {
      ...nextState,
      players: nextState.players.map((candidate) => {
        if (candidate.id === player.id) {
          return { ...candidate, hand: [...candidate.hand, stolen] };
        }

        if (candidate.id === target.id) {
          return { ...candidate, hand: candidate.hand.filter((handCard) => handCard.instanceId !== stolen.instanceId) };
        }

        return candidate;
      })
    };
    message = `${player.name} stole 1 card from ${target.name}.`;
  }

  if (definitionId === "ability_search") {
    const discardWithoutSearch = nextState.discardPile.filter((discardedCard) => discardedCard.instanceId !== card.instanceId);
    const searchDraw = drawCardsWithRefill(nextState.mainDeck, discardWithoutSearch, 3);
    nextState = {
      ...nextState,
      mainDeck: searchDraw.mainDeck,
      discardPile: [...searchDraw.discardPile, card],
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
  const player = getPlayer(state, playerId);
  if (!player || player.hand.length <= state.settings.maxHandSize || state.pendingDiscard) {
    return state;
  }

  return {
    ...state,
    pendingDiscard: {
      sourcePlayerId: playerId,
      playerId,
      count: player.hand.length - state.settings.maxHandSize,
      reason: "hand limit"
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
