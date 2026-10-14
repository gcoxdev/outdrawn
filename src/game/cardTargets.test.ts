import { describe, expect, it } from "vitest";
import { createNewGame } from "./setup";
import { getCardTargets } from "./cardTargets";

const card = (definitionId: string) => ({ instanceId: definitionId, definitionId });
const game = () => createNewGame(["Ari", "Blake", "Casey", "Drew"], () => 0);
describe("card targets", () => {
  it("keeps protected opponents visible, excludes eliminated players, and preserves seat numbers", () => {
    const state = game();
    state.smokeProtectedPlayerIds = ["player_2"];
    state.players[2].eliminated = true;
    const options = getCardTargets(state, state.players[0], card("weapon_pistol"));
    expect(options.map(option => option.seat)).toEqual([2, 4]);
    expect(options[0].disabledReason).toContain("Smoke Bomb");
    expect(options[1].disabledReason).toBeUndefined();
    expect(getCardTargets(state, state.players[0], card("ability_steal"))[0].disabledReason).toContain("Smoke Bomb");
  });
  it("explains Intimidate's discard requirement but does not apply it to Minigun", () => {
    const state = game();
    const player = state.players[0];
    player.hand = [card("weapon_pistol")];
    state.intimidations[player.id] = ["player_2"];
    expect(getCardTargets(state, player, player.hand[0])[0].disabledReason).toContain("Intimidate");
    player.hand.push(card("defense_dodge"));
    const option = getCardTargets(state, player, player.hand[0])[0];
    expect(option.disabledReason).toBeUndefined();
    expect(option.note).toContain("discard 1");
    expect(getCardTargets(state, player, card("weapon_minigun"))[0].note).toBeUndefined();
  });
  it("filters teammates for healing and transfer independently of Smoke", () => {
    const state = game();
    const player = state.players[0];
    player.teamId = state.players[1].teamId = "team_1";
    state.settings.allowTeamHealing = state.settings.allowTeamCardTransfer = true;
    state.smokeProtectedPlayerIds = ["player_2"];
    state.players[1].health = 1;
    player.health = state.settings.maxHealth;
    const healing = getCardTargets(state, player, card("healing_bandage"));
    expect(healing.map(option => option.seat)).toEqual([1, 2]);
    expect(healing[0].disabledReason).toBe("Already at full health");
    expect(healing[1].disabledReason).toBeUndefined();
    expect(getCardTargets(state, player, card("healing_painkillers"))[0].disabledReason).toBeUndefined();
    expect(getCardTargets(state, player, card("weapon_pistol"), true).map(option => option.seat)).toEqual([2]);
    expect(getCardTargets(state, player, card("weapon_pistol")).map(option => option.seat)).toEqual([3, 4]);
    state.settings.allowTeamHealing = state.settings.allowTeamCardTransfer = false;
    expect(getCardTargets(state, player, card("healing_bandage"))).toHaveLength(1);
    expect(getCardTargets(state, player, card("weapon_pistol"), true)).toEqual([]);
  });
});
