import { describe, expect, it } from "vitest";
import { chooseAutomatedAction, simulateGames } from "./simulator";
import { createNewGame } from "./setup";

describe("game simulator", () => {
  it("can complete batches of automated games without stalling", () => {
    const summary = simulateGames(25, 8675309);

    expect(summary.gamesPlayed).toBe(25);
    expect(summary.completedGames).toBeGreaterThan(20);
    expect(summary.averageTurns).toBeGreaterThan(0);
  });

  it("reports configured strategy levels and winner strategy totals", () => {
    const summary = simulateGames(25, 8675309, ["beginner", "novice", "expert", "master"]);

    expect(summary.strategies).toEqual(["beginner", "novice", "expert", "master"]);
    expect(Object.values(summary.winnerStrategies).reduce((total, count) => total + count, 0)).toBe(summary.completedGames);
  });

  it("can choose a live game action for a computer-controlled turn", () => {
    const state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" } },
        { name: "Blake", controller: { type: "computer", strategy: "master" } },
        { name: "Casey", controller: { type: "computer", strategy: "novice" } }
      ],
      () => 0
    );

    const action = chooseAutomatedAction(state, "master", () => 0.5);

    expect(action.type).not.toBe("SELECT_CARD");
    expect(action.type).not.toBe("START_GAME");
  });
});
