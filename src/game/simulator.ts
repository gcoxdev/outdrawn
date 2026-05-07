import { mainDeckCards } from "../data/cards";
import { defaultGameSettings, type GameSettings } from "../data/constants";
import type { GameAction } from "./actions";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";
import type { CardInstance, GameState, PlayerState, StrategyLevel } from "./types";
import { getCardDefinitionById, getCurrentPlayer, getPlayer } from "./rules";

export type SimulationSummary = {
  gamesPlayed: number;
  strategies: StrategyLevel[];
  completedGames: number;
  stalledGames: number;
  averageRounds: number;
  averageTurns: number;
  minTurns: number;
  maxTurns: number;
  winners: Record<string, number>;
  winnerStrategies: Record<string, number>;
  observed: {
    attackDamage: number;
    eventDamage: number;
    selfDamage: number;
    healing: number;
    preventedAttackDamage: number;
    attackCardsPlayed: number;
    defenseCardsPlayed: number;
    healingCardsPlayed: number;
    abilityCardsPlayed: number;
    eventCardsResolved: number;
  };
  deckBalance: {
    weaponCards: number;
    defenseAndHealingCards: number;
    abilityCards: number;
    weaponDamagePotential: number;
    estimatedSurvivalValue: number;
    pressureToSurvivalRatio: number;
  };
  issues: Record<string, number>;
};

type SimulationMetrics = {
  turns: number;
  attackDamage: number;
  eventDamage: number;
  selfDamage: number;
  healing: number;
  preventedAttackDamage: number;
  attackCardsPlayed: number;
  defenseCardsPlayed: number;
  healingCardsPlayed: number;
  abilityCardsPlayed: number;
  eventCardsResolved: number;
  issues: Record<string, number>;
};

type SimulationResult = {
  state: GameState;
  metrics: SimulationMetrics;
  stalled: boolean;
};

const playerNames = ["Ari", "Blake", "Casey", "Devon"];
const defaultStrategies: StrategyLevel[] = ["competent", "competent", "competent", "competent"];

export type SimulationOptions = {
  settings?: Partial<GameSettings>;
};

export function simulateGames(
  count: number,
  seed = 123456,
  strategies: StrategyLevel[] = defaultStrategies,
  options: SimulationOptions = {}
): SimulationSummary {
  const normalizedStrategies = normalizeStrategies(strategies);
  const results = Array.from({ length: count }, (_, index) => simulateGame(seed + index * 9973, normalizedStrategies, options));
  const completed = results.filter((result) => !result.stalled && result.state.phase === "gameOver");
  const allMetrics = results.map((result) => result.metrics);
  const turns = allMetrics.map((metrics) => metrics.turns);
  const observed = allMetrics.reduce(
    (total, metrics) => ({
      attackDamage: total.attackDamage + metrics.attackDamage,
      eventDamage: total.eventDamage + metrics.eventDamage,
      selfDamage: total.selfDamage + metrics.selfDamage,
      healing: total.healing + metrics.healing,
      preventedAttackDamage: total.preventedAttackDamage + metrics.preventedAttackDamage,
      attackCardsPlayed: total.attackCardsPlayed + metrics.attackCardsPlayed,
      defenseCardsPlayed: total.defenseCardsPlayed + metrics.defenseCardsPlayed,
      healingCardsPlayed: total.healingCardsPlayed + metrics.healingCardsPlayed,
      abilityCardsPlayed: total.abilityCardsPlayed + metrics.abilityCardsPlayed,
      eventCardsResolved: total.eventCardsResolved + metrics.eventCardsResolved
    }),
    {
      attackDamage: 0,
      eventDamage: 0,
      selfDamage: 0,
      healing: 0,
      preventedAttackDamage: 0,
      attackCardsPlayed: 0,
      defenseCardsPlayed: 0,
      healingCardsPlayed: 0,
      abilityCardsPlayed: 0,
      eventCardsResolved: 0
    }
  );

  return {
    gamesPlayed: count,
    strategies: normalizedStrategies,
    completedGames: completed.length,
    stalledGames: results.length - completed.length,
    averageRounds: average(results.map((result) => result.state.round)),
    averageTurns: average(turns),
    minTurns: Math.min(...turns),
    maxTurns: Math.max(...turns),
    winners: tally(completed.map((result) => result.state.winnerId ?? "none")),
    winnerStrategies: tally(
      completed.map((result) => {
        const winnerIndex = result.state.players.findIndex((player) => player.id === result.state.winnerId);
        return winnerIndex >= 0 ? normalizedStrategies[winnerIndex] : "none";
      })
    ),
    observed,
    deckBalance: getDeckBalance(),
    issues: allMetrics.reduce<Record<string, number>>((issues, metrics) => {
      Object.entries(metrics.issues).forEach(([issue, count]) => {
        issues[issue] = (issues[issue] ?? 0) + count;
      });
      return issues;
    }, {})
  };
}

export function simulateGame(seed: number, strategies: StrategyLevel[] = defaultStrategies, options: SimulationOptions = {}): SimulationResult {
  const normalizedStrategies = normalizeStrategies(strategies);
  const random = createRng(seed);
  let state = createNewGame(
    playerNames.map((name, index) => ({
      name,
      controller: {
        type: "computer",
        strategy: normalizedStrategies[index]
      } as const
    })),
    random,
    options.settings ? { ...defaultGameSettings, ...options.settings } : undefined
  );
  const metrics: SimulationMetrics = {
    turns: 0,
    attackDamage: 0,
    eventDamage: 0,
    selfDamage: 0,
    healing: 0,
    preventedAttackDamage: 0,
    attackCardsPlayed: 0,
    defenseCardsPlayed: 0,
    healingCardsPlayed: 0,
    abilityCardsPlayed: 0,
    eventCardsResolved: 0,
    issues: {}
  };
  let safety = 0;

  while (state.phase !== "gameOver" && safety < 1200) {
    const before = state;
    const decisionPlayerId = getDecisionPlayerId(state);
    const decisionPlayerIndex = state.players.findIndex((player) => player.id === decisionPlayerId);
    const action = chooseAutomatedAction(state, normalizedStrategies[Math.max(0, decisionPlayerIndex)], random);
    state = dispatchWithMetrics(state, action, metrics);
    safety += 1;

    if (action.type === "END_TURN") {
      metrics.turns += 1;
    }

    collectStateIssues(state, metrics);

    if (state === before) {
      addIssue(metrics, `no-op:${action.type}`);
      state = forceProgress(state, metrics);
    }
  }

  const stalled = state.phase !== "gameOver";
  if (stalled) {
    addIssue(metrics, "game exceeded simulation step cap");
  }

  return { state, metrics, stalled };
}

export function chooseAutomatedAction(state: GameState, strategy: StrategyLevel, random: () => number = Math.random): GameAction {
  if (state.pendingReaction) {
    return chooseReaction(state, strategy, random);
  }

  if (state.pendingRedirect) {
    const attackerId = state.pendingRedirect.attackerId;
    const defenderId = state.pendingRedirect.defenderId;
    const target = chooseRedirectTarget(state, attackerId, defenderId, strategy, random);
    return { type: "RESOLVE_PENDING_REDIRECT", defenderId, targetPlayerId: target.id };
  }

  if (state.pendingAttackCost) {
    const attacker = getPlayer(state, state.pendingAttackCost.attackerId)!;
    const costCard = pickLowestCards(attacker.hand.filter((card) => card.instanceId !== state.pendingAttackCost!.weaponInstanceId), 1, strategy, random)[0];
    return { type: "RESOLVE_PENDING_ATTACK_COST", attackerId: attacker.id, cardInstanceId: costCard.instanceId };
  }

  if (state.pendingDiscard) {
    const player = getPlayer(state, state.pendingDiscard.playerId)!;
    return {
      type: "RESOLVE_PENDING_DISCARD",
      playerId: player.id,
      cardInstanceIds: pickLowestCards(player.hand, state.pendingDiscard.count, strategy, random).map((card) => card.instanceId)
    };
  }

  if (state.pendingSearch) {
    return {
      type: "RESOLVE_PENDING_SEARCH",
      playerId: state.pendingSearch.playerId,
      keepCardInstanceId: pickBestCard(state.pendingSearch.cards, strategy, random).instanceId
    };
  }

  if (state.pendingSupplyDrop) {
    const playerId = state.pendingSupplyDrop.playerOrder[state.pendingSupplyDrop.currentIndex];
    return {
      type: "RESOLVE_SUPPLY_DROP_PICK",
      playerId,
      cardInstanceId: chooseSupplyDropCard(state.pendingSupplyDrop.revealedCards, strategy, random)?.instanceId ?? null
    };
  }

  if (state.pendingMarketSearch) {
    return {
      type: "RESOLVE_MARKET_SEARCH",
      playerId: state.pendingMarketSearch.playerId,
      keepCardInstanceId: pickBestCard(state.pendingMarketSearch.cards, strategy, random).instanceId
    };
  }

  const player = getCurrentPlayer(state);
  if (player.hand.length > state.settings.maxHandSize) {
    return { type: "DISCARD_CARD", playerId: player.id, cardInstanceId: pickLowestCards(player.hand, 1, strategy, random)[0].instanceId };
  }

  if (player.eliminated || player.actionsRemaining <= 0) {
    return { type: "END_TURN", playerId: player.id };
  }

  if (strategy === "expert" || strategy === "master") {
    const setupAbility = chooseSetupAbility(state, player, strategy, random);
    if (setupAbility) {
      return setupAbility;
    }

    const urgentHealing = chooseHealing(state, player, strategy, true);
    if (urgentHealing) {
      return { type: "PLAY_HEALING", playerId: player.id, cardInstanceId: urgentHealing.instanceId };
    }

    const attack = chooseAttack(state, player, strategy, random);
    if (attack) {
      return attack;
    }

    const ability = chooseAbility(state, player, strategy, random);
    if (ability) {
      return ability;
    }
  }

  const healing = chooseHealing(state, player, strategy, false);
  if (healing) {
    return { type: "PLAY_HEALING", playerId: player.id, cardInstanceId: healing.instanceId };
  }

  const ability = chooseAbility(state, player, strategy, random);
  if (ability) {
    return ability;
  }

  const attack = chooseAttack(state, player, strategy, random);
  if (attack) {
    return attack;
  }

  if (state.mainDeck.length > 0 || state.discardPile.length > 0) {
    return { type: "DRAW_CARD", playerId: player.id };
  }

  return { type: "END_TURN", playerId: player.id };
}

export function getDecisionPlayerId(state: GameState): string {
  return (
    state.pendingReaction?.defenderId ??
    state.pendingRedirect?.defenderId ??
    state.pendingAttackCost?.attackerId ??
    state.pendingDiscard?.playerId ??
    state.pendingSearch?.playerId ??
    state.pendingSupplyDrop?.playerOrder[state.pendingSupplyDrop.currentIndex] ??
    state.pendingMarketSearch?.playerId ??
    getCurrentPlayer(state).id
  );
}

function chooseReaction(state: GameState, strategy: StrategyLevel, random: () => number): GameAction {
  const pending = state.pendingReaction!;
  const defender = getPlayer(state, pending.defenderId)!;
  const reactionCards = defender.hand.filter((card) => {
    const definition = getCardDefinitionById(card.definitionId);
    if (definition?.id === "defense_decoy") {
      return state.players.some((player) => !player.eliminated && player.id !== pending.attackerId && player.id !== defender.id);
    }
    return Boolean(definition && (definition.type === "defense" || definition.isLethalDefense));
  });

  if (strategy === "beginner" && random() < 0.45) {
    return { type: "SKIP_REACTION", defenderId: defender.id };
  }

  const lethal = reactionCards.find((card) => getCardDefinitionById(card.definitionId)?.isLethalDefense && pending.baseDamage >= defender.health);
  if (lethal) {
    return { type: "PLAY_REACTION", defenderId: defender.id, reactionCardInstanceId: lethal.instanceId };
  }

  const scored = reactionCards
    .map((card) => ({ card, score: scoreReaction(card, pending.baseDamage, defender.health) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const threshold = strategy === "beginner" ? 5 : strategy === "novice" ? 3 : 1;
  if (scored[0] && scored[0].score >= threshold) {
    return { type: "PLAY_REACTION", defenderId: defender.id, reactionCardInstanceId: scored[0].card.instanceId };
  }

  return { type: "SKIP_REACTION", defenderId: defender.id };
}

function chooseHealing(state: GameState, player: PlayerState, strategy: StrategyLevel, urgentOnly: boolean): CardInstance | null {
  const threshold =
    strategy === "master" ? 0.5 : strategy === "expert" ? 0.45 : strategy === "competent" ? 0.5 : strategy === "novice" ? 0.4 : 0.3;
  const urgentThreshold = Math.floor(state.settings.maxHealth * (strategy === "master" ? 0.45 : 0.35));
  if (urgentOnly && player.health > urgentThreshold) {
    return null;
  }

  if (player.health > Math.floor(state.settings.maxHealth * threshold)) {
    return null;
  }

  return player.hand
    .filter((card) => getCardDefinitionById(card.definitionId)?.type === "healing")
    .filter((card) => {
      const definition = getCardDefinitionById(card.definitionId);
      return definition && !definition.isLethalDefense && player.actionsRemaining >= (definition.actionsCost ?? 1);
    })
    .sort((left, right) => cardValue(right) - cardValue(left))[0] ?? null;
}

function chooseSetupAbility(state: GameState, player: PlayerState, strategy: StrategyLevel, random: () => number): GameAction | null {
  if (player.actionsRemaining < 2 || !player.hand.some((handCard) => getCardDefinitionById(handCard.definitionId)?.type === "weapon")) {
    return null;
  }

  const livingTargets = state.players.filter((candidate) => !candidate.eliminated && candidate.id !== player.id);
  const ambush = player.hand.find((card) => card.definitionId === "ability_ambush");
  if (ambush) {
    return { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: ambush.instanceId };
  }

  const markTarget = player.hand.find((card) => card.definitionId === "ability_mark_target");
  if (markTarget && Object.keys(state.markedTargets).length === 0) {
    const target = chooseAbilityTarget(livingTargets, "bestAttackTarget", strategy, random);
    if (target) {
      return { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: markTarget.instanceId, targetPlayerId: target.id };
    }
  }

  return null;
}

function chooseAbility(state: GameState, player: PlayerState, strategy: StrategyLevel, random: () => number): GameAction | null {
  if (strategy === "beginner" && random() < 0.5) {
    return null;
  }

  const abilities = player.hand.filter((card) => getCardDefinitionById(card.definitionId)?.type === "ability");
  const livingTargets = state.players.filter((candidate) => !candidate.eliminated && candidate.id !== player.id);

  for (const card of abilities) {
    const definition = getCardDefinitionById(card.definitionId);
    if (!definition) {
      continue;
    }

    if (definition.id === "ability_adrenaline" && player.health > 6 && player.actionsRemaining <= 1) {
      return { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: card.instanceId };
    }

    if (definition.id === "ability_ambush" && player.hand.some((handCard) => getCardDefinitionById(handCard.definitionId)?.type === "weapon")) {
      return { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: card.instanceId };
    }

    if (definition.id === "ability_search") {
      return { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: card.instanceId };
    }

    if (
      definition.id === "ability_reload" &&
      !state.reloadPlayerIds.includes(player.id) &&
      player.hand.some((handCard) => getCardDefinitionById(handCard.definitionId)?.type === "weapon")
    ) {
      return { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: card.instanceId };
    }

    if (definition.id === "ability_mark_target") {
      const target = chooseAbilityTarget(livingTargets, "highestHealth", strategy, random);
      if (!target) {
        continue;
      }
      return { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: card.instanceId, targetPlayerId: target.id };
    }

    if (definition.id === "ability_disarm") {
      const target = chooseAbilityTarget(
        livingTargets.filter((candidate) => candidate.hand.some((handCard) => getCardDefinitionById(handCard.definitionId)?.type === "weapon")),
        "highestThreat",
        strategy,
        random
      );
      if (target) {
        return { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: card.instanceId, targetPlayerId: target.id };
      }
    }

    if (definition.id === "ability_sabotage" || definition.id === "ability_steal" || definition.id === "ability_intimidate") {
      const target = chooseAbilityTarget(livingTargets, "largestHand", strategy, random);
      if (target && target.hand.length > 0) {
        return { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: card.instanceId, targetPlayerId: target.id };
      }
    }
  }

  if (state.activeEvent?.card.definitionId === "event_black_market" && player.actionsRemaining > 0 && player.hand.length >= 2) {
    return {
      type: "START_BLACK_MARKET",
      playerId: player.id,
      cardInstanceIds: pickLowestCards(player.hand, 2, strategy, random).map((card) => card.instanceId)
    };
  }

  return null;
}

function chooseAttack(state: GameState, player: PlayerState, strategy: StrategyLevel, random: () => number): GameAction | null {
  const weapons = player.hand.filter((card) => getCardDefinitionById(card.definitionId)?.type === "weapon");
  const weapon = pickWeapon(weapons, strategy, random);

  if (!weapon) {
    return null;
  }

  if (strategy === "master") {
    const masterAttack = chooseMasterAttack(state, player, weapons, random);
    if (masterAttack) {
      return masterAttack;
    }
  }

  const weaponDefinition = getCardDefinitionById(weapon.definitionId);
  const damagePotential = getWeaponDamagePotential(state, player, weapon);
  const validTargets = state.players
    .filter((candidate) => !candidate.eliminated && candidate.id !== player.id && !state.smokeProtectedPlayerIds.includes(candidate.id))
    .filter((candidate) => {
      const intimidationSources = state.intimidations[player.id] ?? [];
      return !intimidationSources.includes(candidate.id) || player.hand.some((card) => card.instanceId !== weapon.instanceId);
    });
  const target = chooseAttackTarget(validTargets, strategy, random, damagePotential);

  if (!target) {
    return null;
  }

  if (weaponDefinition?.target === "allPlayers") {
    return { type: "ATTACK", attackerId: player.id, weaponInstanceId: weapon.instanceId };
  }

  return { type: "ATTACK", attackerId: player.id, targetPlayerId: target.id, weaponInstanceId: weapon.instanceId };
}

function chooseMasterAttack(state: GameState, player: PlayerState, weapons: CardInstance[], random: () => number): GameAction | null {
  const attackOptions = weapons.flatMap((weapon) =>
    getValidAttackTargets(state, player, weapon).map((target) => ({
      target,
      weapon,
      damage: getWeaponDamagePotential(state, player, weapon)
    }))
  );
  const killOptions = attackOptions.filter((option) => option.damage >= option.target.health);

  if (killOptions.length > 0) {
    const chosen = [...killOptions].sort(
      (left, right) =>
        threatScore(right.target) - threatScore(left.target) ||
        left.damage - right.damage ||
        cardValue(left.weapon) - cardValue(right.weapon)
    )[0];
    return { type: "ATTACK", attackerId: player.id, targetPlayerId: chosen.target.id, weaponInstanceId: chosen.weapon.instanceId };
  }

  const bestWeapon = pickBestCard(weapons, "master", random);
  const validTargets = getValidAttackTargets(state, player, bestWeapon);
  if (validTargets.length === 0) {
    return null;
  }

  const target = chooseThreatTarget(validTargets, "master", random);
  if (getCardDefinitionById(bestWeapon.definitionId)?.target === "allPlayers") {
    return { type: "ATTACK", attackerId: player.id, weaponInstanceId: bestWeapon.instanceId };
  }

  return target ? { type: "ATTACK", attackerId: player.id, targetPlayerId: target.id, weaponInstanceId: bestWeapon.instanceId } : null;
}

function getValidAttackTargets(state: GameState, player: PlayerState, weapon: CardInstance): PlayerState[] {
  return state.players
    .filter((candidate) => !candidate.eliminated && candidate.id !== player.id && !state.smokeProtectedPlayerIds.includes(candidate.id))
    .filter((candidate) => {
      const intimidationSources = state.intimidations[player.id] ?? [];
      return !intimidationSources.includes(candidate.id) || player.hand.some((card) => card.instanceId !== weapon.instanceId);
    });
}

function getWeaponDamagePotential(state: GameState, player: PlayerState, weapon: CardInstance): number {
  const weaponDefinition = getCardDefinitionById(weapon.definitionId);
  if (weaponDefinition?.id === "weapon_minigun") {
    return state.players.filter((candidate) => !candidate.eliminated && candidate.id !== player.id && !state.smokeProtectedPlayerIds.includes(candidate.id))
      .length;
  }
  return (weaponDefinition?.id === "weapon_smg" ? 4 : weaponDefinition?.damage ?? 0) + (state.attackBonuses[player.id] ?? 0);
}

function dispatchWithMetrics(state: GameState, action: GameAction, metrics: SimulationMetrics): GameState {
  const beforeHealth = new Map(state.players.map((player) => [player.id, player.health]));
  const pendingBaseDamage = state.pendingReaction?.baseDamage ?? 0;
  const beforeRound = state.round;
  const beforeEventDiscard = state.eventDiscardPile.length;
  const next = gameReducer(state, action);
  const healthDelta = next.players.reduce(
    (total, player) => total + Math.max(0, (beforeHealth.get(player.id) ?? player.health) - player.health),
    0
  );
  const healingDelta = next.players.reduce(
    (total, player) => total + Math.max(0, player.health - (beforeHealth.get(player.id) ?? player.health)),
    0
  );

  if (action.type === "PLAY_REACTION") {
    metrics.defenseCardsPlayed += next !== state ? 1 : 0;
  }

  if (action.type === "PLAY_HEALING") {
    metrics.healingCardsPlayed += next !== state ? 1 : 0;
    metrics.healing += healingDelta;
  }

  if (action.type === "PLAY_ABILITY") {
    metrics.abilityCardsPlayed += next !== state ? 1 : 0;
  }

  if (action.type === "ATTACK") {
    metrics.attackCardsPlayed += next !== state ? 1 : 0;
  }

  if (action.type === "SKIP_REACTION" || action.type === "PLAY_REACTION" || action.type === "RESOLVE_PENDING_REDIRECT") {
    metrics.attackDamage += healthDelta;
    metrics.preventedAttackDamage += Math.max(0, pendingBaseDamage - healthDelta);
  } else if (action.type === "END_TURN" && next.round > beforeRound) {
    metrics.eventDamage += healthDelta;
  } else if (action.type === "PLAY_ABILITY") {
    metrics.selfDamage += healthDelta;
  }

  if (next.eventDiscardPile.length > beforeEventDiscard || (state.activeEvent?.card.instanceId !== next.activeEvent?.card.instanceId && next.activeEvent)) {
    metrics.eventCardsResolved += 1;
  }

  return next;
}

function forceProgress(state: GameState, metrics: SimulationMetrics): GameState {
  if (state.pendingReaction) {
    return gameReducer(state, { type: "SKIP_REACTION", defenderId: state.pendingReaction.defenderId });
  }

  const player = getCurrentPlayer(state);
  if (player.hand.length > state.settings.maxHandSize) {
    return gameReducer(state, { type: "DISCARD_CARD", playerId: player.id, cardInstanceId: sortByCardValue(player.hand)[0].instanceId });
  }

  addIssue(metrics, "forced end turn");
  return gameReducer(state, { type: "END_TURN", playerId: player.id });
}

function collectStateIssues(state: GameState, metrics: SimulationMetrics) {
  state.players.forEach((player) => {
    if (player.health < 0) {
      addIssue(metrics, "negative health");
    }
    if (
      !player.eliminated &&
      player.hand.length > state.settings.maxHandSize &&
      getCurrentPlayer(state).id !== player.id &&
      state.pendingDiscard?.playerId !== player.id
    ) {
      addIssue(metrics, "non-current player over hand limit");
    }
  });

  if (state.phase === "gameOver" && !state.winnerId) {
    addIssue(metrics, "unresolved true tie");
  }
}

function scoreReaction(card: CardInstance, damage: number, defenderHealth: number): number {
  const definition = getCardDefinitionById(card.definitionId);
  if (!definition) {
    return 0;
  }

  if (definition.id === "defense_dodge" || definition.id === "defense_smoke_bomb") {
    return damage >= 3 || damage >= defenderHealth ? 10 : 0;
  }

  if (definition.id === "defense_decoy") {
    return damage >= 5 ? 8 : 0;
  }

  if (definition.id === "defense_counterattack") {
    return defenderHealth > damage ? 4 : 0;
  }

  if (definition.id === "defense_backfire") {
    return damage >= 3 || damage >= defenderHealth ? 7 : 0;
  }

  if (definition.id === "defense_brace") {
    return damage >= 4 ? 5 : 0;
  }

  return Math.min(damage, definition.block ?? 0);
}

function normalizeStrategies(strategies: StrategyLevel[]): StrategyLevel[] {
  return playerNames.map((_, index) => strategies[index] ?? strategies[strategies.length - 1] ?? "competent");
}

function chooseRedirectTarget(
  state: GameState,
  attackerId: string,
  defenderId: string,
  strategy: StrategyLevel,
  random: () => number
): PlayerState {
  const targets = state.players.filter((player) => !player.eliminated && player.id !== attackerId && player.id !== defenderId);
  if (strategy === "beginner" || strategy === "novice") {
    return randomItem(targets, random);
  }

  return chooseThreatTarget(targets, strategy, random);
}

function chooseSupplyDropCard(cards: CardInstance[], strategy: StrategyLevel, random: () => number): CardInstance | null {
  if (strategy === "beginner" && random() < 0.25) {
    return null;
  }

  return pickBestCard(cards, strategy, random);
}

function chooseAbilityTarget(
  players: PlayerState[],
  purpose: "highestHealth" | "largestHand" | "bestAttackTarget" | "highestThreat",
  strategy: StrategyLevel,
  random: () => number
): PlayerState | undefined {
  if (players.length === 0) {
    return undefined;
  }

  if (strategy === "beginner") {
    return randomItem(players, random);
  }

  if (purpose === "highestHealth") {
    return [...players].sort((left, right) => right.health - left.health)[0];
  }

  if (purpose === "bestAttackTarget") {
    return chooseAttackTarget(players, strategy, random, 0);
  }

  if (purpose === "highestThreat") {
    return chooseThreatTarget(players, strategy, random);
  }

  return [...players].sort((left, right) => right.hand.length - left.hand.length || left.health - right.health)[0];
}

function pickWeapon(cards: CardInstance[], strategy: StrategyLevel, random: () => number): CardInstance | undefined {
  if (cards.length === 0) {
    return undefined;
  }

  if (strategy === "beginner") {
    return randomItem(cards, random);
  }

  if (strategy === "novice") {
    return [...cards].sort((left, right) => cardValue(right) - cardValue(left))[Math.min(1, cards.length - 1)];
  }

  return pickBestCard(cards, strategy, random);
}

function pickBestCard(cards: CardInstance[], strategy: StrategyLevel, random: () => number): CardInstance {
  if (strategy === "beginner") {
    return randomItem(cards, random);
  }

  if (strategy === "novice" && cards.length > 1) {
    const sorted = [...cards].sort((left, right) => cardValue(right) - cardValue(left));
    return sorted[random() < 0.65 ? 0 : 1];
  }

  return bestCard(cards);
}

function pickLowestCards(cards: CardInstance[], count: number, strategy: StrategyLevel, random: () => number): CardInstance[] {
  if (strategy === "beginner") {
    return shuffle(cards, random).slice(0, count);
  }

  if (strategy === "novice") {
    return shuffle(sortByCardValue(cards).slice(0, Math.min(cards.length, count + 1)), random).slice(0, count);
  }

  return sortByCardValue(cards).slice(0, count);
}

function chooseAttackTarget(players: PlayerState[], strategy: StrategyLevel, random: () => number, damagePotential: number): PlayerState | undefined {
  if (players.length === 0) {
    return undefined;
  }

  if (strategy === "beginner") {
    return randomItem(players, random);
  }

  const killable = players.filter((player) => damagePotential > 0 && player.health <= damagePotential);
  if (killable.length > 0) {
    return [...killable].sort((left, right) => threatScore(right) - threatScore(left))[0];
  }

  if (strategy === "novice") {
    const shuffled = shuffle(players, random);
    return shuffled.sort((left, right) => left.health - right.health)[0];
  }

  return chooseThreatTarget(players, strategy, random);
}

function chooseThreatTarget(players: PlayerState[], strategy: StrategyLevel, random: () => number): PlayerState {
  const sorted = [...players].sort((left, right) => threatScore(right) - threatScore(left));
  if (strategy === "master") {
    return sorted[0];
  }

  const topScore = threatScore(sorted[0]);
  const tolerance = strategy === "expert" ? 4 : 5;
  const candidates = sorted.filter((player) => topScore - threatScore(player) <= tolerance).slice(0, 3);
  return randomItem(candidates.length > 0 ? candidates : sorted.slice(0, 1), random);
}

function threatScore(player: PlayerState): number {
  const weaponPressure = player.hand.reduce((total, card) => {
    const definition = getCardDefinitionById(card.definitionId);
    return definition?.type === "weapon" ? total + (definition.damage ?? 0) + (definition.splashDamage ?? 0) : total;
  }, 0);
  const defensePressure = player.hand.filter((card) => {
    const definition = getCardDefinitionById(card.definitionId);
    return definition?.type === "defense" || definition?.isLethalDefense;
  }).length;

  return player.health * 0.35 + player.hand.length * 0.8 + weaponPressure * 0.55 + defensePressure * 1.2;
}

function randomItem<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function bestCard(cards: CardInstance[]): CardInstance {
  return [...cards].sort((left, right) => cardValue(right) - cardValue(left))[0];
}

function sortByCardValue(cards: CardInstance[]): CardInstance[] {
  return [...cards].sort((left, right) => cardValue(left) - cardValue(right));
}

function cardValue(card: CardInstance): number {
  const definition = getCardDefinitionById(card.definitionId);
  if (!definition) {
    return 0;
  }

  if (definition.type === "weapon") {
    return 20 + (definition.damage ?? 0) + (definition.splashDamage ?? 0);
  }

  if (definition.type === "defense") {
    return 14 + (definition.block ?? 0) + (definition.isLethalDefense ? 8 : 0);
  }

  if (definition.type === "healing") {
    return 10 + (definition.heal ?? 0) + (definition.draw ?? 0) + (definition.isLethalDefense ? 8 : 0);
  }

  if (definition.type === "ability") {
    return 8 + (definition.damage ?? 0) + (definition.draw ?? 0) + (definition.discard ?? 0);
  }

  return 1;
}

function getDeckBalance() {
  const weaponCards = mainDeckCards.filter((card) => card.type === "weapon").reduce((total, card) => total + card.count, 0);
  const defenseAndHealingCards = mainDeckCards
    .filter((card) => card.type === "defense" || card.type === "healing")
    .reduce((total, card) => total + card.count, 0);
  const abilityCards = mainDeckCards.filter((card) => card.type === "ability").reduce((total, card) => total + card.count, 0);
  const weaponDamagePotential = mainDeckCards
    .filter((card) => card.type === "weapon")
    .reduce((total, card) => total + estimatedWeaponPressure(card) * card.count, 0);
  const estimatedSurvivalValue = mainDeckCards.reduce((total, card) => {
    if (card.type === "healing") {
      return total + (card.heal ?? 0) * card.count;
    }
    if (card.id === "defense_dodge" || card.id === "defense_smoke_bomb") {
      return total + 4 * card.count;
    }
    if (card.id === "defense_backfire") {
      return total + 6 * card.count;
    }
    if (card.id === "defense_fake_death") {
      return total + 5 * card.count;
    }
    if (card.type === "defense") {
      return total + (card.block ?? 0) * card.count;
    }
    return total;
  }, 0);

  return {
    weaponCards,
    defenseAndHealingCards,
    abilityCards,
    weaponDamagePotential,
    estimatedSurvivalValue,
    pressureToSurvivalRatio: Number((weaponDamagePotential / estimatedSurvivalValue).toFixed(2))
  };
}

function estimatedWeaponPressure(card: { id: string; damage?: number; splashDamage?: number }): number {
  if (card.id === "weapon_minigun") {
    return (card.damage ?? 0) * 3;
  }

  return (card.damage ?? 0) + (card.splashDamage ?? 0);
}

function addIssue(metrics: SimulationMetrics, issue: string) {
  metrics.issues[issue] = (metrics.issues[issue] ?? 0) + 1;
}

function average(values: number[]): number {
  return Number((values.reduce((total, value) => total + value, 0) / Math.max(1, values.length)).toFixed(2));
}

function tally(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
