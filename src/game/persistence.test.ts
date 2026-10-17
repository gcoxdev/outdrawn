import { describe, expect, it } from "vitest";
import { createNewGame } from "./setup";
import { loadGame, saveGame, SAVE_KEY } from "./persistence";
import { gameReducer } from "./reducer";

function storage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}

describe("local match saves", () => {
  it("preserves rotating-start saves when round robin is the new default", () => {
    const store = storage(), state = createNewGame(["A", "B", "C"], () => 0);
    state.settings.turnOrder = "standard";
    expect(saveGame(state, store)).toBe(true);
    const restored = loadGame({ ...state, phase: "setup" }, store);
    expect(restored.phase).toBe("action");
    expect(restored.settings.turnOrder).toBe("standard");
  });
  it("preserves the next shuffle across saves and repeated reducer calls", () => {
    const store = storage(), state = createNewGame(["A", "B", "C"], () => 0);
    state.mainDeck = [];
    state.discardPile = state.players.flatMap(player => player.hand);
    state.players.forEach(player => { player.hand = []; });
    state.deckRandomState = 1234;
    const action = { type: "DRAW_CARD", playerId: "player_1" } as const;
    const next = gameReducer(state, action);
    expect(next.deckRandomState).not.toBe(state.deckRandomState);
    expect(gameReducer(state, action)).toEqual(next);
    expect(saveGame(state, store)).toBe(true);
    const loaded = loadGame({ ...state, phase: "setup" }, store);
    expect(gameReducer(loaded, action)).toEqual(next);
    // Also persist an already-advanced stream before a subsequent refill.
    next.discardPile = [...next.mainDeck, ...next.players[0].hand];
    next.mainDeck = [];
    next.players[0].hand = [];
    expect(saveGame(next, store)).toBe(true);
    const resumed = loadGame({ ...state, phase: "setup" }, store);
    expect(gameReducer(resumed, action)).toEqual(gameReducer(next, action));
  });

  it("adds shuffle state to older v1 saves without resetting the match", () => {
    const store = storage(), state = createNewGame(["A", "B", "C"], () => 0);
    delete state.deckRandomState;
    saveGame(state, store);
    const restored = loadGame({ ...state, phase: "setup" }, store);
    expect(restored.phase).toBe("action");
    expect(restored.players).toEqual(state.players);
    expect(Number.isInteger(restored.deckRandomState)).toBe(true);
    saveGame(restored, store);
    expect(loadGame({ ...state, phase: "setup" }, store).deckRandomState).toBe(restored.deckRandomState);
  });

  it("restores a suspended event and its draw continuation", () => {
    const store = storage(), state = createNewGame(["A", "B", "C"], () => 0);
    state.pendingEventDialog = { playerId: "player_1", card: { instanceId: "event", definitionId: "event_supply_drop" } };
    state.drawContinuations = [{ playerId: "player_1", remaining: 2, destination: "hand", replaceEvents: true, cards: [] }];
    state.selectedCardId = state.players[0].hand[0].instanceId;
    expect(saveGame(state, store)).toBe(true);
    const restored = loadGame({ ...state, phase: "setup" }, store);
    expect(restored.phase).toBe("action");
    expect(restored.drawContinuations).toEqual(state.drawContinuations);
    expect(restored.pendingEventDialog).toEqual(state.pendingEventDialog);
    expect(restored.selectedCardId).toBeNull();
  });
  it("ignores corrupt and unsupported saves and clears abandoned matches", () => {
    const store = storage(), fallback = { ...createNewGame(["A", "B", "C"]), phase: "setup" as const };
    for (const raw of ["{", '{"version":2}', '{"version":1,"payload":"{}","checksum":"wrong"}']) {
      store.setItem(SAVE_KEY, raw);
      expect(loadGame(fallback, store)).toBe(fallback);
    }
    saveGame(fallback, store);
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });
  it("handles unavailable browser storage without crashing", () => {
    const state = createNewGame(["A", "B", "C"]);
    expect(saveGame(state, { setItem() { throw new Error("quota"); }, removeItem() {} })).toBe(false);
    expect(loadGame(state, { getItem() { throw new Error("blocked"); } })).toBe(state);
  });
});
