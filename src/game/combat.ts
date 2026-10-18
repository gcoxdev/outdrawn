import { omitKey } from "./record";
import { recordEffects, recordCombatEffects } from "./effects";
import { allCards } from "../data/cards";
import type { CardDefinition, CardInstance, GameState, PendingReaction, PlayerState, SecondaryDamageSource } from "./types";
import { areTeammates, getCardDefinitionById, getWinner, getWinningTeamId, labelTeam } from "./rules";
import { drawCardsWithRefill } from "./deck";
import { finalizeEliminations } from "./elimination";

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
  resolveCounterDamage?: boolean;
  deferGameOver?: boolean;
};

export function getBaseAttackDamage(
  state: GameState,
  attacker: PlayerState,
  target: PlayerState,
  weaponDefinition: CardDefinition,
  weaponDamageOverride?: number
): number {
  return (
    (weaponDamageOverride ?? weaponDefinition.damage ?? 0) +
    (state.attackBonuses[attacker.id] ?? 0) +
    (state.markedTargets[target.id] ?? 0)
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
  return resolveWeaponHit(state, attacker, target, weapon, reaction, options, "attack");
}

/** Shared health, defense, credit, loot, and reward resolution for weapon hits. */
function resolveWeaponHit(
  state: GameState,
  attacker: PlayerState,
  target: PlayerState,
  weapon: CardInstance,
  reaction: CardInstance | null,
  options: ResolveAttackOptions,
  source: "attack" | SecondaryDamageSource
): AttackResult {
  const primary = source === "attack";
  const weaponDefinition = getCardDefinitionById(weapon.definitionId);
  if (!weaponDefinition || weaponDefinition.type !== "weapon") {
    return { state, messages: [] };
  }

  const baseDamage = options.baseDamageOverride ?? getBaseAttackDamage(state, attacker, target, weaponDefinition);
  const reactionDefinition = getCardDefinitionById(reaction?.definitionId ?? "");
  const reactionResult = resolveReactionDamage(baseDamage, target.health, weaponDefinition, reactionDefinition);
  const damage = reactionResult.damage;
  const reviveResult = reactionResult.survivesLethal ? resolveReviveHand(target.hand, reaction, state) : null;
  const nextHealth = reviveResult?.health ?? Math.max(0, target.health - damage);
  const eliminated = nextHealth === 0;
  const splashTargets =
    weaponDefinition.id === "weapon_grenade" && options.resolveSplash !== false
      ? getGrenadeSplashTargets(state.players, attacker.id, target.id)
          .filter((splashTarget) => !areTeammates(attacker, splashTarget))
      : [];
  const splashEliminations = splashTargets.filter((splashTarget) => splashTarget.health <= (weaponDefinition.splashDamage ?? 0)).length;
  const attackerEliminations = (eliminated ? 1 : 0) + splashEliminations;
  const counterDamage = reactionResult.counterDamage;
  const appliedCounterDamage = options.resolveCounterDamage === false ? 0 : counterDamage;
  const counterEliminatesAttacker = appliedCounterDamage > 0 && attacker.health <= appliedCounterDamage;
  const attackerHealthAfterCounter = Math.max(0, attacker.health - appliedCounterDamage);
  const attackerRewardedHealth = applyEliminationHealthReward(attackerHealthAfterCounter, attackerEliminations, state);
  const defenderRewardedHealth = applyEliminationHealthReward(nextHealth, counterEliminatesAttacker ? 1 : 0, state);
  state = recordCombatEffects(state, attacker, target, source === "counterattack" ? "defense_counterattack" : source === "backfire" ? "defense_backfire" : weapon.definitionId, baseDamage, damage, reviveResult?.health, appliedCounterDamage, attackerRewardedHealth - attackerHealthAfterCounter, defenderRewardedHealth - nextHealth, source, reaction?.definitionId);
  state = recordEffects(state, ...splashTargets.map(player => ({ kind: "damage" as const, source: "splash" as const, cardDefinitionId: weapon.definitionId, sourcePlayerId: attacker.id, playerId: player.id, amount: Math.min(player.health, weaponDefinition.splashDamage ?? 0) })));
  const revivedDiscardedCards = reviveResult?.discardedCards ?? [];
  const targetHandAfterReaction = reviveResult
    ? []
    : reaction
      ? target.hand.filter((card) => card.instanceId !== reaction.instanceId)
      : target.hand;
  let winnerId = state.winnerId;
  let phase = state.phase;
  const messages = [!primary ? `${target.name} took ${damage} ${getSecondarySourceLabel(source, weaponDefinition.name)}.` :
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

  if (reviveResult && reviveResult.appliedHealingCards > 0) {
    messages.push(`${target.name} applied ${reviveResult.appliedHealingCards} healing cards and recovered to ${reviveResult.health} health.`);
  }

  if (counterDamage > 0) {
    messages.push(`${target.name} counterattacked ${attacker.name} for ${counterDamage} damage.`);
  }

  if (eliminated) {
    messages.push(primary ? `${target.name} was eliminated.` : `${target.name} was eliminated by ${getSecondaryEliminationLabel(source)}.`);
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
      const attackerHealth = attackerHealthAfterCounter;
      return {
        ...player,
        hand: !primary || options.keepWeaponInHand && attackerHealth > 0 ? player.hand : player.hand.filter((card) => card.instanceId !== weapon.instanceId),
        health: attackerRewardedHealth,
        eliminated: player.eliminated || attackerHealth === 0,
        eliminations: player.eliminations + attackerEliminations,
        ...(primary ? {
          attackedThisRound: true,
          actedThisRound: true,
          actionsRemaining: options.spendAction === false ? player.actionsRemaining : Math.max(0, player.actionsRemaining - 1)
        } : {})
      };
    }

    if (player.id === target.id) {
      return {
        ...player,
        hand: targetHandAfterReaction,
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
  const nextState = { ...state, players };
  const attackerRewardGain = attackerRewardedHealth - attackerHealthAfterCounter;
  if (attackerRewardGain > 0) {
    messages.push(`${attacker.name} recovered ${attackerRewardGain} health from elimination reward.`);
  }
  const defenderRewardGain = defenderRewardedHealth - nextHealth;
  if (defenderRewardGain > 0) {
    messages.push(`${target.name} recovered ${defenderRewardGain} health from elimination reward.`);
  }

  const winner = getWinner(nextState);
  const winnerTeamId = getWinningTeamId(nextState);

  if (!options.deferGameOver && (winner || winnerTeamId)) {
    winnerId = winner?.id ?? nextState.players.find((player) => player.teamId === winnerTeamId && !player.eliminated)?.id ?? null;
    phase = "gameOver";
    messages.push(winnerTeamId ? `${labelTeam(winnerTeamId)} is the last team standing.` : `${winner!.name} wins.`);
  }

  return {
    state: finalizeEliminations({
      ...nextState,
      ...(primary ? { pendingReaction: null, pendingRedirect: null } : {}),
      attackBonuses: options.clearAttackBonuses === false ? nextState.attackBonuses : omitKey(nextState.attackBonuses, attacker.id),
      smokeProtectedPlayerIds:
        reactionDefinition?.id === "defense_smoke_bomb"
          ? Array.from(new Set([...nextState.smokeProtectedPlayerIds, target.id]))
          : nextState.smokeProtectedPlayerIds,
      discardPile: [
        ...nextState.discardPile,
        ...(!primary || options.keepWeaponInHand && attackerHealthAfterCounter > 0 ? [] : [weapon]),
        ...(reaction ? [reaction] : []),
        ...(reactionResult.discardsDefenderHand ? revivedDiscardedCards : [])
      ],
      phase,
      winnerId,
      winnerTeamId
    }, Object.fromEntries([
      [target.id, attacker.id], ...splashTargets.map(player => [player.id, attacker.id]), [attacker.id, target.id]
    ])),
    messages
  };
}

export function resolveSecondaryDamage(
  state: GameState,
  attacker: PlayerState,
  defender: PlayerState,
  weapon: CardInstance,
  baseDamage: number,
  source: SecondaryDamageSource,
  reaction: CardInstance | null,
  options: Pick<ResolveAttackOptions, "resolveCounterDamage" | "deferGameOver"> = {}
): AttackResult {
  return resolveWeaponHit(state, attacker, defender, weapon, reaction, {
    ...options,
    baseDamageOverride: baseDamage,
    resolveSplash: false,
    clearAttackBonuses: false
  }, source);
}

function getSecondarySourceLabel(source: SecondaryDamageSource, weaponName: string): string {
  if (source === "splash") {
    return `splash damage from ${weaponName}`;
  }

  if (source === "ricochet") {
    return `Ricochet with ${weaponName}`;
  }

  if (source === "minigun") {
    return `Minigun fire`;
  }

  return source === "backfire" ? "Backfire damage" : "Counterattack damage";
}

function getSecondaryEliminationLabel(source: SecondaryDamageSource): string {
  if (source === "splash") {
    return "splash damage";
  }

  if (source === "minigun") {
    return "Minigun";
  }

  return source === "ricochet" ? "Ricochet" : source === "backfire" ? "Backfire" : "Counterattack";
}

function applyEliminationHealthReward(health: number, eliminations: number, state: GameState): number {
  if (health <= 0 || eliminations <= 0 || state.settings.eliminationHealthReward <= 0) {
    return health;
  }

  return Math.min(state.settings.maxHealth, health + eliminations * state.settings.eliminationHealthReward);
}

function resolveReviveHand(hand: CardInstance[], reaction: CardInstance | null, state: GameState) {
  const healingCards = hand.filter((card) => card.instanceId !== reaction?.instanceId && getCardDefinitionById(card.definitionId)?.type === "healing");
  const heal = healingCards.reduce((total, card) => total + (getCardDefinitionById(card.definitionId)?.heal ?? 0), 0);

  return {
    health: Math.min(state.settings.maxHealth, 1 + heal),
    discardedCards: hand.filter((card) => card.instanceId !== reaction?.instanceId),
    appliedHealingCards: healingCards.length
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
    return { ...baseResult, damage: 0, message: reactionDefinition.id === "defense_smoke_bomb"
      ? "{defender} avoided the attack and is protected by Smoke Bomb until their next turn."
      : "{defender} avoided the attack." };
  }

  if (reactionDefinition.id === "defense_shield_plate") {
    return {
      ...baseResult,
      damage: Math.floor(baseDamage / 2),
      message: "{defender} used Shield Plate to halve the hit."
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
      damage: Math.max(0, baseDamage - block),
      message: `{defender} blocked ${block} damage.`
    };
  }

  return baseResult;
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

export function resolveHealing(
  state: GameState,
  player: PlayerState,
  card: CardInstance,
  definition: CardDefinition,
  target: PlayerState = player
): AttackResult {
  const heal = definition.heal ?? 0;
  const draw = definition.draw ?? 0;
  const actionsCost = definition.actionsCost ?? 1;
  const nextHealth = Math.min(state.settings.maxHealth, target.health + heal);
  const deckDraw = drawCardsWithRefill(state.mainDeck, state.discardPile, draw, state.deckRandomState);
  const healedAmount = nextHealth - target.health;
  state = recordEffects(state, { kind: "healing", source: "healing", cardDefinitionId: card.definitionId, sourcePlayerId: player.id, playerId: target.id, amount: healedAmount });
  const messages = [
    player.id === target.id
      ? `${player.name} played ${definition.name} and healed ${healedAmount}.`
      : `${player.name} played ${definition.name} on ${target.name} and healed ${healedAmount}.`
  ];

  return {
    state: {
      ...state,
      mainDeck: deckDraw.mainDeck,
      deckRandomState: deckDraw.deckRandomState,
      discardPile: [...deckDraw.discardPile, card],
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? {
              ...candidate,
              health: candidate.id === target.id ? nextHealth : candidate.health,
              hand: [...candidate.hand.filter((handCard) => handCard.instanceId !== card.instanceId), ...deckDraw.drawn],
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
    },
    messages
  };
}

export function isHealingDefinition(definition: CardDefinition | undefined): definition is CardDefinition {
  return Boolean(definition && allCards.includes(definition) && definition.type === "healing");
}
