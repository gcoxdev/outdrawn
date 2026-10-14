import { describe, expect, it } from "vitest";
import { createNewGame } from "./setup";
import { gameReducer } from "./reducer";
import { chooseAutomatedAction, simulateGame, getStateIssues, ownedCards } from "./simulator";
import { normalizeSettings } from "./settings";
import type { GameState } from "./types";

let sequence = 0;
const card = (definitionId: string) => ({ instanceId: `cleanup_${++sequence}`, definitionId });
function base(): GameState {
  const state = createNewGame(["A", "B", "C"], () => 0);
  return { ...state, mainDeck: [], discardPile: [], players: state.players.map(player => ({ ...player, hand: [] })) };
}
function acknowledge(state: GameState) {
  while (state.pendingEventDialog) state = gameReducer(state, { type: "ACKNOWLEDGE_EVENT_DIALOG" });
  return state;
}

describe("cleanup regressions", () => {
  it.each([
    ["defense_counterattack", false], ["defense_counterattack", true],
    ["defense_backfire", false], ["defense_backfire", true]
  ] as const)("stops SMG when Revive discards it after %s (Reload: %s)", (defenseId, reload) => {
    let state = base();
    state.settings.allowSecondaryDefense = true;
    const weapon = card("weapon_smg"), revive = card("defense_fake_death"), bandage = card("healing_bandage"), counter = card(defenseId);
    state.players[0] = { ...state.players[0], health: 2, hand: [weapon, revive, bandage] };
    state.players[1].hand = [counter];
    if (reload) state.reloadPlayerIds = ["player_1"];
    const originalCards = ownedCards(state).map(card => card.instanceId).sort();
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: weapon.instanceId });
    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: counter.instanceId });
    expect(state.pendingSecondaryDamage?.defenderId).toBe("player_1");
    state = gameReducer(state, { type: "PLAY_SECONDARY_REACTION", defenderId: "player_1", reactionCardInstanceId: revive.instanceId });
    expect(state.players[0]).toMatchObject({ health: 4, eliminated: false, hand: [], actionsRemaining: 1 });
    expect(state.players[1].health).toBe(defenseId === "defense_counterattack" ? 18 : 20);
    expect(state.pendingReaction).toBeNull();
    expect(state.pendingMultiHitAttack).toBeNull();
    expect(state.reloadPlayerIds).toEqual([]);
    expect(state.discardPile.filter(card => card.instanceId === weapon.instanceId)).toHaveLength(1);
    expect(ownedCards(state).map(card => card.instanceId).sort()).toEqual(originalCards);
    expect(getStateIssues(state)).toEqual([]);
    expect(gameReducer(state, { type: "END_TURN", playerId: "player_1" }).currentPlayerIndex).toBe(1);
  });

  it("completes the assessment's failing secondary-defense seed with strict invariants", () => {
    const result = simulateGame(21856693, ["competent"], { playerCount: 4, strict: true, settings: { allowSecondaryDefense: true } });
    expect(result.stalled).toBe(false);
    expect(result.state.phase).toBe("gameOver");
  });

  it("executes a Master Minigun finishing attack without recovery", () => {
    const state = base();
    state.players[0].hand = [card("weapon_minigun")];
    state.players[1].health = 3;
    const action = chooseAutomatedAction(state, "master", () => 0.5);
    const next = gameReducer(state, action);
    expect(next).not.toBe(state);
    expect(next.players[1].eliminated).toBe(true);
  });

  it("advances an eliminated human after the event acknowledgement", () => {
    let state = base();
    const held = card("weapon_pistol");
    state.players[0] = { ...state.players[0], health: 1, hand: [held] };
    state.mainDeck = [card("event_pressure_zone")];
    state = gameReducer(state, { type: "DRAW_CARD", playerId: "player_1" });
    expect(state.pendingEventDialog).not.toBeNull();
    state = acknowledge(state);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.players[0].hand).toEqual([]);
    expect(state.discardPile).toContainEqual(held);
  });

  it.each([["defense_counterattack", "weapon_pistol"], ["defense_backfire", "weapon_pistol"], ["defense_counterattack", "weapon_smg"], ["defense_backfire", "weapon_smg"]])("offers defense before lethal %s from %s", (reactionId, weaponId) => {
    let state = base();
    state.settings.allowSecondaryDefense = true;
    const weapon = card(weaponId), reaction = card(reactionId), dodge = card("defense_dodge");
    state.players[0] = { ...state.players[0], health: 2, hand: [weapon, dodge] };
    state.players[1].hand = [reaction];
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: weapon.instanceId });
    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: reaction.instanceId });
    expect(state.players[0]).toMatchObject({ health: 2, eliminated: false });
    expect(state.pendingSecondaryDamage?.defenderId).toBe("player_1");
    state = gameReducer(state, { type: "PLAY_SECONDARY_REACTION", defenderId: "player_1", reactionCardInstanceId: dodge.instanceId });
    expect(state.players[0]).toMatchObject({ health: 2, eliminated: false });
    expect(state.pendingSecondaryDamage).toBeNull();
  });

  it.each([1, 2, 3])("resolves Adrenaline at %i health", health => {
    let state = base(); const adrenaline = card("ability_adrenaline");
    state.players[0] = { ...state.players[0], health, hand: [adrenaline] };
    state = gameReducer(state, { type: "PLAY_ABILITY", playerId: "player_1", cardInstanceId: adrenaline.instanceId });
    expect(state.players[0]).toMatchObject({ health: Math.max(0, health - 2), eliminated: health <= 2 });
    expect(state.currentPlayerIndex).toBe(health <= 2 ? 1 : 0);
  });

  it("resumes Search after both consecutive forced-discard events", () => {
    let state = base(); const search = card("ability_search");
    state.players.forEach(player => { player.hand = [card("weapon_pistol"), card("defense_dodge")]; });
    state.players[0].hand.push(search);
    state.mainDeck = [card("event_low_ammo"), card("event_no_cover"), card("weapon_knife"), card("weapon_pistol"), card("weapon_shotgun")];
    state = acknowledge(gameReducer(state, { type: "PLAY_ABILITY", playerId: "player_1", cardInstanceId: search.instanceId }));
    for (const reason of ["Low Ammo", "No Cover"]) {
      for (const playerId of ["player_1", "player_2", "player_3"]) {
        expect(state.pendingDiscard).toMatchObject({ reason, playerId });
        state = acknowledge(gameReducer(state, { type: "RESOLVE_PENDING_DISCARD", playerId, cardInstanceIds: [state.pendingDiscard!.allowedCardInstanceIds![0]] }));
      }
    }
    expect(state.pendingSearch?.cards).toHaveLength(3);
    expect(state.players.every(player => player.hand.length === 0)).toBe(true);
    expect(state.drawContinuations).toEqual([]);
  });

  it("keeps repeated Black Market opportunities during Supply Drop", () => {
    let state = base();
    state.mainDeck = [card("event_supply_drop"), card("event_black_market"), card("event_black_market"), card("weapon_pistol"), card("weapon_knife"), card("weapon_shotgun")];
    state = acknowledge(gameReducer(state, { type: "DRAW_CARD", playerId: "player_1" }));
    for (let i = 0; i < 2; i++) {
      expect(state.pendingBlackMarket?.playerId).toBe("player_1");
      state = acknowledge(gameReducer(state, { type: "PASS_BLACK_MARKET", playerId: "player_1" }));
    }
    expect(state.pendingBlackMarket).toBeNull();
    expect(state.players[0].hand).toHaveLength(3);
  });

  it("loots a Grenade splash elimination exactly once", () => {
    let state = base(); const weapon = card("weapon_grenade"), loot = card("healing_bandage");
    state.players[0].hand = [weapon]; state.players[2] = { ...state.players[2], health: 1, hand: [loot] };
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: weapon.instanceId });
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: "player_2" });
    expect(state.players[2].hand).toEqual([]);
    expect(state.players[0].hand).toEqual([loot]);
  });

  it.each([false, true])("continues SMG after redirect with secondary defense %s", secondary => {
    let state = base(); const weapon = card("weapon_smg"), ricochet = card("defense_decoy");
    state.settings.allowSecondaryDefense = secondary;
    state.players[0].hand = [weapon]; state.players[1].hand = [ricochet];
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: weapon.instanceId });
    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: ricochet.instanceId });
    state = gameReducer(state, { type: "RESOLVE_PENDING_REDIRECT", defenderId: "player_2", targetPlayerId: "player_3" });
    if (secondary) state = gameReducer(state, { type: "SKIP_SECONDARY_REACTION", defenderId: "player_3" });
    expect(state.pendingReaction?.defenderId).toBe("player_2");
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: "player_2" });
    expect(state.players.map(player => player.health)).toEqual([20, 18, 18]);
    expect(state.players[0].actionsRemaining).toBe(1);
    expect(state.pendingMultiHitAttack).toBeNull();
    expect(state.discardPile.filter(c => c.instanceId === weapon.instanceId)).toHaveLength(1);
  });

  it("pays Intimidate once and then resolves both SMG hits", () => {
    let state = base(); const weapon = card("weapon_smg"), cost = card("healing_bandage");
    state.players[0].hand = [weapon, cost]; state.intimidations = { player_1: ["player_2"] };
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: weapon.instanceId });
    state = gameReducer(state, { type: "RESOLVE_PENDING_ATTACK_COST", attackerId: "player_1", cardInstanceId: cost.instanceId });
    for (let i = 0; i < 2; i++) state = gameReducer(state, { type: "SKIP_REACTION", defenderId: "player_2" });
    expect(state.players[1].health).toBe(16);
    expect(state.players[0].actionsRemaining).toBe(1);
    expect(state.pendingMultiHitAttack).toBeNull();
    expect(state.discardPile).toEqual(expect.arrayContaining([weapon, cost]));
  });

  it("finishes counter damage before declaring the last player winner", () => {
    let state = base(); const weapon = card("weapon_pistol"), counter = card("defense_counterattack");
    state.settings.allowSecondaryDefense = true;
    state.players[0] = { ...state.players[0], health: 2, hand: [weapon] };
    state.players[1] = { ...state.players[1], health: 2, hand: [counter] };
    state.players[2] = { ...state.players[2], health: 0, eliminated: true };
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: weapon.instanceId });
    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: counter.instanceId });
    expect(state.phase).toBe("action");
    expect(state.pendingSecondaryDamage?.defenderId).toBe("player_1");
    state = gameReducer(state, { type: "SKIP_SECONDARY_REACTION", defenderId: "player_1" });
    expect(state.phase).toBe("gameOver");
    expect(state.winnerId).toBeNull();
    expect(state.players.every(player => player.eliminated)).toBe(true);
  });

  it("expires Ambush and rejects End Turn during defense", () => {
    let state = base(); const ambush = card("ability_ambush"), weapon = card("weapon_pistol");
    state.players[0].hand = [ambush, weapon];
    state = gameReducer(state, { type: "PLAY_ABILITY", playerId: "player_1", cardInstanceId: ambush.instanceId });
    const ended = gameReducer(state, { type: "END_TURN", playerId: "player_1" });
    expect(ended.attackBonuses).toEqual({});
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: weapon.instanceId });
    expect(gameReducer(state, { type: "END_TURN", playerId: "player_1" })).toBe(state);
    expect(gameReducer(state, { type: "DISCARD_CARD", playerId: "player_1", cardInstanceId: weapon.instanceId })).toBe(state);
  });

  it("excludes previously eliminated players from a final tie", () => {
    let state = base(); state.round = 3; state.currentPlayerIndex = 2;
    state.players = state.players.map((player, index) => ({ ...player, health: index === 0 ? 0 : 1, eliminated: index === 0, eliminations: index === 0 ? 5 : 0, actedThisRound: true }));
    state = gameReducer(state, { type: "END_TURN", playerId: "player_3" });
    expect(state.phase).toBe("gameOver");
    expect(state.winnerId).toBeNull();
  });

  it("normalizes nonfinite, fractional, and inconsistent settings", () => {
    const settings = normalizeSettings({ startingHealth: NaN, actionsPerTurn: -10, freeDrawsPerTurn: 2.9,
      blackMarketCustom: { actionCost: 7, discardCost: -2, healthCost: Infinity, revealCount: 2, keepCount: 8 } });
    expect(settings).toMatchObject({ startingHealth: 20, actionsPerTurn: 1, freeDrawsPerTurn: 2,
      blackMarketCustom: { actionCost: 0, discardCost: 0, healthCost: 0, revealCount: 2, keepCount: 2 } });
  });

  it("completes the assessment seeds without rejected bot actions", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const result = simulateGame(seed, ["beginner", "competent", "expert", "master"], { strict: true });
      expect(result.stalled, `seed ${seed}`).toBe(false);
      expect(result.metrics.issues["no-op:ATTACK"], `seed ${seed}`).toBeUndefined();
      expect(result.metrics.issues["forced end turn"], `seed ${seed}`).toBeUndefined();
    }
  });

  it("preserves cards and legal decisions with secondary defense and larger tables", () => {
    for (const playerCount of [3, 6, 24]) {
      for (let seed = 100; seed < 110; seed++) {
        expect(simulateGame(seed, ["master", "expert", "novice"], {
          strict: true, playerCount, settings: { allowSecondaryDefense: true, eliminationHealthReward: 2 }
        }).stalled).toBe(false);
      }
    }
  });
});
