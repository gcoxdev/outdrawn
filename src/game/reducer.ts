import { allCards } from "../data/cards";
import { ACTIONS_PER_TURN } from "../data/constants";
import { drawCards } from "./deck";
import type { GameAction } from "./actions";
import { createNewGame } from "./setup";
import type { CardInstance, GameState, PlayerState } from "./types";
import { resolveAttack, resolveHealing } from "./combat";
import {
  canPlayerAct,
  getCardDefinitionById,
  getCardFromPlayer,
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

function removeFromHand(player: PlayerState, card: CardInstance): PlayerState {
  return {
    ...player,
    hand: player.hand.filter((handCard) => handCard.instanceId !== card.instanceId)
  };
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
  const startIndex = nextRound ? firstPlayerIndex : state.currentPlayerIndex;
  const currentPlayerIndex = findNextLivingIndex(state.players, startIndex);

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
      actionsRemaining: index === currentPlayerIndex ? ACTIONS_PER_TURN : player.actionsRemaining
    };
  });

  const advanced = {
    ...state,
    round: nextRound ? state.round + 1 : state.round,
    players,
    firstPlayerIndex,
    currentPlayerIndex
  };

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

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_GAME":
      return createNewGame(action.playerNames);
    case "SELECT_CARD":
      return { ...state, selectedCardId: action.cardInstanceId };
    case "DRAW_CARD": {
      if (!canPlayerAct(state, action.playerId) || state.mainDeck.length === 0) {
        return state;
      }

      const draw = drawCards(state.mainDeck, 1);
      let nextState = {
        ...state,
        mainDeck: draw.deck
      };
      nextState = updatePlayer(nextState, action.playerId, (player) => ({
        ...player,
        hand: [...player.hand, ...draw.drawn]
      }));
      nextState = spendAction(nextState, action.playerId);
      return log(nextState, `${getCurrentPlayer(state).name} drew 1 card.`);
    }
    case "EQUIP_CARD": {
      if (!canPlayerAct(state, action.playerId)) {
        return state;
      }

      const player = getCurrentPlayer(state);
      const card = player.hand.find((handCard) => handCard.instanceId === action.cardInstanceId);
      const definition = card ? getCardDefinitionById(card.definitionId) : undefined;

      if (!card || !definition || (definition.type !== "weapon" && !definition.isEquip)) {
        return state;
      }

      let replaced: CardInstance | null = null;
      let nextState = updatePlayer(state, action.playerId, (currentPlayer) => {
        const withoutCard = removeFromHand(currentPlayer, card);

        if (definition.type === "weapon") {
          replaced = withoutCard.equippedWeapon;
          return {
            ...withoutCard,
            equippedWeapon: card,
            hand: replaced ? [...withoutCard.hand, replaced] : withoutCard.hand
          };
        }

        replaced = withoutCard.equippedDefense;
        return {
          ...withoutCard,
          equippedDefense: card,
          hand: replaced ? [...withoutCard.hand, replaced] : withoutCard.hand
        };
      });
      nextState = spendAction(nextState, action.playerId);
      return log(nextState, `${player.name} equipped ${definition.name}.`);
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

      if ((definition.heal ?? 0) > 0 && player.health >= 20 && !definition.draw) {
        return state;
      }

      const result = resolveHealing(state, player, card, definition);
      return result.messages.reduce((nextState, message) => log(nextState, message), result.state);
    }
    case "ATTACK": {
      if (!canPlayerAct(state, action.attackerId)) {
        return state;
      }

      const attacker = getCurrentPlayer(state);
      const target = getPlayer(state, action.targetPlayerId);
      const weapon = getCardFromPlayer(attacker, action.weaponInstanceId);

      if (!target || target.eliminated || target.id === attacker.id || !weapon) {
        return state;
      }

      if (attacker.equippedWeapon?.instanceId !== weapon.instanceId) {
        return state;
      }

      const result = resolveAttack(state, attacker, target, weapon);
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
