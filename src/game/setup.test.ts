import { describe, expect, it } from "vitest";
import { defaultGameSettings, STARTING_HAND_SIZE, STARTING_HEALTH } from "../data/constants";
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

  it("removes dealt cards from the main deck and mixes events after starting hands", () => {
    const state = createNewGame(["Ari", "Blake", "Casey", "Devon"], () => 0);

    expect(state.mainDeck).toHaveLength(deckSummary.mainDeckTotal + deckSummary.eventDeckTotal - 4 * STARTING_HAND_SIZE);
    expect(state.eventDeck).toHaveLength(0);
    expect(state.players.flatMap((player) => player.hand).some((card) => card.definitionId.startsWith("event_"))).toBe(false);
    expect(state.mainDeck.some((card) => card.definitionId.startsWith("event_"))).toBe(true);
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
    expect(() => createNewGame(["Ari", "Blake"], () => 0)).toThrow("3 to 100 players");
    expect(() =>
      createNewGame(Array.from({ length: 101 }, (_, index) => `Player ${index + 1}`), () => 0)
    ).toThrow("3 to 100 players");
  });

  it("supports one hundred players", () => {
    const players = Array.from({ length: 100 }, (_, index) => `Player ${index + 1}`);
    const state = createNewGame(players, () => 0.5);

    expect(state.players).toHaveLength(100);
    expect(state.players.every((player) => player.hand.length === STARTING_HAND_SIZE)).toBe(true);
    expect(state.currentPlayerIndex).toBeGreaterThanOrEqual(0);
    expect(state.currentPlayerIndex).toBeLessThan(100);
  });

  it("does not capture debug snapshots while disabled", () => {
    const state = createNewGame(["Ari", "Blake", "Casey"], () => 0, { ...defaultGameSettings, debugHandSnapshots: false });

    expect(state.log[0].handSnapshots).toHaveLength(0);
    expect(state.log[0].debugHandSnapshots).toHaveLength(0);
  });

  it("skips hidden debug snapshots for large games unless debug snapshots are enabled", () => {
    const players = Array.from({ length: 25 }, (_, index) => `Player ${index + 1}`);
    const hiddenState = createNewGame(players, () => 0, { ...defaultGameSettings, debugHandSnapshots: false });
    const visibleState = createNewGame(players, () => 0, { ...defaultGameSettings, debugHandSnapshots: true });

    expect(hiddenState.log[0].handSnapshots).toHaveLength(0);
    expect(hiddenState.log[0].debugHandSnapshots).toHaveLength(0);
    expect(visibleState.log[0].handSnapshots).toHaveLength(25);
    expect(visibleState.log[0].debugHandSnapshots).toHaveLength(25);
  });
});
