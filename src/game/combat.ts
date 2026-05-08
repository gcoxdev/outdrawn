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
  resolveSplash?: boolean;
};

function getBaseAttackDamage(state: GameState, attacker: PlayerState, target: PlayerState, weaponDefinition: CardDefinition): number {
  return (
    (weaponDefinition.damage ?? 0) +
    (state.attackBonuses[attacker.id] ?? 0) +
    (state.markedTargets[target.id] ?? 0) +
    getEventAttackBonus(state, attacker)
  );
}

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

  const baseDamage = options.baseDamageOverride ?? getBaseAttackDamage(state, attacker, target, weaponDefinition);
  const reactionDefinition = getCardDefinitionById(reaction?.definitionId ?? "");
  const reactionResult = resolveReactionDamage(baseDamage, target.health, weaponDefinition, reactionDefinition, state.activeEvent?.card.definitionId);
  const damage = reactionResult.damage;
  const nextHealth = reactionResult.survivesLethal ? 1 : Math.max(0, target.health - damage);
  const eliminated = nextHealth === 0;
  const splashTargets =
    weaponDefinition.id === "weapon_grenade" && options.resolveSplash !== false
      ? getGrenadeSplashTargets(state.players, attacker.id, target.id)
      : [];
  const splashEliminations = splashTargets.filter((splashTarget) => splashTarget.health <= (weaponDefinition.splashDamage ?? 0)).length;
  const attackerEliminations = (eliminated ? 1 : 0) + splashEliminations;
  const counterDamage = reactionResult.counterDamage;
  const counterEliminatesAttacker = counterDamage > 0 && attacker.health <= counterDamage;
  const attackerHealthAfterCounter = Math.max(0, attacker.health - counterDamage);
  const attackerRewardedHealth = applyEliminationHealthReward(attackerHealthAfterCounter, attackerEliminations, state);
  const defenderRewardedHealth = applyEliminationHealthReward(nextHealth, counterEliminatesAttacker ? 1 : 0, state);
  const reviveRetainedCards = reactionResult.discardsDefenderHand
    ? target.hand.filter((card) => getCardDefinitionById(card.definitionId)?.type === "healing")
    : [];
  const revivedDiscardedCards = reactionResult.discardsDefenderHand
    ? target.hand.filter((card) => card.instanceId !== reaction?.instanceId && getCardDefinitionById(card.definitionId)?.type !== "healing")
    : [];
  const targetHandAfterReaction = reactionResult.discardsDefenderHand
    ? reviveRetainedCards
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
        health: attackerRewardedHealth,
        eliminated: attackerHealth === 0,
        eliminations: player.eliminations + attackerEliminations,
        attackedThisRound: true,
        actedThisRound: true,
        actionsRemaining: options.spendAction === false ? player.actionsRemaining : Math.max(0, player.actionsRemaining - 1)
      };
    }

    if (player.id === target.id) {
      return {
        ...player,
        hand: eliminated ? [] : targetHandAfterReaction,
        health: defenderRewardedHealth,
        eliminated,
        eliminations: player.eliminations + (counterEliminatesAttacker ? 1 : 0)
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
  const attackerRewardGain = attackerRewardedHealth - attackerHealthAfterCounter;
  if (attackerRewardGain > 0) {
    messages.push(`${attacker.name} recovered ${attackerRewardGain} health from elimination reward.`);
  }
  const defenderRewardGain = defenderRewardedHealth - nextHealth;
  if (defenderRewardGain > 0) {
    messages.push(`${target.name} recovered ${defenderRewardGain} health from elimination reward.`);
  }

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
        ...(reactionResult.discardsDefenderHand ? revivedDiscardedCards : [])
      ],
      phase,
      winnerId
    },
    messages
  };
}

export function resolveSecondaryDamage(
  state: GameState,
  attacker: PlayerState,
  defender: PlayerState,
  weapon: CardInstance,
  baseDamage: number,
  source: "splash" | "ricochet",
  reaction: CardInstance | null
): AttackResult {
  const weaponDefinition = getCardDefinitionById(weapon.definitionId);
  if (!weaponDefinition || weaponDefinition.type !== "weapon") {
    return { state, messages: [] };
  }

  const reactionDefinition = getCardDefinitionById(reaction?.definitionId ?? "");
  const reactionResult = resolveReactionDamage(baseDamage, defender.health, weaponDefinition, reactionDefinition, state.activeEvent?.card.definitionId);
  const damage = reactionResult.damage;
  const nextHealth = reactionResult.survivesLethal ? 1 : Math.max(0, defender.health - damage);
  const eliminated = nextHealth === 0;
  const counterDamage = reactionResult.counterDamage;
  const counterEliminatesAttacker = counterDamage > 0 && attacker.health <= counterDamage;
  const attackerHealthAfterCounter = Math.max(0, attacker.health - counterDamage);
  const attackerRewardedHealth = applyEliminationHealthReward(attackerHealthAfterCounter, eliminated ? 1 : 0, state);
  const defenderRewardedHealth = applyEliminationHealthReward(nextHealth, counterEliminatesAttacker ? 1 : 0, state);
  const retainedCards = reactionResult.discardsDefenderHand
    ? defender.hand.filter((card) => getCardDefinitionById(card.definitionId)?.type === "healing")
    : [];
  const discardedByReaction = reactionResult.discardsDefenderHand
    ? defender.hand.filter((card) => card.instanceId !== reaction?.instanceId && getCardDefinitionById(card.definitionId)?.type !== "healing")
    : [];
  const defenderHandAfterReaction = reactionResult.discardsDefenderHand
    ? retainedCards
    : reaction
      ? defender.hand.filter((card) => card.instanceId !== reaction.instanceId)
      : defender.hand;
  const loot = eliminated ? defenderHandAfterReaction : [];
  const sourceLabel = source === "splash" ? `splash damage from ${weaponDefinition.name}` : `Ricochet with ${weaponDefinition.name}`;
  const messages = [`${defender.name} took ${damage} ${sourceLabel}.`];

  if (reaction && reactionDefinition) {
    messages.push(`${defender.name} played ${reactionDefinition.name}.`);
  }

  if (reactionResult.message) {
    messages.push(reactionResult.message.replace("{defender}", defender.name));
  }

  if (counterDamage > 0) {
    messages.push(`${defender.name} counterattacked ${attacker.name} for ${counterDamage} damage.`);
  }

  if (eliminated) {
    messages.push(`${defender.name} was eliminated by ${source === "splash" ? "splash damage" : "Ricochet"}.`);
  }

  const players = state.players.map((player) => {
    if (player.id === attacker.id) {
      return {
        ...player,
        hand: [...player.hand, ...loot],
        health: attackerRewardedHealth,
        eliminated: attackerHealthAfterCounter === 0,
        eliminations: player.eliminations + (eliminated ? 1 : 0)
      };
    }

    if (player.id === defender.id) {
      return {
        ...player,
        hand: eliminated ? [] : defenderHandAfterReaction,
        health: defenderRewardedHealth,
        eliminated,
        eliminations: player.eliminations + (counterEliminatesAttacker ? 1 : 0)
      };
    }

    return player;
  });
  let nextState: GameState = {
    ...state,
    players,
    discardPile: [...state.discardPile, ...(reaction ? [reaction] : []), ...(reactionResult.discardsDefenderHand ? discardedByReaction : [])],
    smokeProtectedPlayerIds:
      reactionDefinition?.id === "defense_smoke_bomb"
        ? Array.from(new Set([...state.smokeProtectedPlayerIds, defender.id]))
        : state.smokeProtectedPlayerIds
  };

  const attackerRewardGain = attackerRewardedHealth - attackerHealthAfterCounter;
  if (attackerRewardGain > 0) {
    messages.push(`${attacker.name} recovered ${attackerRewardGain} health from elimination reward.`);
  }
  const defenderRewardGain = defenderRewardedHealth - nextHealth;
  if (defenderRewardGain > 0) {
    messages.push(`${defender.name} recovered ${defenderRewardGain} health from elimination reward.`);
  }

  const winner = getWinner(nextState);
  if (winner) {
    nextState = {
      ...nextState,
      phase: "gameOver",
      winnerId: winner.id
    };
    messages.push(`${winner.name} is the last hand standing.`);
  }

  return { state: nextState, messages };
}

function applyEliminationHealthReward(health: number, eliminations: number, state: GameState): number {
  if (health <= 0 || eliminations <= 0 || state.settings.eliminationHealthReward <= 0) {
    return health;
  }

  return Math.min(state.settings.maxHealth, health + eliminations * state.settings.eliminationHealthReward);
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
    return { ...baseResult, message: "Armor Vest did not stop the penetrating hit." };
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

export function getGrenadeSplashTargets(players: PlayerState[], attackerId: string, targetId: string): PlayerState[] {
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

  const baseDamage = getBaseAttackDamage(state, attacker, target, weaponDefinition);
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
