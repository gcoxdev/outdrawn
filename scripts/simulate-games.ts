import { simulateGames } from "../src/game/simulator";
import type { StrategyLevel } from "../src/game/types";

const games = Number(process.argv[2] ?? 500);
const seed = Number(process.argv[3] ?? 123456);
const scenario = process.argv[4] ?? "competent";
const strategies = getStrategies(scenario);
const summary = simulateGames(games, seed, strategies);

console.log(JSON.stringify(summary, null, 2));

function getStrategies(scenario: string): StrategyLevel[] {
  if (scenario === "mixed") {
    return ["beginner", "novice", "expert", "master"];
  }

  if (scenario.includes(",")) {
    return scenario.split(",").map(toStrategy);
  }

  const strategy = toStrategy(scenario);
  return [strategy, strategy, strategy, strategy];
}

function toStrategy(value: string): StrategyLevel {
  if (["beginner", "novice", "competent", "expert", "master"].includes(value)) {
    return value as StrategyLevel;
  }

  return "competent";
}
