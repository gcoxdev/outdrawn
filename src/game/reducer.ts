import { allCards } from "../data/cards";
import { drawCards } from "./deck";
import type { CardInstance } from "./types";
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
        message
      }
    ]
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
  const firstPlayerIndex = nextRound
    ? findNextLivingIndex(state.players, state.firstPlayerIndex)
    : state.firstPlayerIndex;
  const currentPlayerIndex = nextRound ? firstPlayerIndex : findNextLivingIndex(state.players, state.currentPlayerIndex);

  const players = state.players.map((player, index) => {
    const resetForRound = nextRound
      ? {
          actedThisRound: false,
          attackedThisRound: false,
          weaponCooldowns: decrementCooldowns(player.weaponCooldowns)
        }
      : {};

    return {
      ...player,
      ...resetForRound,
      actionsRemaining: index === currentPlayerIndex ? state.settings.actionsPerTurn : player.actionsRemaining
    };
  });

  const advanced = {
    ...state,
    round: nextRound ? state.round + 1 : state.round,
    players,
    firstPlayerIndex,
    currentPlayerIndex,
    markedTargets: nextRound ? {} : state.markedTargets
  };
  advanced.smokeProtectedPlayerIds = advanced.smokeProtectedPlayerIds.filter(
    (playerId) => playerId !== advanced.players[currentPlayerIndex].id
  );

  return log(
    advanced,
    nextRound
      ? `Round ${advanced.round} begins. ${advanced.players[currentPlayerIndex].name} is up.`
      : `${advanced.players[currentPlayerIndex].name} is up.`
  );
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

function decrementCooldowns(cooldowns: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(cooldowns)
      .map(([id, turns]) => [id, turns - 1] as const)
      .filter(([, turns]) => turns > 0)
  );
}

function currentPlayerOverHandLimit(state: GameState): boolean {
  return getCurrentPlayer(state).hand.length > state.settings.maxHandSize;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_GAME":
      return createNewGame(action.playerNames, Math.random, action.settings ?? state.settings);
    case "UPDATE_SETTINGS":
      return { ...state, settings: action.settings };
    case "SELECT_CARD":
      return { ...state, selectedCardId: action.cardInstanceId };
    case "DRAW_CARD": {
      if (!canPlayerAct(state, action.playerId) || (state.mainDeck.length === 0 && state.discardPile.length === 0)) {
        return state;
      }

      const deckState = refillDeckIfNeeded(state);
      const draw = drawCards(deckState.mainDeck, 1);
      let nextState = {
        ...deckState,
        mainDeck: draw.deck,
        discardPile: deckState.discardPile
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

      if (!player || !card || state.pendingReaction) {
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
    case "PLAY_HEALING": {
      if (!canPlayerAct(state, action.playerId)) {
        return state;
      }

      const player = getCurrentPlayer(state);
      const card = player.hand.find((handCard) => handCard.instanceId === action.cardInstanceId);
      const definition = card ? getCardDefinitionById(card.definitionId) : undefined;

      if (!card || !definition || definition.type !== "healing") {
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
    case "ATTACK": {
      if (!canPlayerAct(state, action.attackerId)) {
        return state;
      }

      const attacker = getCurrentPlayer(state);
      const target = getPlayer(state, action.targetPlayerId);
      const weapon = attacker.hand.find((card) => card.instanceId === action.weaponInstanceId);
      const weaponDefinition = weapon ? getCardDefinitionById(weapon.definitionId) : undefined;

      if (
        !target ||
        target.eliminated ||
        target.id === attacker.id ||
        state.smokeProtectedPlayerIds.includes(target.id) ||
        !weapon ||
        weaponDefinition?.type !== "weapon"
      ) {
        return state;
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
        reactionDefinition?.type !== "defense"
      ) {
        return state;
      }

      if (reactionDefinition.id === "defense_fake_death" && pending.baseDamage < defender.health) {
        return state;
      }

      const result = resolveAttack(state, attacker, defender, pending.weapon, reaction);
      return result.messages.reduce((nextState, message) => log(nextState, message), result.state);
    }
    case "SKIP_REACTION": {
      const pending = state.pendingReaction;
      const defender = pending ? getPlayer(state, pending.defenderId) : undefined;
      const attacker = pending ? getPlayer(state, pending.attackerId) : undefined;

      if (!pending || !defender || !attacker || action.defenderId !== defender.id) {
        return state;
      }

      const result = resolveAttack(state, attacker, defender, pending.weapon, null);
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
      return advanceTurn(log(ended, `${getCurrentPlayer(state).name} ended their turn.`));
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

  return log(nextState, message);
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

function refillDeckIfNeeded(state: GameState): GameState {
  if (state.mainDeck.length > 0 || state.discardPile.length === 0) {
    return state;
  }

  return {
    ...state,
    mainDeck: state.discardPile,
    discardPile: []
  };
}
