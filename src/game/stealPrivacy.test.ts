import { describe, expect, it } from "vitest";
import { gameReducer } from "./reducer";
import { createNewGame, createSetupState } from "./setup";
import { loadGame, saveGame } from "./persistence";
import { chooseAutomatedAction, getBotObservation } from "./simulator";
import { validateSavedGame } from "./validateSave";

const card = (instanceId: string, definitionId: string) => ({ instanceId, definitionId });
function fixture() {
  const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
  state.deckRandomState = 1234;
  state.players[0].hand = [card("steal", "ability_steal")];
  state.players[1].hand = [card("pistol", "weapon_pistol"), card("dodge", "defense_dodge"), card("bandage", "healing_bandage"), card("sniper", "weapon_sniper_rifle")];
  return state;
}
const play = { type: "PLAY_ABILITY", playerId: "player_1", cardInstanceId: "steal", targetPlayerId: "player_2" } as const;

describe("face-down Steal choices", () => {
  it("shuffles each choice without changing hand order or mutating the input", () => {
    const before = fixture();
    const original = structuredClone(before);
    const next = gameReducer(before, play);
    const handIds = before.players[1].hand.map(card => card.instanceId);
    expect(next.pendingSteal!.cardInstanceIds).not.toEqual(handIds);
    expect([...next.pendingSteal!.cardInstanceIds].sort()).toEqual([...handIds].sort());
    expect(next.players[1].hand).toEqual(before.players[1].hand);
    expect(before).toEqual(original);
    expect(gameReducer(before, play)).toEqual(next);
    expect(next.deckRandomState).not.toBe(before.deckRandomState);
  });

  it("preserves the chosen layout across selection updates and save/reload", () => {
    const next = gameReducer(fixture(), play);
    const selected = gameReducer(next, { type: "SELECT_CARD", cardInstanceId: null });
    expect(selected.pendingSteal).toEqual(next.pendingSteal);
    let raw = "";
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; }, removeItem() {} };
    saveGame(selected, storage);
    const restored = loadGame(createSetupState(), storage);
    expect(restored.pendingSteal).toEqual(next.pendingSteal);
    expect(restored.deckRandomState).toBe(next.deckRandomState);
    const chosenId = restored.pendingSteal!.cardInstanceIds[0];
    const resolved = gameReducer(restored, { type: "RESOLVE_PENDING_STEAL", playerId: "player_1", targetPlayerId: "player_2", cardInstanceId: chosenId });
    expect(resolved.pendingSteal).toBeNull();
    expect(resolved.players[0].hand.map(card => card.instanceId)).toContain(chosenId);
    expect(resolved.players[1].hand.map(card => card.instanceId)).not.toContain(chosenId);
  });

  it("advances the shuffle stream for another Steal", () => {
    const first = gameReducer(fixture(), play);
    let next = gameReducer(first, { type: "RESOLVE_PENDING_STEAL", playerId: "player_1", targetPlayerId: "player_2", cardInstanceId: first.pendingSteal!.cardInstanceIds[0] });
    next = { ...next, players: next.players.map((p, i) => i === 0 ? { ...p, hand: [...p.hand, card("steal2", "ability_steal")] } : p) };
    const second = gameReducer(next, { ...play, cardInstanceId: "steal2" });
    expect(second.deckRandomState).not.toBe(first.deckRandomState);
    expect([...second.pendingSteal!.cardInstanceIds].sort()).toEqual(next.players[1].hand.map(card => card.instanceId).sort());
  });

  it.each(["beginner", "novice", "competent", "expert", "master"] as const)("%s chooses an opaque slot and resolves its shuffled card", strategy => {
    const state = gameReducer(fixture(), play);
    const observation = getBotObservation(state);
    expect(observation.pendingSteal!.cardInstanceIds).toEqual(["hidden_0", "hidden_1", "hidden_2", "hidden_3"]);
    const action = chooseAutomatedAction(state, strategy, () => 0);
    expect(action).toMatchObject({ type: "RESOLVE_PENDING_STEAL", cardInstanceId: state.pendingSteal!.cardInstanceIds[0] });
    expect(gameReducer(state, action).pendingSteal).toBeNull();
  });

  it.each([[], ["pistol", "pistol", "dodge", "sniper"], ["pistol", "dodge", "bandage", "missing"]].map(order => ({ order })))("rejects an incomplete, duplicated, or stale saved choice: $order", ({ order }) => {
    const state = gameReducer(fixture(), play);
    state.pendingSteal!.cardInstanceIds = order;
    expect(() => validateSavedGame(state)).toThrow();
  });

  it("does not name transferred cards in the shared log", () => {
    const state = fixture();
    state.players[0].teamId = state.players[1].teamId = "team_1";
    state.players[2].teamId = "team_2";
    state.players[0].hand = [card("secret", "weapon_sniper_rifle")];
    const next = gameReducer(state, { type: "TRANSFER_CARD", playerId: "player_1", targetPlayerId: "player_2", cardInstanceId: "secret" });
    expect(next.log.at(-1)?.message).toBe("Ari transferred a card to Blake.");
    expect(next.players[1].hand.at(-1)?.instanceId).toBe("secret");
  });
});
