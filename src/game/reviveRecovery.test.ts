import { describe, expect, it } from "vitest";
import { createNewGame } from "./setup";
import { gameReducer as reduce } from "./reducer";
import { damagePlayer } from "./recovery";
import { getCardTargets } from "./cardTargets";
import { getRicochetTargets } from "./rules";
import { getGrenadeSplashTargets } from "./combat";
import { getPlayableReactionCardIds } from "../components/GameTable";
import { getStateIssues, chooseAutomatedAction, simulateGame } from "./simulator";
import { loadGame, saveGame } from "./persistence";
import type { GameState } from "./types";

let sequence = 0;
const card = (definitionId: string) => ({ definitionId, instanceId: `recovery_${++sequence}` });
function fixture(count = 3) {
  const state = createNewGame(Array.from({ length: count }, (_, i) => `P${i + 1}`), () => 0);
  state.settings.passDeviceMode = false;
  state.mainDeck = []; state.discardPile = []; state.eventDiscardPile = [];
  state.players.forEach(player => { player.hand = []; player.health = 10; player.actionsRemaining = 2; player.freeDrawsRemaining = 0; });
  return state;
}
function attack(state: GameState, weaponId = "weapon_pistol", targetPlayerId = "player_2") {
  const weapon = card(weaponId);
  state.players[0].hand.push(weapon);
  return reduce(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId, weaponInstanceId: weapon.instanceId });
}
function recoveringPlayer(state: GameState, index = 1) {
  const player = state.players[index];
  player.health = 1; player.recovering = true; player.actionsRemaining = 0; player.freeDrawsRemaining = 0;
}
function event(state: GameState, id: string) {
  state.players[state.currentPlayerIndex].freeDrawsRemaining = 1;
  state.mainDeck = [card(id), card("weapon_knife")];
  return reduce(state, { type: "DRAW_CARD", playerId: state.players[state.currentPlayerIndex].id });
}
function acknowledge(state: GameState) {
  for (let i = 0; i < 20 && state.pendingEventDialog; i++) state = reduce(state, { type: "ACKNOWLEDGE_EVENT_DIALOG" });
  return state;
}

describe("automatic Revive and recovery", () => {
  it("keeps healing cards unused, discards everything else, and gives no elimination rewards or loot", () => {
    let state = fixture();
    const healing = [card("healing_medkit"), card("healing_painkillers")];
    state.settings.eliminationHealthReward = 5;
    state.players[1].health = 2;
    state.players[1].hand = [card("defense_revive"), ...healing, card("weapon_knife")];
    state = attack(state);
    expect(getPlayableReactionCardIds(state, state.players[1])).toEqual([]);
    expect(chooseAutomatedAction(state, "master").type).toBe("SKIP_REACTION");
    state = reduce(state, { type: "SKIP_REACTION", defenderId: "player_2" });
    expect(state.players[1]).toMatchObject({ health: 1, recovering: true, eliminated: false, hand: healing, actionsRemaining: 0 });
    expect(state.players[0]).toMatchObject({ health: 10, eliminations: 0, damageDealt: 1, hand: [] });
    expect(state.discardPile.map(c => c.definitionId).sort()).toEqual(["defense_revive", "weapon_knife", "weapon_pistol"]);
    expect(state.resolvedEffects?.some(effect => effect.kind === "healing")).toBe(false);
    expect(state.log.some(entry => entry.message.includes("Revive activated"))).toBe(true);
    expect(getStateIssues(state)).toEqual([]);
  });

  it("does not consume Revive on nonlethal damage or if a chosen defense prevents the lethal hit", () => {
    const state = fixture();
    state.players[1].health = 3;
    const revive = card("defense_revive"), dodge = card("defense_dodge");
    state.players[1].hand = [revive, dodge];
    const hit = damagePlayer(state.players[1], 1);
    expect(hit.player.health).toBe(2);
    expect(hit.player.hand).toEqual([revive, dodge]);
    const pending = attack(state);
    expect(reduce(pending, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: revive.instanceId })).toBe(pending);
    const defended = reduce(pending, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: dodge.instanceId });
    expect(defended.players[1]).toMatchObject({ health: 3, hand: [revive] });
    expect(defended.players[1].recovering).not.toBe(true);
  });

  it("ends protection on the next turn and charges normal healing actions/draws", () => {
    const state = fixture();
    recoveringPlayer(state);
    const medkit = card("healing_medkit");
    state.players[1].hand = [medkit];
    let next = reduce(state, { type: "END_TURN", playerId: "player_1" });
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.players[1]).toMatchObject({ health: 1, recovering: false, actionsRemaining: 2, hand: [medkit] });
    next = reduce(next, { type: "PLAY_HEALING", playerId: "player_2", cardInstanceId: medkit.instanceId });
    expect(next.players[1]).toMatchObject({ health: 7, actionsRemaining: 0, hand: [] });
  });

  it.each(["event_pressure_zone", "event_critical_condition", "event_bounty", "event_low_ammo"])("survives %s with secondary defense disabled", id => {
    const state = fixture();
    state.players.forEach(player => { player.health = 1; });
    state.players[1].hand = [card("defense_revive"), card("healing_bandage")];
    const next = event(state, id);
    expect(next.players[1]).toMatchObject({ health: 1, recovering: true, eliminated: false });
    expect(next.players[1].hand.map(c => c.definitionId)).toEqual(["healing_bandage"]);
    expect(next.winnerId).toBe("player_2");
    expect(next.outcome?.kind).toBe("survivor");
  });

  it.each([false, true])("survives Grenade splash and holds its seat while recovering (secondary defense %s)", secondary => {
    let state = fixture(5);
    state.settings.allowSecondaryDefense = secondary;
    state.players[2].health = 2;
    state.players[2].hand = [card("defense_revive")];
    state = attack(state, "weapon_grenade");
    state = reduce(state, { type: "SKIP_REACTION", defenderId: "player_2" });
    while (state.pendingSecondaryDamage) state = reduce(state, { type: "SKIP_SECONDARY_REACTION", defenderId: state.pendingSecondaryDamage.defenderId });
    expect(state.players[2]).toMatchObject({ health: 1, recovering: true });
    expect(getGrenadeSplashTargets(state.players, "player_1", "player_2").map(p => p.id)).toContain("player_3");
    state = attack(state, "weapon_grenade");
    state = reduce(state, { type: "SKIP_REACTION", defenderId: "player_2" });
    while (state.pendingSecondaryDamage) state = reduce(state, { type: "SKIP_SECONDARY_REACTION", defenderId: state.pendingSecondaryDamage.defenderId });
    expect(state.players[2].health).toBe(1);
    expect(state.players[3].health).toBe(10); // Splash must not jump over the recovering seat.
  });

  it.each([false, true])("survives Minigun with secondary defense %s", secondary => {
    let state = fixture(); state.settings.allowSecondaryDefense = secondary;
    state.players[1].health = 3; state.players[1].hand = [card("defense_revive")];
    const weapon = card("weapon_minigun"); state.players[0].hand = [weapon];
    state = reduce(state, { type: "ATTACK", attackerId: "player_1", weaponInstanceId: weapon.instanceId, damageByTarget: { player_2: 3, player_3: 3 } });
    while (state.pendingSecondaryDamage) state = reduce(state, { type: "SKIP_SECONDARY_REACTION", defenderId: state.pendingSecondaryDamage.defenderId });
    expect(state.players[1]).toMatchObject({ health: 1, recovering: true, eliminated: false });
    expect(state.players[2].health).toBe(7);
    expect(state.players[0].eliminations).toBe(0);
  });

  it.each([false, true])("survives Counterattack, Backfire and Ricochet and finishes its turn (secondary defense %s)", secondary => {
    for (const defense of ["defense_counterattack", "defense_backfire", "defense_ricochet"]) {
      let state = fixture(2); state.settings.allowSecondaryDefense = secondary;
      state.players[0].health = 2;
      const healing = card("healing_bandage"), reaction = card(defense);
      state.players[0].hand = [card("defense_revive"), healing]; state.players[1].hand = [reaction];
      state = attack(state);
      state = reduce(state, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: reaction.instanceId });
      if (state.pendingRedirect) state = reduce(state, { type: "RESOLVE_PENDING_REDIRECT", defenderId: "player_2", targetPlayerId: "player_1" });
      while (state.pendingSecondaryDamage) state = reduce(state, { type: "SKIP_SECONDARY_REACTION", defenderId: state.pendingSecondaryDamage.defenderId });
      expect(state.players[0]).toMatchObject({ health: 1, recovering: true, hand: [healing], actionsRemaining: 0 });
      expect(state.currentPlayerIndex).toBe(1);
      expect(state.players[1].eliminations).toBe(0);
      expect(state.discardPile.filter(c => c.definitionId === "weapon_pistol")).toHaveLength(1);
      expect(getStateIssues(state)).toEqual([]);
    }
  });

  it("keeps recovering winners alive without granting healing rewards or loot from the same hit", () => {
    let state = fixture(4); state.settings.eliminationHealthReward = 5;
    state.players[0].health = 2; state.players[0].hand = [card("defense_revive"), card("healing_medkit")];
    const reaction = card("defense_counterattack"); state.players[1].hand = [reaction];
    state.players[2].health = 2; state.players[2].hand = [card("weapon_knife")];
    state = attack(state, "weapon_grenade");
    state = reduce(state, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: reaction.instanceId });
    expect(state.players[0]).toMatchObject({ health: 1, recovering: true, eliminations: 1 });
    expect(state.players[0].hand.map(c => c.definitionId)).toEqual(["healing_medkit"]);
    expect(state.players[2].eliminated).toBe(true);
    expect(state.discardPile.some(c => c.definitionId === "weapon_knife")).toBe(true);
    expect(getStateIssues(state)).toEqual([]);
  });

  it("does not declare an opposing team the winner while a recovering survivor remains", () => {
    let state = fixture(); state.players[0].teamId = state.players[2].teamId = "team_1"; state.players[1].teamId = "team_2";
    state.players[1].health = 2; state.players[1].hand = [card("defense_revive")];
    state = reduce(attack(state), { type: "SKIP_REACTION", defenderId: "player_2" });
    expect(state.phase).toBe("action"); expect(state.winnerTeamId).toBeNull();
  });

  it("prevents the remaining SMG hit and consumes the weapon only once", () => {
    const state = fixture(); state.players[1].health = 2; state.players[1].hand = [card("defense_revive")];
    const next = reduce(attack(state, "weapon_smg"), { type: "SKIP_REACTION", defenderId: "player_2" });
    expect(next.players[1]).toMatchObject({ health: 1, recovering: true });
    expect(next.pendingReaction).toBeNull(); expect(next.pendingMultiHitAttack).toBeNull();
    expect(next.players[0].actionsRemaining).toBe(1);
    expect(next.discardPile.filter(c => c.definitionId === "weapon_smg")).toHaveLength(1);
  });

  it("survives self-inflicted Adrenaline damage and ends that turn", () => {
    const state = fixture(); const adrenaline = card("ability_adrenaline"), healing = card("healing_bandage");
    state.players[0].health = 2; state.players[0].hand = [adrenaline, card("defense_revive"), healing];
    const next = reduce(state, { type: "PLAY_ABILITY", playerId: "player_1", cardInstanceId: adrenaline.instanceId });
    expect(next.players[0]).toMatchObject({ health: 1, recovering: true, hand: [healing], actionsRemaining: 0, actedThisRound: true });
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.discardPile.filter(c => c.instanceId === adrenaline.instanceId)).toHaveLength(1);
    expect(reduce(next, { type: "PASS_ACTION", playerId: "player_1" })).toBe(next);
  });

  it("finishes interrupted Search without requesting a recovering player's choice or losing cards", () => {
    const state = fixture(); const search = card("ability_search"), drawn = card("weapon_pistol"), pressure = card("event_pressure_zone"), unDrawn = card("weapon_knife");
    state.players[0].health = 1; state.players[0].hand = [search, card("defense_revive"), card("healing_bandage")];
    state.mainDeck = [drawn, pressure, unDrawn];
    let next = reduce(state, { type: "PLAY_ABILITY", playerId: "player_1", cardInstanceId: search.instanceId });
    expect(next.players[0].recovering).toBe(true);
    expect(next.pendingEventDialog).not.toBeNull();
    next = acknowledge(next);
    expect(next.pendingSearch).toBeNull(); expect(next.drawContinuations).toEqual([]);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.discardPile.map(c => c.instanceId)).toEqual(expect.arrayContaining([search.instanceId, drawn.instanceId]));
    expect(next.mainDeck).toEqual([unDrawn]);
    expect(getStateIssues(next)).toEqual([]);
  });

  it("survives collapse, counts as alive, and recovers before the next scheduled turn", () => {
    const state = fixture(2); state.round = 3; state.currentPlayerIndex = 1;
    state.players.forEach(player => { player.health = 1; player.actedThisRound = true; player.hand = [card("defense_revive")]; });
    const next = reduce(state, { type: "END_TURN", playerId: "player_2" });
    expect(next.phase).toBe("action"); expect(next.round).toBe(4);
    expect(next.players[0]).toMatchObject({ health: 1, recovering: false });
    expect(next.players[1]).toMatchObject({ health: 1, recovering: true });
    expect(next.winnerId).toBeNull();
  });

  it("marks a turn interrupted by a lethal draw complete so the round still advances", () => {
    const state = fixture(); state.round = 3; state.currentPlayerIndex = 2;
    state.players[0].actedThisRound = state.players[1].actedThisRound = true;
    state.players[2].health = 1; state.players[2].hand = [card("defense_revive")];
    const next = acknowledge(event(state, "event_pressure_zone"));
    expect(next.round).toBe(4); expect(next.currentPlayerIndex).toBe(0);
    expect(next.players[2]).toMatchObject({ health: 1, recovering: true });
  });

  it.each(["event_pressure_zone", "event_low_ammo", "event_no_cover", "event_critical_condition"])("ignores %s during recovery", id => {
    const state = fixture(); recoveringPlayer(state);
    const next = event(state, id);
    expect(next.players[1]).toMatchObject({ health: 1, recovering: true });
    expect(next.pendingDiscard?.playerId).not.toBe("player_2");
  });

  it.each(["weapon_pistol", "weapon_minigun", "ability_disarm", "ability_steal", "ability_sabotage", "ability_mark_target", "ability_intimidate"])("rejects %s targeting a recovering player in engine and UI", id => {
    const state = fixture(); recoveringPlayer(state);
    const c = card(id); state.players[0].hand = [c];
    expect(getCardTargets(state, state.players[0], c).map(option => option.player.id)).not.toContain("player_2");
    const next = id.startsWith("weapon_") ? reduce(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: c.instanceId, damageByTarget: { player_2: 3 } })
      : reduce(state, { type: "PLAY_ABILITY", playerId: "player_1", targetPlayerId: "player_2", cardInstanceId: c.instanceId });
    expect(next).toBe(state);
    expect(getRicochetTargets(state, "player_3", "player_1").map(p => p.id)).not.toContain("player_2");
  });

  it("does not allow team healing or transfer to bypass the recovery state", () => {
    const state = fixture(); recoveringPlayer(state); state.players[0].teamId = state.players[1].teamId = "team_1";
    state.settings.allowTeamHealing = state.settings.allowTeamCardTransfer = true;
    const healing = card("healing_bandage"); state.players[0].hand = [healing];
    for (const type of ["PLAY_HEALING", "TRANSFER_CARD"] as const) expect(reduce(state, { type, playerId: "player_1", targetPlayerId: "player_2", cardInstanceId: healing.instanceId })).toBe(state);
  });

  it("persists recovery without expiring it on reload", () => {
    const state = fixture(); recoveringPlayer(state); state.players[1].hand = [card("healing_medkit")];
    let raw = ""; const store = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; }, removeItem() {} };
    expect(saveGame(state, store)).toBe(true);
    const loaded = loadGame({ ...state, phase: "setup" }, store);
    expect(loaded.players).toEqual(state.players);
    expect(reduce(loaded, { type: "END_TURN", playerId: "player_1" }).players[1].recovering).toBe(false);
  });

  it.each([false, true])("completes seeded games with conserved cards and valid decisions, secondary defense %s", secondary => {
    for (let seed = 20; seed < 35; seed++) {
      const result = simulateGame(seed, ["competent", "master"], { playerCount: 4, strict: true, settings: { allowSecondaryDefense: secondary } });
      expect(result.stalled).toBe(false);
      expect(result.state.phase).toBe("gameOver");
    }
  });
});
