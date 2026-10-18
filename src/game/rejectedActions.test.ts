import { describe, expect, it } from "vitest";
import { createNewGame } from "./setup";
import { gameReducer } from "./reducer";
import { getCardTargets } from "./cardTargets";
import { getHandLimitWarning } from "../components/ActionPanel";

const pistol = { instanceId: "pistol", definitionId: "weapon_pistol" };
const attack = { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: "pistol" } as const;

describe("rejected actions", () => {
  it("keeps repeated unpaid Intimidate attacks from changing state or adding logs", () => {
    const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    state.players[0].hand = [pistol];
    state.intimidations = { player_1: ["player_2"] };
    const before = structuredClone(state);
    for (let i = 0; i < 3; i++) expect(gameReducer(state, attack)).toBe(state);
    expect(state).toEqual(before);
    expect(getCardTargets(state, state.players[0], pistol).find(option => option.player.id === "player_2")?.disabledReason).toContain("another card is needed");

    const payable = { ...state, players: state.players.map((p, i) => i ? p : { ...p, hand: [pistol, { instanceId: "cost", definitionId: "defense_dodge" }] }) };
    expect(gameReducer(payable, attack).pendingAttackCost).toMatchObject({ attackerId: "player_1", targetPlayerId: "player_2" });
  });

  it("keeps repeated over-limit End Turn attempts unchanged until discarding", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    state.players[0].hand = Array.from({ length: state.settings.maxHandSize + 1 }, (_, index) => ({ ...pistol, instanceId: `pistol_${index}` }));
    const before = structuredClone(state);
    const end = { type: "END_TURN", playerId: "player_1" } as const;
    for (let i = 0; i < 3; i++) expect(gameReducer(state, end)).toBe(state);
    expect(state).toEqual(before);
    expect(getHandLimitWarning(state.players[0], state.settings.maxHandSize)).toContain("Discard down to");
    state = gameReducer(state, { type: "DISCARD_CARD", playerId: "player_1", cardInstanceId: "pistol_0" });
    expect(getHandLimitWarning(state.players[0], state.settings.maxHandSize)).toBeNull();
    expect(gameReducer(state, end).currentPlayerIndex).toBe(1);
  });
});
