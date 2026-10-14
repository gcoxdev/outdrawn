import { writeFileSync } from "node:fs";
import { simulateGame, type SimulationOptions } from "../src/game/simulator";

const seedBase = 20261013;
const scenarios: Array<{ name: string; games: number; options: SimulationOptions }> = [
  { name: "default-4", games: 200, options: {} },
  ...[
    ["free-draw", { freeDrawsPerTurn: 1 }],
    ["starting-hand-7", { startingHandSize: 7 }],
    ["health-25", { startingHealth: 25 }],
    ["actions-3", { actionsPerTurn: 3 }],
    ["secondary-defense", { allowSecondaryDefense: true }],
    ["elimination-reward-2", { eliminationHealthReward: 2 }],
  ].map(([name, settings]) => ({ name: String(name), games: 100, options: { settings } as SimulationOptions })),
  { name: "duos", games: 100, options: { teams: ["a", "a", "b", "b"] } },
  { name: "duos-no-support", games: 100, options: { teams: ["a", "a", "b", "b"], settings: { allowTeamHealing: false, allowTeamCardTransfer: false } } },
  ...[3, 6, 16, 17, 18, 33, 34, 35, 50, 51, 52, 100].map(playerCount => ({ name: `players-${playerCount}`, games: playerCount >= 50 ? 12 : 30, options: { playerCount } })),
];
const mean = (values: number[]) => +(values.reduce((sum, value) => sum + value, 0) / (values.length || 1)).toFixed(2);
const results = scenarios.map(scenario => {
  const runs = Array.from({ length: scenario.games }, (_, index) => {
    const seed = seedBase + index * 9973;
    const result = simulateGame(seed, ["competent"], { ...scenario.options, strict: true });
    if (result.stalled) throw new Error(`${scenario.name} stalled at ${seed}`);
    return { seed, winnerId: result.state.winnerId, winnerTeamId: result.state.winnerTeamId, outcome: result.state.outcome?.kind, rounds: result.state.round, metrics: result.metrics };
  });
  const cards: Record<string, Record<string, number>> = {};
  for (const run of runs) for (const [id, counts] of Object.entries(run.metrics.cards)) for (const [key, count] of Object.entries(counts)) {
    cards[id] ??= {}; cards[id][key] = (cards[id][key] ?? 0) + count;
  }
  const output = { ...scenario, completed: runs.length, meanTurns: mean(runs.map(run => run.metrics.turns)), meanRounds: mean(runs.map(run => run.rounds)), meanDecisions: mean(runs.map(run => run.metrics.decisions)), meanFirstEliminationDecision: mean(runs.map(run => Math.min(...Object.values(run.metrics.eliminatedAtDecision)))), meanEliminatedWaitingDecisions: mean(runs.flatMap(run => Object.values(run.metrics.waitingDecisions))), meanAttackDamage: mean(runs.map(run => run.metrics.attackDamage)), meanEventDamage: mean(runs.map(run => run.metrics.eventDamage)), meanCollapseDamage: mean(runs.map(run => run.metrics.collapseDamage)), meanHealing: mean(runs.map(run => run.metrics.healing)), cards, runs };
  console.log(`${scenario.name}: ${runs.length} completed; ${output.meanTurns} turns, ${output.meanEventDamage} event damage, ${output.meanCollapseDamage} collapse damage`);
  return output;
});
writeFileSync(process.argv[2] ?? "internal/balance-followup.json", JSON.stringify({ seedBase, seedStride: 9973, definitions: { exposures: "Unique player/card-instance holdings, including starting hands and loot", decisionExposures: "Cards in the acting player's hand at a decision; not a legal-play opportunity count", plays: "Accepted explicit card plays; excludes transfers and automatic healing during Revive", damage: "Actual HP removed, capped at remaining health", prevention: "HP loss prevented, capped at pre-hit HP; includes Revive's retained 1 HP", targetsDamaged: "Resolved hits, not unique opponents", actionsSpent: "Net actions consumed by an explicit play; action gains may offset costs", winningPlayerExposures: "Exposure on winners; association, not causal win contribution", waitingDecisions: "Reducer decisions from elimination to match end; not human time" }, results }, null, 2));
