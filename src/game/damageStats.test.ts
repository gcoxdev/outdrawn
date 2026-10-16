import { describe, expect, it } from "vitest";
import { createNewGame } from "./setup";
import { gameReducer } from "./reducer";
import { loadGame, readSavedMatch, saveGame } from "./persistence";
import type { GameState } from "./types";

function fixture(weapon = "weapon_pistol", reaction?: string) {
  const state = createNewGame(["Ari", "Blake", "Casey", "Devon"], () => 0);
  state.players.forEach(player => { player.hand = []; });
  state.players[0].hand = [{ instanceId: "weapon", definitionId: weapon }];
  if (reaction) state.players[1].hand = [{ instanceId: "reaction", definitionId: reaction }];
  state.mainDeck = [{ instanceId: "draw", definitionId: "weapon_pistol" }];
  return state;
}
function attack(state: GameState) {
  return gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: "weapon", damageByTarget: { player_2: 3, player_3: 3 } });
}
function takeHit(state: GameState) {
  return gameReducer(state, { type: "SKIP_REACTION", defenderId: "player_2" });
}
function defend(state: GameState) {
  return gameReducer(state, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: "reaction" });
}
function storage() {
  let raw: string | null = null;
  return { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; }, removeItem: () => { raw = null; } };
}

describe("player damage totals", () => {
  it("counts health actually removed after defense and does not recount on selection or rejected actions", () => {
    let state = attack(fixture("weapon_assault_rifle", "defense_armor_vest"));
    expect(state.players[0].damageDealt).toBe(0);
    state = defend(state);
    expect(state.players[0].damageDealt).toBe(1);
    state = gameReducer(state, { type: "SELECT_CARD", cardInstanceId: null });
    expect(state.players[0].damageDealt).toBe(1);
    expect(takeHit(state)).toBe(state);
  });

  it("caps overkill at remaining health and retains kills", () => {
    const state = fixture("weapon_sniper_rifle");
    state.players[1].health = 2;
    const next = takeHit(attack(state));
    expect(next.players[0]).toMatchObject({ damageDealt: 2, eliminations: 1 });
  });

  it.each([false, true])("counts Grenade splash and Minigun damage with secondary defense %s", allowSecondaryDefense => {
    for (const [weapon, expected] of [["weapon_grenade", 8], ["weapon_minigun", 6]] as const) {
      let state = fixture(weapon);
      state.settings.allowSecondaryDefense = allowSecondaryDefense;
      state = attack(state);
      if (state.pendingReaction) state = takeHit(state);
      for (let i = 0; i < 3 && state.pendingSecondaryDamage; i++) {
        state = gameReducer(state, { type: "SKIP_SECONDARY_REACTION", defenderId: state.pendingSecondaryDamage.defenderId });
      }
      expect(state.pendingSecondaryDamage).toBeNull();
      expect(state.players[0].damageDealt).toBe(expected);
    }
  });

  it.each([false, true])("credits counterattack and backfire to the defender with secondary defense %s", allowSecondaryDefense => {
    for (const reaction of ["defense_counterattack", "defense_backfire"]) {
      let state = fixture("weapon_pistol", reaction);
      state.settings.allowSecondaryDefense = allowSecondaryDefense;
      state = defend(attack(state));
      if (state.pendingSecondaryDamage) state = gameReducer(state, { type: "SKIP_SECONDARY_REACTION", defenderId: "player_1" });
      expect(state.players[1].damageDealt).toBe(3);
      expect(state.players[0].damageDealt).toBe(reaction === "defense_backfire" ? 0 : 3);
    }
  });

  it("counts damage before Revive healing without counting prevented lethal damage", () => {
    const state = fixture("weapon_sniper_rifle", "defense_fake_death");
    state.players[1].health = 2;
    state.players[1].hand.push({ instanceId: "bandage", definitionId: "healing_bandage" });
    const next = defend(attack(state));
    expect(next.players[1].health).toBe(4);
    expect(next.players[0].damageDealt).toBe(1);
  });

  it.each([false, true])("keeps Ricochet damage and kill credit with the original attacker, secondary defense %s", allowSecondaryDefense => {
    let state = fixture("weapon_pistol", "defense_decoy");
    state.settings.allowSecondaryDefense = allowSecondaryDefense;
    state.players[2].health = 2;
    state = defend(attack(state));
    state = gameReducer(state, { type: "RESOLVE_PENDING_REDIRECT", defenderId: "player_2", targetPlayerId: "player_3" });
    if (state.pendingSecondaryDamage) state = gameReducer(state, { type: "SKIP_SECONDARY_REACTION", defenderId: "player_3" });
    expect(state.players[0]).toMatchObject({ damageDealt: 2, eliminations: 1 });
    expect(state.players[1].damageDealt).toBe(0);
  });

  it("does not credit self-damage, events or collapse to a player", () => {
    let state = fixture("ability_adrenaline");
    state = gameReducer(state, { type: "PLAY_ABILITY", playerId: "player_1", cardInstanceId: "weapon" });
    state.mainDeck = [{ instanceId: "event", definitionId: "event_pressure_zone" }];
    state = gameReducer(state, { type: "DRAW_CARD", playerId: "player_1" });
    state = gameReducer(state, { type: "ACKNOWLEDGE_EVENT_DIALOG" });
    state.round = 4;
    state.players.forEach(player => { player.actedThisRound = true; });
    const health = state.players[0].health;
    state = gameReducer(state, { type: "END_TURN", playerId: "player_1" });
    expect(state.players[0].health).toBeLessThan(health);
    expect(state.players.map(player => player.damageDealt)).toEqual([0, 0, 0, 0]);
  });

  it("persists totals between SMG hits without double counting, and resets for a new match", () => {
    const store = storage();
    const state = takeHit(attack(fixture("weapon_smg")));
    expect(state.players[0].damageDealt).toBe(2);
    expect(saveGame(state, store)).toBe(true);
    let restored = loadGame({ ...state, phase: "setup" }, store);
    expect(restored.phase).toBe("action");
    expect(restored.players[0].damageDealt).toBe(2);
    restored = takeHit(restored);
    expect(restored.players[0].damageDealt).toBe(4);
    restored = gameReducer(restored, { type: "RESTART_GAME" });
    expect(restored.players.every(player => player.damageDealt === 0 && player.eliminations === 0)).toBe(true);
    expect(restored.damageTrackingStartedMidMatch).toBeUndefined();
  });

  it("restores older saves and labels their damage history as partial", () => {
    const state = fixture(), store = storage();
    state.players.forEach(player => { delete player.damageDealt; });
    saveGame(state, store);
    const restored = loadGame({ ...state, phase: "setup" }, store);
    expect(restored.phase).toBe("action");
    expect(restored.damageTrackingStartedMidMatch).toBe(true);
    expect(restored.players.map(player => player.damageDealt)).toEqual([0, 0, 0, 0]);
    const next = takeHit(attack(restored));
    expect(next.players[0].damageDealt).toBe(3);
    saveGame(next, store);
    expect(loadGame(state, store).damageTrackingStartedMidMatch).toBe(true);
  });

  it.each([-1, 1.5, "12", null])("rejects invalid saved damage totals: %s", value => {
    const state = fixture(), store = storage();
    Reflect.set(state.players[0], "damageDealt", value);
    saveGame(state, store);
    expect(readSavedMatch({ ...state, phase: "setup" }, store).rejected).toBeTruthy();
  });
});
