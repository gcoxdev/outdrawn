import { describe, expect, it } from "vitest";
import { createNewGame } from "./setup";
import { gameReducer } from "./reducer";
import { loadGame, saveGame } from "./persistence";
import type { GameState } from "./types";

const card = (instanceId: string, definitionId: string) => ({ instanceId, definitionId });
function fixture(secondary: boolean, weapon = "weapon_grenade", teams?: string[]) {
  const state = createNewGame(Array.from({ length: teams?.length ?? 5 }, (_, i) => ({ name: `P${i + 1}`, controller: { type: "human" as const }, teamId: teams?.[i] })), () => 0);
  state.settings.passDeviceMode = false;
  state.settings.allowSecondaryDefense = secondary;
  state.players.forEach(player => { player.hand = []; });
  state.players[0].hand = [card("weapon", weapon)];
  state.players[1].hand = [card("redirect", "defense_decoy")];
  return state;
}
function redirect(state: GameState, targetPlayerId = "player_4") {
  state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: "weapon" });
  state = gameReducer(state, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: "redirect" });
  return gameReducer(state, { type: "RESOLVE_PENDING_REDIRECT", defenderId: "player_2", targetPlayerId });
}
function takeSecondaryHits(state: GameState) {
  for (let i = 0; i < 10 && state.pendingSecondaryDamage; i++) state = gameReducer(state, { type: "SKIP_SECONDARY_REACTION", defenderId: state.pendingSecondaryDamage.defenderId });
  expect(state.pendingSecondaryDamage).toBeNull();
  return state;
}

describe("shared hit resolution", () => {
  it.each([false, true])("redirects only the Grenade's direct hit with secondary defense %s", secondary => {
    let state = redirect(fixture(secondary));
    expect(Boolean(state.pendingSecondaryDamage)).toBe(secondary);
    state = takeSecondaryHits(state);
    expect(state.players.map(player => player.health)).toEqual([20, 20, 20, 16, 20]);
    expect(state.players[0]).toMatchObject({ actionsRemaining: 1, damageDealt: 4 });
    expect(state.discardPile.filter(card => card.instanceId === "weapon")).toHaveLength(1);
    expect(state.discardPile.filter(card => card.instanceId === "redirect")).toHaveLength(1);
  });

  it("allows defense against the redirected direct hit without adding Grenade splash", () => {
    const initial = fixture(true);
    initial.players[3].hand = [card("vest", "defense_armor_vest")];
    const state = gameReducer(redirect(initial), { type: "PLAY_SECONDARY_REACTION", defenderId: "player_4", reactionCardInstanceId: "vest" });
    expect(state.players.map(player => player.health)).toEqual([20, 20, 20, 20, 20]);
    expect(state.pendingSecondaryDamage).toBeNull();
  });

  it.each([false, true])("credits redirects onto the shooter's teammate to the Ricochet player, secondary defense %s", secondary => {
    let state = fixture(secondary, "weapon_sniper_rifle", ["team_1", "team_2", "team_1", "team_2"]);
    state.settings.eliminationHealthReward = 2;
    state.players[0].health = 10;
    state.players[1].health = 10;
    state.players[2].health = 4;
    state.players[2].hand = [card("loot", "healing_bandage")];
    state = redirect(state, "player_3");
    if (secondary) {
      expect(state.pendingSecondaryDamage).toMatchObject({ attackerId: "player_2", defenderId: "player_3", source: "ricochet" });
      let raw = "";
      const store = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; }, removeItem() {} };
      expect(saveGame(state, store)).toBe(true);
      state = loadGame({ ...state, phase: "setup" }, store);
      expect(state.phase).toBe("action");
    }
    state = takeSecondaryHits(state);
    expect(state.players[0]).toMatchObject({ health: 10, eliminations: 0, damageDealt: 0, actionsRemaining: 1, hand: [] });
    expect(state.players[1]).toMatchObject({ health: 12, eliminations: 1, damageDealt: 4, actionsRemaining: 2, hand: [card("loot", "healing_bandage")] });
    expect(state.players[2]).toMatchObject({ health: 0, eliminated: true, hand: [] });
    expect(state.discardPile.filter(card => card.instanceId === "redirect")).toHaveLength(1);
    expect(state.discardPile.filter(card => card.instanceId === "weapon")).toHaveLength(1);
  });

  it.each([false, true])("retains Reload after a redirect without spending the weapon twice, secondary defense %s", secondary => {
    const initial = fixture(secondary);
    initial.reloadPlayerIds = ["player_1"];
    const state = takeSecondaryHits(redirect(initial));
    expect(state.players[0].hand).toEqual([card("weapon", "weapon_grenade")]);
    expect(state.players[0].actionsRemaining).toBe(1);
    expect(state.reloadPlayerIds).toEqual([]);
    expect(state.discardPile.map(card => card.instanceId)).toEqual(["redirect"]);
  });

  it.each([false, true])("resolves all allocated Minigun hits, loot, and rewards before declaring a winner, secondary defense %s", secondary => {
    let state = fixture(secondary, "weapon_minigun", ["team_1", "team_2", "team_2"]);
    state.settings.eliminationHealthReward = 2;
    state.players[0].health = 10;
    state.players[1].health = 2;
    state.players[2].health = 3;
    state.players[1].hand = [card("loot1", "healing_bandage")];
    state.players[2].hand = [card("loot2", "weapon_knife")];
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", weaponInstanceId: "weapon", damageByTarget: { player_2: 3, player_3: 3 } });
    state = takeSecondaryHits(state);
    expect(state.phase).toBe("gameOver");
    expect(state.winnerId).toBe("player_1");
    expect(state.players[0]).toMatchObject({ health: 14, eliminations: 2, damageDealt: 5, actionsRemaining: 1 });
    expect(state.players[0].hand.map(card => card.instanceId)).toEqual(["loot1", "loot2"]);
    expect(state.players.slice(1).every(player => player.eliminated && player.hand.length === 0)).toBe(true);
    expect(state.discardPile.map(card => card.instanceId)).toEqual(["weapon"]);
  });
});

describe("Ricochet and Mark Target", () => {
  it.each([false, true].flatMap(secondary => [[1, 0], [0, 1], [2, 3], [1, 1]].map(([originalMarks, newMarks]) => ({ secondary, originalMarks, newMarks }))))(
    "replaces $originalMarks original marks with $newMarks recipient marks, secondary defense $secondary",
    ({ secondary, originalMarks, newMarks }) => {
      const state = fixture(secondary, "weapon_pistol");
      state.attackBonuses.player_1 = 3;
      state.markedTargets = { player_2: originalMarks, player_4: newMarks };
      const before = structuredClone(state);
      const next = takeSecondaryHits(redirect(state));
      expect(next.players[1].health).toBe(20);
      expect(next.players[3].health).toBe(20 - 3 - 3 - newMarks);
      expect(next.players[0]).toMatchObject({ actionsRemaining: 1, damageDealt: 6 + newMarks });
      expect(next.markedTargets).toEqual(state.markedTargets);
      expect(state).toEqual(before);
    }
  );

  it.each([false, true])("applies a marked attacker's bonus when a two-player hit returns to them, secondary defense %s", secondary => {
    const state = fixture(secondary, "weapon_pistol");
    state.players = state.players.slice(0, 2);
    state.markedTargets = { player_1: 2, player_2: 1 };
    const next = takeSecondaryHits(redirect(state, "player_1"));
    expect(next.players[0].health).toBe(15);
    expect(next.players[1]).toMatchObject({ health: 20, damageDealt: 5 });
  });

  it.each([false, true])("applies recipient marks and Ambush to the first SMG hit only, secondary defense %s", secondary => {
    const state = fixture(secondary, "weapon_smg");
    state.markedTargets = { player_2: 2, player_4: 3 };
    state.attackBonuses.player_1 = 3;
    let next = takeSecondaryHits(redirect(state));
    expect(next.players[3].health).toBe(12);
    expect(next.pendingReaction).toMatchObject({ defenderId: "player_2", baseDamage: 2 });
    next = gameReducer(next, { type: "SKIP_REACTION", defenderId: "player_2" });
    expect(next.players[1].health).toBe(18);
    expect(next.players[0]).toMatchObject({ actionsRemaining: 1, damageDealt: 10 });
    expect(next.pendingMultiHitAttack).toBeNull();
  });

  it.each([false, true])("does not subtract or add marks on a redirected second SMG hit, secondary defense %s", secondary => {
    let state = fixture(secondary, "weapon_smg");
    state.markedTargets = { player_2: 2, player_4: 3 };
    state.attackBonuses.player_1 = 3;
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: "weapon" });
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: "player_2" });
    expect(state.players[1].health).toBe(13);
    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: "redirect" });
    state = takeSecondaryHits(gameReducer(state, { type: "RESOLVE_PENDING_REDIRECT", defenderId: "player_2", targetPlayerId: "player_4" }));
    expect(state.players[3].health).toBe(18);
    expect(state.players[0]).toMatchObject({ actionsRemaining: 1, damageDealt: 9 });
    expect(state.pendingMultiHitAttack).toBeNull();
  });

  it("preserves recalculated damage after saving during the redirected reaction", () => {
    const state = fixture(true, "weapon_pistol");
    state.markedTargets = { player_2: 2, player_4: 1 };
    const redirected = redirect(state);
    expect(redirected.pendingSecondaryDamage?.baseDamage).toBe(4);
    let raw = "";
    const store = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; }, removeItem() {} };
    saveGame(redirected, store);
    const restored = loadGame({ ...state, phase: "setup" }, store);
    expect(takeSecondaryHits(restored).players[3].health).toBe(16);
  });
});
