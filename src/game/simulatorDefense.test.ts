import { describe, expect, it } from "vitest";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";
import { chooseAutomatedAction } from "./simulator";
import type { GameState, StrategyLevel } from "./types";

function attack(defenses: string[], weapon = "weapon_knife", health = 20, attackerHealth = 20): GameState {
  const state = createNewGame(["Attacker", "Defender", "Other"], () => 0);
  state.settings.passDeviceMode = false;
  state.settings.eliminationHealthReward = 0;
  state.players.forEach(player => { player.hand = []; });
  state.players[0].health = attackerHealth;
  state.players[0].hand = [{ instanceId: "weapon", definitionId: weapon }];
  state.players[1].health = health;
  state.players[1].hand = defenses.map(definitionId => ({ instanceId: definitionId, definitionId }));
  return gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: "weapon" });
}

function defend(state: GameState, expectedCard: string, strategy: StrategyLevel = "competent") {
  const action = chooseAutomatedAction(state, strategy, () => 0.5);
  expect(action).toEqual({
    type: state.pendingSecondaryDamage ? "PLAY_SECONDARY_REACTION" : "PLAY_REACTION",
    defenderId: "player_2", reactionCardInstanceId: expectedCard
  });
  return gameReducer(state, action);
}

describe("contextual bot defenses", () => {
  it.each(["competent", "expert", "master"] as const)("%s saves stronger defenses when Brace fully blocks the hit", strategy => {
    const state = defend(attack(["defense_dodge", "defense_backfire", "defense_armor_vest", "defense_brace"]), "defense_brace", strategy);
    expect(state.players[1].health).toBe(20);
    expect(state.players[1].hand).toHaveLength(3);
  });

  it("saves Dodge when Armor Vest fully blocks a Pistol", () => {
    const state = defend(attack(["defense_dodge", "defense_armor_vest"], "weapon_pistol"), "defense_armor_vest");
    expect(state.players[1].health).toBe(20);
  });

  it("uses Brace instead of ineffective armor against Crossbow", () => {
    const state = defend(attack(["defense_armor_vest", "defense_brace"], "weapon_crossbow"), "defense_brace");
    expect(state.players[1].health).toBe(18);
  });

  it("keeps ineffective armor if it is the only defense against Crossbow", () => {
    const state = attack(["defense_armor_vest"], "weapon_crossbow");
    expect(chooseAutomatedAction(state, "master")).toEqual({ type: "SKIP_REACTION", defenderId: "player_2" });
  });

  it("uses Ricochet to survive a lethal Knife hit", () => {
    let state = defend(attack(["defense_ricochet"], "weapon_knife", 2), "defense_ricochet");
    state = gameReducer(state, chooseAutomatedAction(state, "competent", () => 0.5));
    expect(state.pendingRedirect).toBeNull();
    expect(state.players[1]).toMatchObject({ health: 2, eliminated: false });
    expect(state.players[2].health).toBe(18);
  });

  it("uses Backfire to eliminate a low-health attacker instead of spending Dodge", () => {
    const state = defend(attack(["defense_dodge", "defense_backfire"], "weapon_knife", 20, 2), "defense_backfire");
    expect(state.players[0].eliminated).toBe(true);
    expect(state.players[1].health).toBe(20);
  });

  it("uses Counterattack's fixed damage for an elimination that Backfire cannot reach", () => {
    const state = defend(attack(["defense_dodge", "defense_backfire", "defense_counterattack"], "weapon_knife", 10, 3), "defense_counterattack");
    expect(state.players[0].eliminated).toBe(true);
    expect(state.players[1].health).toBe(8);
  });

  it("does not trade its life for a Counterattack elimination", () => {
    const state = defend(attack(["defense_counterattack", "defense_dodge"], "weapon_knife", 2, 3), "defense_dodge");
    expect(state.players[0].eliminated).toBe(false);
    expect(state.players[1].health).toBe(2);
  });

  it("preserves Backfire and Smoke when Dodge is sufficient and retaliation is not lethal", () => {
    defend(attack(["defense_smoke_bomb", "defense_backfire", "defense_dodge"], "weapon_pistol"), "defense_dodge");
  });

  it("prioritizes survival over Shield Plate's large nominal damage reduction", () => {
    const state = attack(["defense_shield_plate", "defense_dodge"], "weapon_sniper_rifle", 10);
    state.pendingReaction!.baseDamage = 24;
    state.attackBonuses.player_1 = 16;
    const resolved = defend(state, "defense_dodge");
    expect(resolved.players[1].health).toBe(10);
  });

  it("does not spend a partial block that cannot prevent an elimination", () => {
    const state = attack(["defense_brace"], "weapon_sniper_rifle", 3);
    expect(chooseAutomatedAction(state, "competent")).toEqual({ type: "SKIP_REACTION", defenderId: "player_2" });
  });

  it("uses the same armor-piercing rules for secondary hits and never chains Ricochet", () => {
    const state = attack(["defense_armor_vest", "defense_brace", "defense_ricochet"], "weapon_crossbow");
    state.settings.allowSecondaryDefense = true;
    state.pendingSecondaryDamage = { ...state.pendingReaction!, source: "ricochet", remaining: [] };
    state.pendingReaction = null;
    const resolved = defend(state, "defense_brace");
    expect(resolved.players[1].health).toBe(18);
    expect(resolved.pendingRedirect).toBeNull();
  });

  it("does not assume Counterattack will eliminate an attacker who may defend", () => {
    const state = attack(["defense_counterattack", "defense_dodge"], "weapon_knife", 3, 3);
    state.settings.allowSecondaryDefense = true;
    state.players[0].hand.push({ instanceId: "hidden", definitionId: "defense_dodge" });
    const resolved = defend(state, "defense_dodge");
    expect(resolved.players[1].health).toBe(3);
  });

  it.each([false, true])("does not inspect the attacker's hidden defense or Revive, secondary defense %s", secondary => {
    const state = attack(["defense_backfire", "defense_dodge"], "weapon_knife", 20, 2);
    state.settings.allowSecondaryDefense = secondary;
    state.players[0].hand.push({ instanceId: "hidden", definitionId: "healing_bandage" });
    const action = chooseAutomatedAction(state, "master", () => 0.5);
    for (const definitionId of ["defense_backfire", "defense_revive", "defense_dodge"]) {
      state.players[0].hand[1].definitionId = definitionId;
      expect(chooseAutomatedAction(state, "master", () => 0.5)).toEqual(action);
    }
  });

  it("values Smoke's protection against the remaining SMG hit", () => {
    const state = defend(attack(["defense_dodge", "defense_smoke_bomb"], "weapon_smg", 3), "defense_smoke_bomb");
    expect(state.players[1].health).toBe(3);
    expect(state.pendingReaction).toBeNull();
    expect(state.pendingMultiHitAttack).toBeNull();
  });

  it("does not reward retaliation against a teammate's splash damage", () => {
    const state = attack(["defense_backfire", "defense_dodge"], "weapon_grenade", 20, 2);
    state.players[0].teamId = "team_a";
    state.players[1].teamId = "team_a";
    state.players[2].teamId = "team_b";
    state.settings.allowSecondaryDefense = true;
    state.pendingSecondaryDamage = { ...state.pendingReaction!, baseDamage: 2, source: "splash", remaining: [] };
    state.pendingReaction = null;
    const resolved = defend(state, "defense_dodge");
    expect(resolved.players[0].health).toBe(2);
    expect(resolved.players[1].health).toBe(20);
  });

  it("retains beginner's deliberate chance to skip a defense", () => {
    expect(chooseAutomatedAction(attack(["defense_dodge"], "weapon_knife", 1), "beginner", () => 0)).toEqual({
      type: "SKIP_REACTION", defenderId: "player_2"
    });
  });
});
