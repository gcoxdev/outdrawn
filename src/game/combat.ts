import { allCards } from "../data/cards";
import type { CardDefinition, CardInstance, GameState, PendingReaction, PlayerState } from "./types";
import { getCardDefinitionById, getWinner } from "./rules";

export type AttackResult = {
  state: GameState;
  messages: string[];
};

export function resolveAttack(
  state: GameState,
  attacker: PlayerState,
  target: PlayerState,
  weapon: CardInstance,
  reaction: CardInstance | null
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
    state.round <= state.settings.openingDamageCapRounds ? state.settings.openingDamageCap : Number.POSITIVE_INFINITY
  );
  const reactionDefinition = getCardDefinitionById(reaction?.definitionId ?? "");
  const reactionResult = resolveReactionDamage(baseDamage, weaponDefinition, reactionDefinition);
  const damage = reactionResult.damage;
  const nextHealth = Math.max(0, target.health - damage);
  const eliminated = nextHealth === 0;
  let winnerId = state.winnerId;
  let phase = state.phase;
  const messages = [
    `${attacker.name} attacked ${target.name} with ${weaponDefinition.name} for ${damage} damage.`
  ];

  if (reaction && reactionDefinition) {
    messages.push(`${target.name} played ${reactionDefinition.name}.`);
  }

  if (reactionResult.message) {
    messages.push(reactionResult.message.replace("{defender}", target.name));
  }

  if (eliminated) {
    messages.push(`${target.name} was eliminated.`);
  }

  const players = state.players.map((player) => {
    if (player.id === attacker.id) {
      return {
        ...player,
        hand: player.hand.filter((card) => card.instanceId !== weapon.instanceId),
        attackedThisRound: true,
        actedThisRound: true,
        actionsRemaining: Math.max(0, player.actionsRemaining - 1),
        weaponCooldowns: player.weaponCooldowns
      };
    }

    if (player.id === target.id) {
      return {
        ...player,
        hand: reaction ? player.hand.filter((card) => card.instanceId !== reaction.instanceId) : player.hand,
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
      pendingReaction: null,
      discardPile: reaction ? [...nextState.discardPile, weapon, reaction] : [...nextState.discardPile, weapon],
      phase,
      winnerId
    },
    messages
  };
}

function resolveReactionDamage(
  baseDamage: number,
  weaponDefinition: CardDefinition,
  reactionDefinition: CardDefinition | undefined
): { damage: number; message: string | null } {
  if (!reactionDefinition) {
    return { damage: baseDamage, message: null };
  }

  if (reactionDefinition.id === "defense_dodge" || reactionDefinition.id === "defense_smoke_bomb") {
    return { damage: 0, message: "{defender} avoided the attack." };
  }

  if (reactionDefinition.id === "defense_brace") {
    return { damage: Math.floor(baseDamage / 2), message: "{defender} braced for impact." };
  }

  if (reactionDefinition.id === "defense_armor_vest" && weaponDefinition.ignoresArmor) {
    return { damage: baseDamage, message: "Armor Vest did not stop the piercing hit." };
  }

  const block = reactionDefinition.block ?? 0;
  if (block > 0) {
    return {
      damage: Math.max(0, baseDamage - block),
      message: `{defender} blocked ${block} damage.`
    };
  }

  return { damage: baseDamage, message: null };
}

export function createPendingReaction(
  state: GameState,
  attacker: PlayerState,
  target: PlayerState,
  weapon: CardInstance
): AttackResult {
  const weaponDefinition = getCardDefinitionById(weapon.definitionId);
  if (!weaponDefinition || weaponDefinition.type !== "weapon") {
    return { state, messages: [] };
  }

  const baseDamage = Math.min(
    weaponDefinition.damage ?? 0,
    state.round <= state.settings.openingDamageCapRounds ? state.settings.openingDamageCap : Number.POSITIVE_INFINITY
  );
  const pendingReaction: PendingReaction = {
    attackerId: attacker.id,
    defenderId: target.id,
    weapon,
    baseDamage
  };

  return {
    state: {
      ...state,
      pendingReaction
    },
    messages: [`${attacker.name} played ${weaponDefinition.name} targeting ${target.name}.`]
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
  const nextHealth = Math.min(state.settings.maxHealth, player.health + heal);
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
