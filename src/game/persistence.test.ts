import { describe, expect, it } from "vitest";
import { createNewGame } from "./setup";
import { loadGame, saveGame, SAVE_KEY } from "./persistence";

function storage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}

describe("local match saves", () => {
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
