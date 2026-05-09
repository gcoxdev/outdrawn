import { simulateGames } from "../src/game/simulator";
import type { GameSettings } from "../src/data/constants";
import type { StrategyLevel } from "../src/game/types";

type Scenario = {
  name: string;
  settings?: Partial<GameSettings>;
  playerCount?: number;
};

const games = Number(process.argv[2] ?? 1500);
const seed = Number(process.argv[3] ?? 20260508);
const mixedStrategies: StrategyLevel[] = ["beginner", "novice", "expert", "master"];
const scenarios: Scenario[] = [
  { name: "Default" },
  { name: "Round robin", settings: { turnOrder: "roundRobin" } },
  { name: "Secondary defense", settings: { allowSecondaryDefense: true } },
  { name: "Elimination reward 2", settings: { eliminationHealthReward: 2 } },
  { name: "Elimination reward 4", settings: { eliminationHealthReward: 4 } },
  { name: "Black Market discount", settings: { blackMarketPreset: "discount" } },
  { name: "Black Market no-action", settings: { blackMarketPreset: "noAction" } },
  { name: "Black Market bigger", settings: { blackMarketPreset: "bigger" } },
  { name: "Black Market health-pay", settings: { blackMarketPreset: "healthPay" } },
  { name: "Variety standard", settings: { turnOrder: "roundRobin", allowSecondaryDefense: true, eliminationHealthReward: 2, blackMarketPreset: "discount" } },
  { name: "25 HP large hand", settings: { startingHealth: 25, maxHealth: 25, startingHandSize: 7, maxHandSize: 10, actionsPerTurn: 3 } },
  {
    name: "25 HP large hand + variety",
    settings: {
      startingHealth: 25,
      maxHealth: 25,
      startingHandSize: 7,
      maxHandSize: 10,
      actionsPerTurn: 3,
      turnOrder: "roundRobin",
      allowSecondaryDefense: true,
      eliminationHealthReward: 2,
      blackMarketPreset: "discount"
    }
  },
  { name: "6 players default", playerCount: 6 },
  { name: "6 players variety", playerCount: 6, settings: { turnOrder: "roundRobin", allowSecondaryDefense: true, eliminationHealthReward: 2, blackMarketPreset: "discount" } }
];

const results = scenarios.flatMap((scenario, index) => [
  summarizeScenario(scenario, "competent", ["competent"], seed + index * 100000),
  summarizeScenario(scenario, "mixed", mixedStrategies, seed + index * 100000 + 50000)
]);

console.log(JSON.stringify({ gamesPerRun: games, seed, results }, null, 2));

function summarizeScenario(scenario: Scenario, strategyLabel: string, strategies: StrategyLevel[], scenarioSeed: number) {
  const summary = simulateGames(games, scenarioSeed, strategies, {
    settings: scenario.settings,
    playerCount: scenario.playerCount
  });
  const totalPressure = summary.observed.attackDamage + summary.observed.eventDamage + summary.observed.selfDamage;
  const totalSurvival = summary.observed.healing + summary.observed.preventedAttackDamage;
  const winnerStrategyWins = Object.fromEntries(
    Object.entries(summary.winnerStrategies).sort((left, right) => strategyRank(left[0]) - strategyRank(right[0]))
  );

  return {
    scenario: scenario.name,
    strategy: strategyLabel,
    completed: summary.completedGames,
    stalled: summary.stalledGames,
    averageRounds: round(summary.averageRounds),
    averageTurns: round(summary.averageTurns),
    minTurns: summary.minTurns,
    maxTurns: summary.maxTurns,
    trueTies: summary.winners.none ?? 0,
    pressureToSurvival: round(totalSurvival > 0 ? totalPressure / totalSurvival : totalPressure),
    attackDamagePerGame: round(summary.observed.attackDamage / summary.gamesPlayed),
    eventDamagePerGame: round(summary.observed.eventDamage / summary.gamesPlayed),
    healingPreventedPerGame: round(totalSurvival / summary.gamesPlayed),
    attacksPerGame: round(summary.observed.attackCardsPlayed / summary.gamesPlayed),
    defensesPerGame: round(summary.observed.defenseCardsPlayed / summary.gamesPlayed),
    abilitiesPerGame: round(summary.observed.abilityCardsPlayed / summary.gamesPlayed),
    winnerStrategies: winnerStrategyWins,
    issues: summary.issues
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function strategyRank(strategy: string) {
  return ["beginner", "novice", "competent", "expert", "master", "none"].indexOf(strategy);
}
