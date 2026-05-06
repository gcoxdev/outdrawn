import { mainDeckCards } from "../data/cards";
import type { GameAction } from "./actions";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";
import type { CardInstance, GameState, PlayerState } from "./types";
import { getCardDefinitionById, getCurrentPlayer, getPlayer } from "./rules";

export type SimulationSummary = {
  gamesPlayed: number;
  completedGames: number;
  stalledGames: number;
  averageRounds: number;
  averageTurns: number;
  minTurns: number;
  maxTurns: number;
  winners: Record<string, number>;
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

export function simulateGames(count: number, seed = 123456): SimulationSummary {
  const results = Array.from({ length: count }, (_, index) => simulateGame(seed + index * 9973));
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
    completedGames: completed.length,
    stalledGames: results.length - completed.length,
    averageRounds: average(results.map((result) => result.state.round)),
    averageTurns: average(turns),
    minTurns: Math.min(...turns),
    maxTurns: Math.max(...turns),
    winners: tally(completed.map((result) => result.state.winnerId ?? "none")),
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

export function simulateGame(seed: number): SimulationResult {
  const random = createRng(seed);
  let state = createNewGame(playerNames, random);
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
    const action = chooseAction(state);
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

function chooseAction(state: GameState): GameAction {
  if (state.pendingReaction) {
    return chooseReaction(state);
  }

  if (state.pendingRedirect) {
    const attackerId = state.pendingRedirect.attackerId;
    const defenderId = state.pendingRedirect.defenderId;
    const target = state.players
      .filter((player) => !player.eliminated && player.id !== attackerId && player.id !== defenderId)
      .sort((left, right) => left.health - right.health)[0];
    return { type: "RESOLVE_PENDING_REDIRECT", defenderId, targetPlayerId: target.id };
  }

  if (state.pendingAttackCost) {
    const attacker = getPlayer(state, state.pendingAttackCost.attackerId)!;
    const costCard = sortByCardValue(attacker.hand.filter((card) => card.instanceId !== state.pendingAttackCost!.weaponInstanceId))[0];
    return { type: "RESOLVE_PENDING_ATTACK_COST", attackerId: attacker.id, cardInstanceId: costCard.instanceId };
  }

  if (state.pendingDiscard) {
    const player = getPlayer(state, state.pendingDiscard.playerId)!;
    return {
      type: "RESOLVE_PENDING_DISCARD",
      playerId: player.id,
      cardInstanceIds: sortByCardValue(player.hand).slice(0, state.pendingDiscard.count).map((card) => card.instanceId)
    };
  }

  if (state.pendingSearch) {
    return {
      type: "RESOLVE_PENDING_SEARCH",
      playerId: state.pendingSearch.playerId,
      keepCardInstanceId: bestCard(state.pendingSearch.cards).instanceId
    };
  }

  if (state.pendingSupplyDrop) {
    const playerId = state.pendingSupplyDrop.playerOrder[state.pendingSupplyDrop.currentIndex];
    return {
      type: "RESOLVE_SUPPLY_DROP_PICK",
      playerId,
      cardInstanceId: bestCard(state.pendingSupplyDrop.revealedCards).instanceId
    };
  }

  if (state.pendingMarketSearch) {
    return {
      type: "RESOLVE_MARKET_SEARCH",
      playerId: state.pendingMarketSearch.playerId,
      keepCardInstanceId: bestCard(state.pendingMarketSearch.cards).instanceId
    };
  }

  const player = getCurrentPlayer(state);
  if (player.hand.length > state.settings.maxHandSize) {
    return { type: "DISCARD_CARD", playerId: player.id, cardInstanceId: sortByCardValue(player.hand)[0].instanceId };
  }

  if (player.eliminated || player.actionsRemaining <= 0) {
    return { type: "END_TURN", playerId: player.id };
  }

  const healing = chooseHealing(state, player);
  if (healing) {
    return { type: "PLAY_HEALING", playerId: player.id, cardInstanceId: healing.instanceId };
  }

  const ability = chooseAbility(state, player);
  if (ability) {
    return ability;
  }

  const attack = chooseAttack(state, player);
  if (attack) {
    return attack;
  }

  if (state.mainDeck.length > 0 || state.discardPile.length > 0) {
    return { type: "DRAW_CARD", playerId: player.id };
  }

  return { type: "END_TURN", playerId: player.id };
}

function chooseReaction(state: GameState): GameAction {
  const pending = state.pendingReaction!;
  const defender = getPlayer(state, pending.defenderId)!;
  const reactionCards = defender.hand.filter((card) => {
    const definition = getCardDefinitionById(card.definitionId);
    if (definition?.id === "defense_decoy") {
      return state.players.some((player) => !player.eliminated && player.id !== pending.attackerId && player.id !== defender.id);
    }
    return Boolean(definition && (definition.type === "defense" || definition.isLethalDefense));
  });

  const lethal = reactionCards.find((card) => getCardDefinitionById(card.definitionId)?.isLethalDefense && pending.baseDamage >= defender.health);
  if (lethal) {
    return { type: "PLAY_REACTION", defenderId: defender.id, reactionCardInstanceId: lethal.instanceId };
  }

  const scored = reactionCards
    .map((card) => ({ card, score: scoreReaction(card, pending.baseDamage, defender.health) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scored[0]) {
    return { type: "PLAY_REACTION", defenderId: defender.id, reactionCardInstanceId: scored[0].card.instanceId };
  }

  return { type: "SKIP_REACTION", defenderId: defender.id };
}

function chooseHealing(state: GameState, player: PlayerState): CardInstance | null {
  if (player.health > Math.floor(state.settings.maxHealth * 0.55)) {
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

function chooseAbility(state: GameState, player: PlayerState): GameAction | null {
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

    if (definition.id === "ability_reload" && state.discardPile.some((discarded) => getCardDefinitionById(discarded.definitionId)?.type === "weapon")) {
      return { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: card.instanceId };
    }

  if (definition.id === "ability_mark_target") {
      const target = livingTargets.sort((left, right) => right.health - left.health)[0];
      if (!target) {
        continue;
      }
      return { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: card.instanceId, targetPlayerId: target.id };
    }

    if (definition.id === "ability_disarm") {
      const target = livingTargets.find((candidate) => candidate.hand.some((handCard) => getCardDefinitionById(handCard.definitionId)?.type === "weapon"));
      if (target) {
        return { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: card.instanceId, targetPlayerId: target.id };
      }
    }

    if (definition.id === "ability_sabotage" || definition.id === "ability_steal" || definition.id === "ability_intimidate") {
      const target = livingTargets.sort((left, right) => right.hand.length - left.hand.length || left.health - right.health)[0];
      if (target && target.hand.length > 0) {
        return { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: card.instanceId, targetPlayerId: target.id };
      }
    }
  }

  if (state.activeEvent?.card.definitionId === "event_black_market" && player.actionsRemaining > 0 && player.hand.length >= 2) {
    return {
      type: "START_BLACK_MARKET",
      playerId: player.id,
      cardInstanceIds: sortByCardValue(player.hand).slice(0, 2).map((card) => card.instanceId)
    };
  }

  return null;
}

function chooseAttack(state: GameState, player: PlayerState): GameAction | null {
  const weapon = player.hand
    .filter((card) => getCardDefinitionById(card.definitionId)?.type === "weapon")
    .sort((left, right) => cardValue(right) - cardValue(left))[0];

  if (!weapon) {
    return null;
  }

  const target = state.players
    .filter((candidate) => !candidate.eliminated && candidate.id !== player.id && !state.smokeProtectedPlayerIds.includes(candidate.id))
    .filter((candidate) => {
      const intimidationSources = state.intimidations[player.id] ?? [];
      return !intimidationSources.includes(candidate.id) || player.hand.some((card) => card.instanceId !== weapon.instanceId);
    })
    .sort((left, right) => left.health - right.health)[0];

  if (!target) {
    return null;
  }

  return { type: "ATTACK", attackerId: player.id, targetPlayerId: target.id, weaponInstanceId: weapon.instanceId };
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
    if (!player.eliminated && player.hand.length > state.settings.maxHandSize && getCurrentPlayer(state).id !== player.id) {
      addIssue(metrics, "non-current player over hand limit");
    }
  });

  if (state.phase === "gameOver" && !state.winnerId) {
    addIssue(metrics, "game over without winner");
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

  if (definition.id === "defense_brace") {
    return damage >= 4 ? 5 : 0;
  }

  return Math.min(damage, definition.block ?? 0);
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
    .reduce((total, card) => total + ((card.damage ?? 0) + (card.splashDamage ?? 0)) * card.count, 0);
  const estimatedSurvivalValue = mainDeckCards.reduce((total, card) => {
    if (card.type === "healing") {
      return total + (card.heal ?? 0) * card.count;
    }
    if (card.id === "defense_dodge" || card.id === "defense_smoke_bomb") {
      return total + 4 * card.count;
    }
    if (card.id === "defense_fake_death" || card.id === "healing_second_wind") {
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
