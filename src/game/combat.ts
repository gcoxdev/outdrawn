import { damagePlayer, recoveryMessage } from "./recovery";
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
  const reactionResult = resolveReactionDamage(baseDamage, weaponDefinition, reactionDefinition);
  // Played cards leave hands before automatic Revive discards the rest.
  const targetHit = damagePlayer({ ...target, hand: reaction ? target.hand.filter(card => card.instanceId !== reaction.instanceId) : target.hand }, reactionResult.damage);
  const counterDamage = options.resolveCounterDamage === false ? 0 : reactionResult.counterDamage;
  const attackerHit = damagePlayer({ ...attacker, hand: primary && !options.keepWeaponInHand ? attacker.hand.filter(card => card.instanceId !== weapon.instanceId) : attacker.hand }, counterDamage);
  const splashTargets = weaponDefinition.id === "weapon_grenade" && options.resolveSplash !== false
    ? getGrenadeSplashTargets(state.players, attacker.id, target.id).filter(player => !areTeammates(attacker, player)) : [];
  const splashHits = splashTargets.map(player => damagePlayer(player, weaponDefinition.splashDamage ?? 0));
  const attackerEliminations = Number(targetHit.player.eliminated) + splashHits.filter(hit => hit.player.eliminated).length;
  const counterEliminatesAttacker = attackerHit.player.eliminated;
  const attackerHealthAfterCounter = attackerHit.player.health;
  const attackerRewardedHealth = attackerHit.player.recovering ? 1 : applyEliminationHealthReward(attackerHealthAfterCounter, attackerEliminations, state);
  const defenderRewardedHealth = targetHit.player.recovering ? 1 : applyEliminationHealthReward(targetHit.player.health, Number(counterEliminatesAttacker), state);
  const attackerReward = attackerRewardedHealth - attackerHealthAfterCounter;
  const defenderReward = defenderRewardedHealth - targetHit.player.health;
  state = recordCombatEffects(state, attacker, target, source === "counterattack" ? "defense_counterattack" : source === "backfire" ? "defense_backfire" : weapon.definitionId,
    baseDamage, targetHit.damage, attackerHit.damage, attackerReward, defenderReward, source, reaction?.definitionId);
  state = recordEffects(state, ...splashHits.map(hit => ({ kind: "damage" as const, source: "splash" as const, cardDefinitionId: weapon.definitionId, sourcePlayerId: attacker.id, playerId: hit.player.id, amount: hit.damage })));
  const discardedWeapon = primary && (!options.keepWeaponInHand || attackerHit.player.eliminated);
  const players = state.players.map(player => {
    if (player.id === attacker.id) return {
      ...attackerHit.player, health: attackerRewardedHealth,
      hand: discardedWeapon ? attackerHit.player.hand.filter(card => card.instanceId !== weapon.instanceId) : attackerHit.player.hand,
      eliminations: player.eliminations + attackerEliminations,
      ...(primary ? { attackedThisRound: true, actedThisRound: true,
        actionsRemaining: attackerHit.player.recovering ? 0 : options.spendAction === false ? player.actionsRemaining : Math.max(0, player.actionsRemaining - 1) } : {})
    };
    if (player.id === target.id) return { ...targetHit.player, health: defenderRewardedHealth, eliminations: player.eliminations + Number(counterEliminatesAttacker) };
    return splashHits.find(hit => hit.player.id === player.id)?.player ?? player;
  });
  const nextState = { ...state, players };
  let winnerId = state.winnerId;
  let phase = state.phase;
  const messages = [primary ? `${attacker.name} attacked ${target.name} with ${weaponDefinition.name} for ${targetHit.damage} damage.`
    : `${target.name} took ${targetHit.damage} ${getSecondarySourceLabel(source, weaponDefinition.name)}.`];
  if (reaction && reactionDefinition) messages.push(`${target.name} played ${reactionDefinition.name}.`);
  if (reactionResult.message) messages.push(reactionResult.message.replace("{defender}", target.name));
  for (const hit of [targetHit, attackerHit, ...splashHits]) if (hit.revived) messages.push(recoveryMessage(hit.player));
  if (counterDamage > 0) messages.push(`${target.name} counterattacked ${attacker.name} for ${attackerHit.damage} damage.`);
  if (targetHit.player.eliminated) messages.push(primary ? `${target.name} was eliminated.` : `${target.name} was eliminated by ${getSecondaryEliminationLabel(source)}.`);
  splashHits.forEach(hit => {
    messages.push(`${hit.player.name} took ${hit.damage} splash damage from ${weaponDefinition.name}.`);
    if (hit.player.eliminated) messages.push(`${hit.player.name} was eliminated by splash damage.`);
  });
  if (attackerReward > 0) messages.push(`${attacker.name} recovered ${attackerReward} health from elimination reward.`);
  if (defenderReward > 0) messages.push(`${target.name} recovered ${defenderReward} health from elimination reward.`);

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
        ...(discardedWeapon ? [weapon] : []),
        ...(reaction ? [reaction] : []),
        ...targetHit.discarded, ...attackerHit.discarded, ...splashHits.flatMap(hit => hit.discarded)
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

function resolveReactionDamage(
  baseDamage: number,
  weaponDefinition: CardDefinition,
  reactionDefinition: CardDefinition | undefined
): {
  damage: number;
  counterDamage: number;
  message: string | null;
} {
  const baseResult = {
    damage: baseDamage,
    counterDamage: 0,
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
