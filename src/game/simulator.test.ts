import { describe, expect, it } from "vitest";
import { simulateGames } from "./simulator";

describe("game simulator", () => {
  it("can complete batches of automated games without stalling", () => {
    const summary = simulateGames(25, 8675309);

    expect(summary.gamesPlayed).toBe(25);
    expect(summary.completedGames).toBeGreaterThan(20);
    expect(summary.averageTurns).toBeGreaterThan(0);
  });
});
