import { allCards } from "../data/cards";
import type { CardDefinition, CardInstance, GameState, PendingReaction, PlayerState } from "./types";
import { getCardDefinitionById, getWinner } from "./rules";
import { drawCardsWithRefill } from "./deck";

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
    (weaponDefinition.damage ?? 0) + (state.attackBonuses[attacker.id] ?? 0) + (state.markedTargets[target.id] ?? 0),
    state.round <= state.settings.openingDamageCapRounds ? state.settings.openingDamageCap : Number.POSITIVE_INFINITY
  );
  const reactionDefinition = getCardDefinitionById(reaction?.definitionId ?? "");
  const reactionResult = resolveReactionDamage(baseDamage, target.health, weaponDefinition, reactionDefinition);
  const damage = reactionResult.damage;
  const nextHealth = reactionResult.survivesLethal ? 1 : Math.max(0, target.health - damage);
  const eliminated = nextHealth === 0;
  const counterDamage = reactionResult.counterDamage;
  const targetHandAfterReaction = reactionResult.discardsDefenderHand
    ? []
    : reaction
      ? target.hand.filter((card) => card.instanceId !== reaction.instanceId)
      : target.hand;
  const loot = eliminated ? targetHandAfterReaction : [];
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

  if (counterDamage > 0) {
    messages.push(`${target.name} counterattacked ${attacker.name} for ${counterDamage} damage.`);
  }

  if (eliminated) {
    messages.push(`${target.name} was eliminated.`);
  }

  const players = state.players.map((player) => {
    if (player.id === attacker.id) {
      const attackerHealth = Math.max(0, player.health - counterDamage);
      return {
        ...player,
        hand: [...player.hand.filter((card) => card.instanceId !== weapon.instanceId), ...loot],
        health: attackerHealth,
        eliminated: attackerHealth === 0,
        attackedThisRound: true,
        actedThisRound: true,
        actionsRemaining: Math.max(0, player.actionsRemaining - 1),
        weaponCooldowns: player.weaponCooldowns
      };
    }

    if (player.id === target.id) {
      return {
        ...player,
        hand: eliminated ? [] : targetHandAfterReaction,
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
      attackBonuses: omitKey(nextState.attackBonuses, attacker.id),
      smokeProtectedPlayerIds:
        reactionDefinition?.id === "defense_smoke_bomb"
          ? Array.from(new Set([...nextState.smokeProtectedPlayerIds, target.id]))
          : nextState.smokeProtectedPlayerIds,
      discardPile: [
        ...nextState.discardPile,
        weapon,
        ...(reaction ? [reaction] : []),
        ...(reactionResult.discardsDefenderHand ? target.hand.filter((card) => card.instanceId !== reaction?.instanceId) : [])
      ],
      phase,
      winnerId
    },
    messages
  };
}

function resolveReactionDamage(
  baseDamage: number,
  defenderHealth: number,
  weaponDefinition: CardDefinition,
  reactionDefinition: CardDefinition | undefined
): {
  damage: number;
  counterDamage: number;
  survivesLethal: boolean;
  discardsDefenderHand: boolean;
  message: string | null;
} {
  const baseResult = {
    damage: baseDamage,
    counterDamage: 0,
    survivesLethal: false,
    discardsDefenderHand: false,
    message: null
  };

  if (!reactionDefinition) {
    return baseResult;
  }

  if (reactionDefinition.id === "defense_dodge" || reactionDefinition.id === "defense_smoke_bomb") {
    return { ...baseResult, damage: 0, message: "{defender} avoided the attack." };
  }

  if (reactionDefinition.id === "defense_brace") {
    return { ...baseResult, damage: Math.floor(baseDamage / 2), message: "{defender} braced for impact." };
  }

  if (reactionDefinition.id === "defense_counterattack") {
    return { ...baseResult, counterDamage: reactionDefinition.damage ?? 3 };
  }

  if (reactionDefinition.id === "defense_fake_death" && baseDamage >= defenderHealth) {
    return {
      ...baseResult,
      survivesLethal: true,
      discardsDefenderHand: true,
      message: "{defender} faked death and survived at 1 health."
    };
  }

  if (reactionDefinition.id === "defense_armor_vest" && weaponDefinition.ignoresArmor) {
    return { ...baseResult, message: "Armor Vest did not stop the piercing hit." };
  }

  const block = reactionDefinition.block ?? 0;
  if (block > 0) {
    return {
      ...baseResult,
      damage: Math.max(0, baseDamage - block),
      message: `{defender} blocked ${block} damage.`
    };
  }

  return baseResult;
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
    (weaponDefinition.damage ?? 0) + (state.attackBonuses[attacker.id] ?? 0) + (state.markedTargets[target.id] ?? 0),
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

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
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
  const deckDraw = drawCardsWithRefill(state.mainDeck, state.discardPile, draw);
  const messages = [`${player.name} played ${definition.name} and healed ${nextHealth - player.health}.`];

  return {
    state: {
      ...state,
      mainDeck: deckDraw.mainDeck,
      discardPile: [...deckDraw.discardPile, card],
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? {
              ...candidate,
              health: nextHealth,
              hand: [...candidate.hand.filter((handCard) => handCard.instanceId !== card.instanceId), ...deckDraw.drawn],
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
