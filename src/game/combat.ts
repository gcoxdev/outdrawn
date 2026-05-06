import { allCards } from "../data/cards";
import { MAX_HEALTH, OPENING_DAMAGE_CAP, OPENING_DAMAGE_CAP_ROUNDS } from "../data/constants";
import type { CardDefinition, CardInstance, GameState, PlayerState } from "./types";
import { getCardDefinitionById, getWinner } from "./rules";

export type AttackResult = {
  state: GameState;
  messages: string[];
};

export function resolveAttack(
  state: GameState,
  attacker: PlayerState,
  target: PlayerState,
  weapon: CardInstance
): AttackResult {
  const weaponDefinition = getCardDefinitionById(weapon.definitionId);
  if (!weaponDefinition || weaponDefinition.type !== "weapon") {
    return { state, messages: [] };
  }

  if (attacker.weaponCooldowns[weapon.instanceId] > 0) {
    return { state, messages: [`${weaponDefinition.name} is on cooldown.`] };
  }

  const baseDamage = Math.min(
    weaponDefinition.damage ?? 0,
    state.round <= OPENING_DAMAGE_CAP_ROUNDS ? OPENING_DAMAGE_CAP : Number.POSITIVE_INFINITY
  );
  const armorDefinition = getCardDefinitionById(target.equippedDefense?.definitionId ?? "");
  const armorBlock =
    armorDefinition?.id === "defense_armor_vest" && !weaponDefinition.ignoresArmor ? (armorDefinition.block ?? 0) : 0;
  const damage = Math.max(0, baseDamage - armorBlock);
  const nextHealth = Math.max(0, target.health - damage);
  const eliminated = nextHealth === 0;
  let winnerId = state.winnerId;
  let phase = state.phase;
  const messages = [
    `${attacker.name} attacked ${target.name} with ${weaponDefinition.name} for ${damage} damage.`
  ];

  if (armorBlock > 0) {
    messages.push(`${target.name}'s Armor Vest blocked ${armorBlock}.`);
  }

  if (eliminated) {
    messages.push(`${target.name} was eliminated.`);
  }

  const players = state.players.map((player) => {
    if (player.id === attacker.id) {
      return {
        ...player,
        attackedThisRound: true,
        actedThisRound: true,
        actionsRemaining: Math.max(0, player.actionsRemaining - 1),
        weaponCooldowns: weaponDefinition.cooldownTurns
          ? {
              ...player.weaponCooldowns,
              [weapon.instanceId]: weaponDefinition.cooldownTurns
            }
          : player.weaponCooldowns
      };
    }

    if (player.id === target.id) {
      return {
        ...player,
        health: nextHealth,
        eliminated
      };
    }

    return player;
  });
  const nextState = { ...state, players };
  const winner = getWinner(nextState);

  if (winner) {
    winnerId = winner.id;
    phase = "gameOver";
    messages.push(`${winner.name} is the last hand standing.`);
  }

  return {
    state: {
      ...nextState,
      phase,
      winnerId
    },
    messages
  };
}

export function resolveHealing(
  state: GameState,
  player: PlayerState,
  card: CardInstance,
  definition: CardDefinition
): AttackResult {
  const heal = definition.heal ?? 0;
  const draw = definition.draw ?? 0;
  const actionsCost = definition.actionsCost ?? 1;
  const nextHealth = Math.min(MAX_HEALTH, player.health + heal);
  const drawn = state.mainDeck.slice(0, draw);
  const deck = state.mainDeck.slice(draw);
  const messages = [`${player.name} played ${definition.name} and healed ${nextHealth - player.health}.`];

  return {
    state: {
      ...state,
      mainDeck: deck,
      discardPile: [...state.discardPile, card],
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? {
              ...candidate,
              health: nextHealth,
              hand: [...candidate.hand.filter((handCard) => handCard.instanceId !== card.instanceId), ...drawn],
              actionsRemaining: Math.max(0, candidate.actionsRemaining - actionsCost),
              actedThisRound: true
            }
          : candidate
      )
    },
    messages
  };
}

export function isHealingDefinition(definition: CardDefinition | undefined): definition is CardDefinition {
  return Boolean(definition && allCards.includes(definition) && definition.type === "healing");
}
