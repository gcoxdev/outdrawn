import { describe, expect, it } from "vitest";
import { createNewGame, createSetupState } from "./setup";
import { gameReducer } from "./reducer";
import { getRicochetTargets } from "./rules";
import { getPlayableReactionCardIds } from "../components/GameTable";
import { assignTeamsForMode, getTeamModeValidation, clampPlayerCount } from "./setupOptions";
import { loadGame, saveGame } from "./persistence";
import { simulateGame, chooseAutomatedAction } from "./simulator";
import type { GameState, StrategyLevel } from "./types";

const weapon = { instanceId: "duel_weapon", definitionId: "weapon_pistol" };
const ricochet = { instanceId: "duel_ricochet", definitionId: "defense_decoy" };
function duel(secondary = false, weaponId = "weapon_pistol") {
  const state = createNewGame(["Ari", "Blake"], () => 0);
  state.settings.allowSecondaryDefense = secondary;
  state.settings.passDeviceMode = false;
  state.players[0].hand = [{ ...weapon, definitionId: weaponId }];
  state.players[1].hand = [ricochet];
  return state;
}
function redirect(state: GameState) {
  let next = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: weapon.instanceId });
  expect(getPlayableReactionCardIds(next, next.players[1])).toContain(ricochet.instanceId);
  next = gameReducer(next, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: ricochet.instanceId });
  expect(chooseAutomatedAction(next, "competent", () => 0)).toMatchObject({ type: "RESOLVE_PENDING_REDIRECT", targetPlayerId: "player_1" });
  return gameReducer(next, { type: "RESOLVE_PENDING_REDIRECT", defenderId: "player_2", targetPlayerId: "player_1" });
}
function restore(state: GameState) {
  let saved = "";
  expect(saveGame(state, { setItem: (_, value) => { saved = value; }, removeItem() {} })).toBe(true);
  const loaded = loadGame(createSetupState(), { getItem: () => saved });
  expect(loaded.phase).toBe(state.phase);
  return loaded;
}

describe("two-player setup and saves", () => {
  it("allows two opponents while rejecting a single player or a single team", () => {
    expect(clampPlayerCount(1)).toBe(2);
    expect(createNewGame(["Ari", "Blake"]).players).toHaveLength(2);
    expect(() => createNewGame(["Ari"])).toThrow("2 to 100");
    expect(getTeamModeValidation("ffa", [], 2).isValid).toBe(true);
    expect(getTeamModeValidation("twoTeams", assignTeamsForMode("twoTeams", 2), 2).isValid).toBe(true);
    expect(getTeamModeValidation("duos", assignTeamsForMode("duos", 2), 2).isValid).toBe(false);
    expect(getTeamModeValidation("custom", ["team_1", "team_1"], 2).isValid).toBe(false);
    expect(restore(duel()).players).toHaveLength(2);
  });
  it.each(["beginner", "novice", "competent", "expert", "master"] as StrategyLevel[])("completes strict two-player simulations with %s computers", strategy => {
    for (const turnOrder of ["roundRobin", "standard"] as const) for (const allowSecondaryDefense of [false, true]) {
      const result = simulateGame(20261017, [strategy], { playerCount: 2, strict: true, settings: { turnOrder, allowSecondaryDefense } });
      expect(result.stalled).toBe(false);
      expect(result.state.phase).toBe("gameOver");
      expect(restore(result.state).players).toHaveLength(2);
    }
  });
});

describe("Ricochet attacker fallback", () => {
  it.each([false, true])("returns damage, spends one action, and preserves save/restore with secondary defense %s", secondary => {
    const start = duel(secondary);
    let state = redirect(start);
    if (secondary) {
      state = restore(state);
      expect(state.pendingSecondaryDamage).toMatchObject({ attackerId: "player_2", defenderId: "player_1", source: "ricochet" });
      state = gameReducer(state, { type: "SKIP_SECONDARY_REACTION", defenderId: "player_1" });
    }
    expect(state.players[0].health).toBe(start.players[0].health - 3);
    expect(state.players[1].health).toBe(start.players[1].health);
    expect(state.players[1].damageDealt).toBe(3);
    expect(state.players[0].actionsRemaining).toBe(start.players[0].actionsRemaining - 1);
    expect(state.discardPile.filter(card => [weapon.instanceId, ricochet.instanceId].includes(card.instanceId))).toHaveLength(2);
  });
  it.each([false, true])("credits lethal reflected damage to the Ricochet player, secondary defense %s", secondary => {
    const start = duel(secondary); start.players[0].health = 3;
    let state = redirect(start);
    if (secondary) state = gameReducer(state, { type: "SKIP_SECONDARY_REACTION", defenderId: "player_1" });
    expect(state.phase).toBe("gameOver");
    expect(state.winnerId).toBe("player_2");
    expect(state.players[1]).toMatchObject({ eliminations: 1, damageDealt: 3 });
    expect(state.players[0]).toMatchObject({ eliminated: true, health: 0, eliminations: 0 });
  });
  it("offers ordinary secondary defense but never another Ricochet", () => {
    const start = duel(true);
    const dodge = { instanceId: "dodge", definitionId: "defense_dodge" };
    const secondRicochet = { ...ricochet, instanceId: "second_ricochet" };
    start.players[0].hand.push(dodge, secondRicochet);
    const state = redirect(start);
    expect(getPlayableReactionCardIds(state, state.players[0])).toEqual([dodge.instanceId]);
    expect(gameReducer(state, { type: "PLAY_SECONDARY_REACTION", defenderId: "player_1", reactionCardInstanceId: secondRicochet.instanceId })).toBe(state);
    const defended = gameReducer(state, { type: "PLAY_SECONDARY_REACTION", defenderId: "player_1", reactionCardInstanceId: dodge.instanceId });
    expect(defended.players[0].health).toBe(start.players[0].health);
    expect(defended.pendingSecondaryDamage).toBeNull();
  });
  it("finishes counter damage against the Ricochet player", () => {
    const start = duel(true);
    start.players[0].hand.push({ instanceId: "counter", definitionId: "defense_counterattack" });
    let state = redirect(start);
    state = gameReducer(state, { type: "PLAY_SECONDARY_REACTION", defenderId: "player_1", reactionCardInstanceId: "counter" });
    expect(state.pendingSecondaryDamage).toMatchObject({ attackerId: "player_1", defenderId: "player_2", source: "counterattack" });
    state = gameReducer(state, { type: "SKIP_SECONDARY_REACTION", defenderId: "player_2" });
    expect(state.players.map(player => player.health)).toEqual([17, 17]);
  });
  it.each([false, true])("continues the second SMG hit when the shooter survives, secondary defense %s", secondary => {
    let state = redirect(duel(secondary, "weapon_smg"));
    if (secondary) state = gameReducer(state, { type: "SKIP_SECONDARY_REACTION", defenderId: "player_1" });
    expect(state.pendingReaction).toMatchObject({ attackerId: "player_1", defenderId: "player_2", baseDamage: 2 });
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: "player_2" });
    expect(state.players.map(player => player.health)).toEqual([18, 18]);
    expect(state.pendingMultiHitAttack).toBeNull();
    expect(state.discardPile.filter(card => card.instanceId === weapon.instanceId)).toHaveLength(1);
  });
  it("preserves Reload when returning the attack", () => {
    const start = duel(); start.reloadPlayerIds = ["player_1"];
    const state = redirect(start);
    expect(state.players[0].hand).toContainEqual(weapon);
    expect(state.reloadPlayerIds).toEqual([]);
    expect(state.discardPile).not.toContainEqual(weapon);
  });
  it.each([false, true])("stops SMG when the reflected first hit kills its shooter, secondary defense %s", secondary => {
    const start = duel(secondary, "weapon_smg"); start.players[0].health = 2;
    let state = redirect(start);
    if (secondary) state = gameReducer(state, { type: "SKIP_SECONDARY_REACTION", defenderId: "player_1" });
    expect(state.winnerId).toBe("player_2");
    expect(state.pendingMultiHitAttack).toBeNull();
    expect(state.players[1].health).toBe(20);
    expect(state.discardPile.filter(card => card.instanceId === weapon.instanceId)).toHaveLength(1);
  });
  it("lets the original attacker use Revive against a lethal reflected hit when secondary defense is enabled", () => {
    const start = duel(true); start.players[0].health = 2;
    start.players[0].hand.push({ instanceId: "revive", definitionId: "defense_fake_death" });
    const pending = redirect(start);
    const state = gameReducer(pending, { type: "PLAY_SECONDARY_REACTION", defenderId: "player_1", reactionCardInstanceId: "revive" });
    expect(state.players[0]).toMatchObject({ health: 1, eliminated: false, hand: [] });
    expect(state.phase).toBe("action");
  });
  it("prioritizes other opponents even when they have Smoke protection", () => {
    const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    state.smokeProtectedPlayerIds = ["player_3"];
    expect(getRicochetTargets(state, "player_1", "player_2").map(player => player.id)).toEqual(["player_3"]);
    state.pendingRedirect = { attackerId: "player_1", defenderId: "player_2", weapon, decoy: ricochet, baseDamage: 3 };
    expect(gameReducer(state, { type: "RESOLVE_PENDING_REDIRECT", defenderId: "player_2", targetPlayerId: "player_1" })).toBe(state);
    state.players[2].eliminated = true;
    expect(getRicochetTargets(state, "player_1", "player_2").map(player => player.id)).toEqual(["player_1"]);
  });
  it("ignores teammates when deciding whether an opponent is available", () => {
    const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    state.players[0].teamId = "team_1";
    state.players[1].teamId = state.players[2].teamId = "team_2";
    expect(getRicochetTargets(state, "player_1", "player_2").map(player => player.id)).toEqual(["player_1"]);
  });
});
