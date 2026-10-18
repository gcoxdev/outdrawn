import { describe, expect, it } from "vitest";
import { readSavedMatch, saveGame } from "./persistence";
import { createNewGame, createSetupState } from "./setup";
import { gameReducer } from "./reducer";
import { labelTeam } from "./rules";
import type { GameState } from "./types";

function restoreLegacy(value: unknown) {
  let raw = "";
  const storage = { getItem: () => raw, setItem: (_key: string, text: string) => { raw = text; }, removeItem() {} };
  // Serialize a historical shape through the real checksum/envelope writer.
  saveGame(value as GameState, storage);
  return { loaded: readSavedMatch(createSetupState(), storage), raw, storage };
}

function legacyState() {
  const state = createNewGame(["A", "B", "C"], () => 0);
  return { ...state, activeEvent: null, pendingSupplyDrop: null, eventDeck: [],
    settings: { ...state.settings, blackMarketCustom: { ...state.settings.blackMarketCustom, actionCost: 0 } } };
}

describe("compatible v1 save migration", () => {
  it("drops inert legacy fields without resetting the match or losing cards", () => {
    const legacy = legacyState();
    legacy.players[0].teamId = legacy.players[1].teamId = "team_a";
    legacy.players[2].teamId = "team_b";
    const { loaded, storage } = restoreLegacy(legacy);
    expect(loaded.rejected).toBeUndefined();
    expect(loaded.state.phase).toBe("action");
    expect(loaded.state.players).toEqual(legacy.players);
    expect(loaded.state.mainDeck).toEqual(legacy.mainDeck);
    for (const key of ["activeEvent", "pendingSupplyDrop", "eventDeck"]) expect(loaded.state).not.toHaveProperty(key);
    expect(loaded.state.settings.blackMarketCustom).not.toHaveProperty("actionCost");
    expect(labelTeam(loaded.state.players[0].teamId!)).toBe("Team A");
    saveGame(loaded.state, storage);
    expect(readSavedMatch(createSetupState(), storage).state).toEqual(loaded.state);
  });

  it("migrates a pending old Steal to a stable shuffled choice", () => {
    const legacy = { ...legacyState(), pendingSteal: { playerId: "player_1", targetPlayerId: "player_2" } };
    const { loaded, storage } = restoreLegacy(legacy);
    expect(loaded.rejected).toBeUndefined();
    const order = loaded.state.pendingSteal!.cardInstanceIds;
    expect([...order].sort()).toEqual(legacy.players[1].hand.map(card => card.instanceId).sort());
    saveGame(loaded.state, storage);
    const resumed = readSavedMatch(createSetupState(), storage).state;
    expect(resumed.pendingSteal!.cardInstanceIds).toEqual(order);
    const resolved = gameReducer(resumed, { type: "RESOLVE_PENDING_STEAL", playerId: "player_1", targetPlayerId: "player_2", cardInstanceId: order[0] });
    expect(resolved.pendingSteal).toBeNull();
    expect(resolved.players[0].hand.map(card => card.instanceId)).toContain(order[0]);
  });

  it.each([
    { activeEvent: { card: { instanceId: "old-event", definitionId: "event_bounty" }, timing: "thisRound" } },
    { pendingSupplyDrop: { playerOrder: ["player_1"], currentIndex: 0, revealedCards: [{ instanceId: "old-card", definitionId: "weapon_pistol" }] } },
    { eventDeck: [{ instanceId: "old-event", definitionId: "event_pressure_zone" }] }
  ])("preserves unsupported historical data for recovery instead of dropping owned cards: %j", fields => {
    const { loaded, raw } = restoreLegacy({ ...legacyState(), ...fields });
    expect(loaded.state.phase).toBe("setup");
    expect(loaded.rejected).toBe(raw);
    expect(loaded.reason).toBeTruthy();
  });
});
