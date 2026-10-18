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


describe("renamed card compatibility", () => {
  it("migrates legacy definitions across deck, hand, pending redirect and events without changing instance IDs", () => {
    const store = storage();
    let state = createNewGame(["A", "B", "C"], () => 0);
    const weapon = { instanceId: "weapon", definitionId: "weapon_pistol" };
    const ricochet = { instanceId: "defense_decoy_original_1", definitionId: "defense_ricochet" };
    state.players[0].hand = [weapon];
    state.players[1].hand = [ricochet];
    state.players[2].hand = [{ instanceId: "defense_fake_death_original_2", definitionId: "defense_revive" }];
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: "weapon" });
    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: ricochet.instanceId });
    expect(state.pendingRedirect).not.toBeNull();
    const aliases: Record<string, string> = { defense_ricochet: "defense_decoy", defense_revive: "defense_fake_death", event_scavenge: "event_high_ground" };
    const legacy = JSON.parse(JSON.stringify(state), (key, value) => key === "definitionId" ? aliases[value] ?? value : value);
    expect(saveGame(legacy, store)).toBe(true);
    const restored = loadGame({ ...state, phase: "setup" }, store);
    expect(restored.phase).toBe("action");
    expect(restored.pendingRedirect).toEqual(state.pendingRedirect);
    expect(restored.mainDeck).toEqual(state.mainDeck);
    expect(restored.players).toEqual(state.players);
    const redirect = { type: "RESOLVE_PENDING_REDIRECT", defenderId: "player_2", targetPlayerId: "player_3" } as const;
    expect(gameReducer(restored, redirect)).toEqual(gameReducer(state, redirect));
  });

  it("restores a legacy Scavenge popup and its queued draw", () => {
    const store = storage(), state = createNewGame(["A", "B"], () => 0);
    const event = { playerId: "player_1", card: { instanceId: "event_high_ground_old_1", definitionId: "event_high_ground" } };
    state.pendingEventDialog = event;
    state.eventDialogQueue = [event];
    state.drawContinuations = [{ playerId: "player_1", cards: [{ instanceId: "old_revive", definitionId: "defense_fake_death" }], remaining: 1, destination: "hand", replaceEvents: true }];
    saveGame(state, store);
    const restored = loadGame({ ...state, phase: "setup" }, store);
    expect(restored.phase).toBe("action");
    expect(restored.pendingEventDialog?.card).toEqual({ ...event.card, definitionId: "event_scavenge" });
    expect(restored.eventDialogQueue?.[0].card.definitionId).toBe("event_scavenge");
    expect(restored.drawContinuations?.[0].cards[0]).toEqual({ instanceId: "old_revive", definitionId: "defense_revive" });
  });
});
