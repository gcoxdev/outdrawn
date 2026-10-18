import { describe, expect, it } from "vitest";
import { createNewGame } from "./setup";
import { gameReducer } from "./reducer";
import { canPlayerAct, getCurrentPlayer, hasPendingDecision } from "./rules";
import { getHandDiscardRequirement, getPlayableReactionCardIds } from "../components/GameTable";
import type { GameState } from "./types";

const weapons = ["weapon_pistol", "weapon_shotgun", "weapon_smg", "weapon_grenade", "weapon_crossbow", "weapon_sniper_rifle", "weapon_assault_rifle", "weapon_knife", "weapon_minigun"];

function fixture(definitions = ["ability_adrenaline", "weapon_pistol", "weapon_shotgun"]) {
  const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
  state.players.forEach(player => { player.hand = []; });
  state.players[0].hand = definitions.map((definitionId, index) => ({ instanceId: `test_${index}`, definitionId }));
  state.mainDeck = [{ instanceId: "draw_pistol", definitionId: "weapon_pistol" }];
  return state;
}
function play(state: GameState, definitionId: string) {
  const card = getCurrentPlayer(state).hand.find(card => card.definitionId === definitionId)!;
  return gameReducer(state, { type: "PLAY_ABILITY", playerId: "player_1", cardInstanceId: card.instanceId });
}
function attack(state: GameState, definitionId: string) {
  const card = getCurrentPlayer(state).hand.find(card => card.definitionId === definitionId)!;
  return gameReducer(state, {
    type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: card.instanceId,
    ...(definitionId === "weapon_minigun" ? { damageByTarget: { player_2: 3 } } : {})
  });
}
function finishHits(state: GameState) {
  for (let hit = 0; hit < 2 && state.pendingReaction; hit++) {
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: state.pendingReaction.defenderId });
  }
  expect(state.pendingReaction).toBeNull();
  expect(state.pendingMultiHitAttack).toBeNull();
  return state;
}

describe("weapon action availability", () => {
  it.each(weapons)("allows %s with one action after an earlier attack, without Adrenaline", weapon => {
    let state = fixture(["weapon_pistol", weapon]);
    state = finishHits(attack(state, "weapon_pistol"));
    expect(state.players[0].actionsRemaining).toBe(1);
    expect(canPlayerAct(state, "player_1")).toBe(true);
    const beforeHealth = state.players[1].health;
    state = finishHits(attack(state, weapon));
    expect(state.players[1].health).toBeLessThan(beforeHealth);
    expect(state.players[0].actionsRemaining).toBe(0);
    expect(hasPendingDecision(state)).toBe(false);
  });

  it.each(weapons)("allows %s after an earlier attack and Adrenaline", weapon => {
    let state = fixture(["weapon_pistol", "ability_adrenaline", weapon]);
    state = finishHits(attack(state, "weapon_pistol"));
    expect(state.players[0].actionsRemaining).toBe(1);
    expect(state.players[0].attackedThisRound).toBe(true);
    state = play(state, "ability_adrenaline");
    expect(state.players[0].actionsRemaining).toBe(2);
    expect(state.players[0].health).toBe(18);
    expect(hasPendingDecision(state)).toBe(false);
    expect(canPlayerAct(state, "player_1")).toBe(true);
    expect(getHandDiscardRequirement(state, state.players[0], state.players[0])).toBeNull();
    expect(getPlayableReactionCardIds(state, state.players[0])).toBeNull();
    const beforeHealth = state.players[1].health;
    state = finishHits(attack(state, weapon));
    expect(state.players[1].health).toBeLessThan(beforeHealth);
    expect(state.players[0].actionsRemaining).toBe(1);
  });

  it("allows spending every remaining action after playing Adrenaline first", () => {
    let state = play(fixture(), "ability_adrenaline");
    expect(state.players[0].actionsRemaining).toBe(3);
    state = finishHits(attack(state, "weapon_pistol"));
    state = finishHits(attack(state, "weapon_shotgun"));
    expect(state.players[0].actionsRemaining).toBe(1);
    state = gameReducer(state, { type: "DRAW_CARD", playerId: "player_1" });
    expect(state.players[0].actionsRemaining).toBe(0);
    expect(canPlayerAct(state, "player_1")).toBe(false);
    expect(attack(state, "weapon_pistol")).toBe(state);
  });

  it("stacks distinct copies once each and rejects replaying a spent card", () => {
    let state = fixture(["ability_adrenaline", "ability_adrenaline", "weapon_pistol"]);
    const spent = state.players[0].hand[0].instanceId;
    state = play(play(state, "ability_adrenaline"), "ability_adrenaline");
    expect(state.players[0]).toMatchObject({ health: 16, actionsRemaining: 4 });
    expect(state.discardPile.filter(card => card.definitionId === "ability_adrenaline")).toHaveLength(2);
    expect(gameReducer(state, { type: "PLAY_ABILITY", playerId: "player_1", cardInstanceId: spent })).toBe(state);
    state = finishHits(attack(state, "weapon_pistol"));
    expect(state.players[0].actionsRemaining).toBe(3);
  });

  it("does not create actions when played at zero actions", () => {
    const state = fixture(); state.players[0].actionsRemaining = 0;
    expect(play(state, "ability_adrenaline")).toBe(state);
  });

  it("does not carry Adrenaline's extra actions into the next turn", () => {
    let state = play(fixture(), "ability_adrenaline");
    expect(state.players[0].actionsRemaining).toBe(3);
    // The default turn order moves the first seat forward each round.
    for (const playerId of ["player_1", "player_2", "player_3", "player_2", "player_3"]) {
      state = gameReducer(state, { type: "END_TURN", playerId });
    }
    expect(getCurrentPlayer(state).id).toBe("player_1");
    expect(state.players[0].actionsRemaining).toBe(state.settings.actionsPerTurn);
  });

  it("retains normal Smoke and Intimidate restrictions after gaining actions", () => {
    let state = fixture(["ability_adrenaline", "weapon_pistol"]);
    state.intimidations = { player_1: ["player_2"] };
    state = play(state, "ability_adrenaline");
    const denied = attack(state, "weapon_pistol");
    expect(denied.pendingReaction).toBeNull();
    expect(denied).toBe(state);
    expect(denied.players[0].actionsRemaining).toBe(3);
    state.intimidations = {};
    state.smokeProtectedPlayerIds = ["player_2"];
    expect(attack(state, "weapon_pistol")).toBe(state);
  });

  it("does not force discarding while Adrenaline actions are still available", () => {
    let state = fixture(["ability_adrenaline", ...Array.from({ length: 9 }, () => "weapon_pistol")]);
    state.players[0].actionsRemaining = 1;
    state = play(state, "ability_adrenaline");
    expect(state.players[0].hand.length).toBeGreaterThan(state.settings.maxHandSize);
    expect(getHandDiscardRequirement(state, state.players[0], state.players[0])).toBeNull();
    state = finishHits(attack(state, "weapon_pistol"));
    expect(state.players[0].actionsRemaining).toBe(1);
  });

  it("keeps Smoke protection across consecutive attacker turns until the defender's turn", () => {
    let state = fixture();
    state.settings.turnOrder = "standard"; // Rotating start can give the attacker consecutive turns.
    state.round = 6;
    state.firstPlayerIndex = 1;
    state.players[2] = { ...state.players[2], health: 0, eliminated: true };
    state.players[0].actedThisRound = true;
    state.players[1].actedThisRound = true;
    state.players[1].hand = [{ instanceId: "smoke", definitionId: "defense_smoke_bomb" }];
    state = attack(state, "weapon_pistol");
    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: "smoke" });
    expect(state.players[0].actionsRemaining).toBe(1);
    expect(attack(state, "weapon_shotgun")).toBe(state);
    expect(state.log.at(-1)?.message).toContain("protected by Smoke Bomb until their next turn");

    state = gameReducer(state, { type: "END_TURN", playerId: "player_1" });
    expect(state.round).toBe(7);
    expect(getCurrentPlayer(state).id).toBe("player_1");
    state = play(state, "ability_adrenaline");
    expect(state.players[0].actionsRemaining).toBe(3);
    expect(attack(state, "weapon_shotgun")).toBe(state);

    state = gameReducer(state, { type: "END_TURN", playerId: "player_1" });
    expect(getCurrentPlayer(state).id).toBe("player_2");
    expect(state.smokeProtectedPlayerIds).toEqual([]);
  });

  it("keeps event draws free before Adrenaline, matching the reported round 7", () => {
    let state = fixture();
    state.mainDeck = [
      { instanceId: "scavenge", definitionId: "event_scavenge" },
      { instanceId: "supply", definitionId: "event_supply_drop" },
      ...Array.from({ length: 12 }, (_, index) => ({ instanceId: `event_draw_${index}`, definitionId: "weapon_pistol" }))
    ];
    state = gameReducer(state, { type: "DRAW_CARD", playerId: "player_1" });
    for (let i = 0; i < 2 && state.pendingEventDialog; i++) {
      state = gameReducer(state, { type: "ACKNOWLEDGE_EVENT_DIALOG" });
    }
    expect(hasPendingDecision(state)).toBe(false);
    expect(state.players[0].actionsRemaining).toBe(2);
    state = play(state, "ability_adrenaline");
    expect(state.players[0].actionsRemaining).toBe(3);
    for (const remaining of [2, 1, 0]) {
      state = gameReducer(state, { type: "DRAW_CARD", playerId: "player_1" });
      expect(state.players[0].actionsRemaining).toBe(remaining);
    }
  });
});
