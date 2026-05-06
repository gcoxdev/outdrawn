import { describe, expect, it } from "vitest";
import { STARTING_HAND_SIZE, STARTING_HEALTH } from "../data/constants";
import { deckSummary } from "../data/cards";
import { createNewGame } from "./setup";

describe("game setup", () => {
  it("creates players with health, hands, and a valid current player", () => {
    const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);

    expect(state.phase).toBe("action");
    expect(state.players).toHaveLength(3);
    expect(state.players.every((player) => player.health === STARTING_HEALTH)).toBe(true);
    expect(state.players.every((player) => player.hand.length === STARTING_HAND_SIZE)).toBe(true);
    expect(state.currentPlayerIndex).toBeGreaterThanOrEqual(0);
    expect(state.currentPlayerIndex).toBeLessThan(3);
    expect(state.firstPlayerIndex).toBe(state.currentPlayerIndex);
  });

  it("removes dealt cards from the main deck and keeps event deck separate", () => {
    const state = createNewGame(["Ari", "Blake", "Casey", "Devon"], () => 0);

    expect(state.mainDeck).toHaveLength(deckSummary.mainDeckTotal - 4 * STARTING_HAND_SIZE);
    expect(state.eventDeck).toHaveLength(deckSummary.eventDeckTotal);
    expect(state.discardPile).toHaveLength(0);
  });

  it("stores human and computer player controllers", () => {
    const state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" } },
        { name: "Blake", controller: { type: "computer", strategy: "beginner" } },
        { name: "Casey", controller: { type: "computer", strategy: "master" } }
      ],
      () => 0
    );

    expect(state.players.map((player) => player.controller)).toEqual([
      { type: "human" },
      { type: "computer", strategy: "beginner" },
      { type: "computer", strategy: "master" }
    ]);
  });

  it("defaults legacy name-only players to human controllers", () => {
    const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);

    expect(state.players.every((player) => player.controller.type === "human")).toBe(true);
  });

  it("rejects invalid player counts", () => {
    expect(() => createNewGame(["Ari", "Blake"], () => 0)).toThrow("3 to 6 players");
    expect(() =>
      createNewGame(["Ari", "Blake", "Casey", "Devon", "Eli", "Finn", "Gray"], () => 0)
    ).toThrow("3 to 6 players");
  });
});
