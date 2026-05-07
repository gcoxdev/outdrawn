import { allCards } from "../data/cards";
import type { CardDefinition, CardInstance, GameState, PendingReaction, PlayerState } from "./types";
import { getCardDefinitionById, getWinner } from "./rules";
import { drawCardsWithRefill } from "./deck";

export type AttackResult = {
  state: GameState;
  messages: string[];
};

export type ResolveAttackOptions = {
  baseDamageOverride?: number;
  keepWeaponInHand?: boolean;
  spendAction?: boolean;
  clearAttackBonuses?: boolean;
};

export function resolveAttack(
  state: GameState,
  attacker: PlayerState,
  target: PlayerState,
  weapon: CardInstance,
  reaction: CardInstance | null,
  options: ResolveAttackOptions = {}
): AttackResult {
  const weaponDefinition = getCardDefinitionById(weapon.definitionId);
  if (!weaponDefinition || weaponDefinition.type !== "weapon") {
    return { state, messages: [] };
  }

  const baseDamage =
    options.baseDamageOverride ??
    Math.min(
      (weaponDefinition.damage ?? 0) +
        (state.attackBonuses[attacker.id] ?? 0) +
        (state.markedTargets[target.id] ?? 0) +
        getEventAttackBonus(state, attacker),
      state.round <= state.settings.openingDamageCapRounds ? state.settings.openingDamageCap : Number.POSITIVE_INFINITY
    );
  const reactionDefinition = getCardDefinitionById(reaction?.definitionId ?? "");
  const reactionResult = resolveReactionDamage(baseDamage, target.health, weaponDefinition, reactionDefinition, state.activeEvent?.card.definitionId);
  const damage = reactionResult.damage;
  const nextHealth = reactionResult.survivesLethal ? 1 : Math.max(0, target.health - damage);
  const eliminated = nextHealth === 0;
  const splashTargets = weaponDefinition.id === "weapon_grenade" ? getGrenadeSplashTargets(state.players, attacker.id, target.id) : [];
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
    reactionDefinition?.id === "defense_decoy"
      ? `${target.name} was hit by Ricochet with ${weaponDefinition.name} for ${damage} damage.`
      : `${attacker.name} attacked ${target.name} with ${weaponDefinition.name} for ${damage} damage.`
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

  splashTargets.forEach((splashTarget) => {
    const splashDamage = weaponDefinition.splashDamage ?? 0;
    messages.push(`${splashTarget.name} took ${splashDamage} splash damage from ${weaponDefinition.name}.`);
    if (splashTarget.health <= splashDamage) {
      messages.push(`${splashTarget.name} was eliminated by splash damage.`);
    }
  });

  const players = state.players.map((player) => {
    if (player.id === attacker.id) {
      const attackerHealth = Math.max(0, player.health - counterDamage);
      return {
        ...player,
        hand: [...(options.keepWeaponInHand ? player.hand : player.hand.filter((card) => card.instanceId !== weapon.instanceId)), ...loot],
        health: attackerHealth,
        eliminated: attackerHealth === 0,
        attackedThisRound: true,
        actedThisRound: true,
        actionsRemaining: options.spendAction === false ? player.actionsRemaining : Math.max(0, player.actionsRemaining - 1)
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

    const splashTarget = splashTargets.find((candidate) => candidate.id === player.id);
    if (splashTarget) {
      const splashHealth = Math.max(0, player.health - (weaponDefinition.splashDamage ?? 0));
      return {
        ...player,
        health: splashHealth,
        eliminated: splashHealth === 0
      };
    }

    return player;
  });
  let nextState = { ...state, players };
  if (shouldRewardBounty(state, target, damage)) {
    const bountyDraw = drawCardsWithRefill(nextState.mainDeck, nextState.discardPile, 1);
    nextState = {
      ...nextState,
      mainDeck: bountyDraw.mainDeck,
      discardPile: bountyDraw.discardPile,
      players: nextState.players.map((player) =>
        player.id === attacker.id
          ? {
              ...player,
              hand: [...player.hand, ...bountyDraw.drawn]
            }
          : player
      )
    };
    if (bountyDraw.drawn.length > 0) {
      messages.push(`${attacker.name} claimed the Bounty and drew 1 card.`);
    }
  }
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
      pendingRedirect: null,
      attackBonuses: options.clearAttackBonuses === false ? nextState.attackBonuses : omitKey(nextState.attackBonuses, attacker.id),
      smokeProtectedPlayerIds:
        reactionDefinition?.id === "defense_smoke_bomb"
          ? Array.from(new Set([...nextState.smokeProtectedPlayerIds, target.id]))
          : nextState.smokeProtectedPlayerIds,
      discardPile: [
        ...nextState.discardPile,
        ...(options.keepWeaponInHand ? [] : [weapon]),
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
  reactionDefinition: CardDefinition | undefined,
  activeEventId: string | undefined
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
    const prevented = baseDamage - Math.floor(baseDamage / 2);
    return {
      ...baseResult,
      damage: applyNoCover(baseDamage, prevented, activeEventId),
      message: "{defender} braced for impact."
    };
  }

  if (reactionDefinition.id === "defense_counterattack") {
    return { ...baseResult, counterDamage: reactionDefinition.damage ?? 3 };
  }

  if (reactionDefinition.id === "defense_backfire") {
    return {
      ...baseResult,
      damage: 0,
      counterDamage: baseDamage,
      message: "{defender} caused the attack to backfire."
    };
  }

  if (reactionDefinition.id === "defense_fake_death" && baseDamage >= defenderHealth) {
    return {
      ...baseResult,
      survivesLethal: true,
      discardsDefenderHand: true,
      message: "{defender} revived and survived at 1 health."
    };
  }

  if (reactionDefinition.id === "defense_armor_vest" && weaponDefinition.ignoresArmor) {
    return { ...baseResult, message: "Armor Vest did not stop the piercing hit." };
  }

  const block = reactionDefinition.block ?? 0;
  if (block > 0) {
    return {
      ...baseResult,
      damage: applyNoCover(baseDamage, block, activeEventId),
      message: `{defender} blocked ${block} damage.`
    };
  }

  return baseResult;
}

function applyNoCover(baseDamage: number, preventedDamage: number, activeEventId: string | undefined): number {
  const adjustedPrevention = activeEventId === "event_no_cover" ? Math.max(0, preventedDamage - 1) : preventedDamage;
  return Math.max(0, baseDamage - adjustedPrevention);
}

function getEventAttackBonus(state: GameState, attacker: PlayerState): number {
  if (state.activeEvent?.card.definitionId === "event_high_ground" && !attacker.attackedThisRound) {
    return 1;
  }

  return 0;
}

function shouldRewardBounty(state: GameState, target: PlayerState, damage: number): boolean {
  if (state.activeEvent?.card.definitionId !== "event_bounty" || damage <= 0) {
    return false;
  }

  const highestHealth = Math.max(...state.players.filter((player) => !player.eliminated).map((player) => player.health));
  return target.health === highestHealth;
}

function getGrenadeSplashTargets(players: PlayerState[], attackerId: string, targetId: string): PlayerState[] {
  const livingPlayers = players.filter((player) => !player.eliminated);
  if (livingPlayers.length <= 2) {
    return [];
  }

  const targetIndex = players.findIndex((player) => player.id === targetId);
  const clockwise = findNearestSplashTarget(players, targetIndex, 1, attackerId, targetId);
  const counterClockwise = findNearestSplashTarget(players, targetIndex, -1, attackerId, targetId);
  const targets = [clockwise, counterClockwise].filter((player): player is PlayerState => Boolean(player));
  return targets.filter((player, index) => targets.findIndex((target) => target.id === player.id) === index);
}

function findNearestSplashTarget(
  players: PlayerState[],
  targetIndex: number,
  direction: 1 | -1,
  attackerId: string,
  targetId: string
): PlayerState | null {
  for (let offset = 1; offset < players.length; offset += 1) {
    const index = (targetIndex + offset * direction + players.length) % players.length;
    const candidate = players[index];
    if (!candidate.eliminated && candidate.id !== attackerId && candidate.id !== targetId) {
      return candidate;
    }
  }

  return null;
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
    (weaponDefinition.damage ?? 0) +
      (state.attackBonuses[attacker.id] ?? 0) +
      (state.markedTargets[target.id] ?? 0) +
      getEventAttackBonus(state, attacker),
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
