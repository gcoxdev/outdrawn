import { describe, expect, it } from "vitest";
import { eventDeckCards, mainDeckCards } from "../data/cards";
import { expandDeck } from "./deck";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";

function main(definitionId: string) {
  const card = expandDeck(mainDeckCards, "event_main").find((candidate) => candidate.definitionId === definitionId);
  if (!card) {
    throw new Error(`Missing ${definitionId}`);
  }
  return card;
}

function event(definitionId: string) {
  const card = expandDeck(eventDeckCards, "event_test").find((candidate) => candidate.definitionId === definitionId);
  if (!card) {
    throw new Error(`Missing ${definitionId}`);
  }
  return card;
}

function endCurrentRound(state = createNewGame(["Ari", "Blake", "Casey"], () => 0)) {
  let next = state;
  const livingCount = next.players.filter((player) => !player.eliminated).length;
  for (let index = 0; index < livingCount; index += 1) {
    next = gameReducer(next, { type: "END_TURN", playerId: next.players[next.currentPlayerIndex].id });
  }
  return next;
}

describe("event cards", () => {
  it("reveals a this-round event when a new round begins", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const highGround = event("event_high_ground");
    state = {
      ...state,
      eventDeck: [highGround]
    };

    state = endCurrentRound(state);

    expect(state.round).toBe(2);
    expect(state.activeEvent?.card.instanceId).toBe(highGround.instanceId);
    expect(state.eventDeck).toHaveLength(0);
  });

  it("High Ground adds 1 damage to a player's first attack this round", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    const pistol = main("weapon_pistol");
    state = {
      ...state,
      round: 3,
      activeEvent: { card: event("event_high_ground"), timing: "thisRound" },
      players: state.players.map((player) => (player.id === attacker.id ? { ...player, hand: [pistol] } : player))
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: pistol.instanceId
    });

    expect(state.pendingReaction?.baseDamage).toBe(4);
  });

  it("No Cover makes block reactions prevent 1 less damage", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    const sniper = main("weapon_sniper_rifle");
    const shield = main("defense_shield_plate");
    state = {
      ...state,
      round: 3,
      activeEvent: { card: event("event_no_cover"), timing: "thisRound" },
      players: state.players.map((player) =>
        player.id === attacker.id ? { ...player, hand: [sniper] } : player.id === target.id ? { ...player, hand: [shield] } : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: sniper.instanceId
    });
    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: target.id, reactionCardInstanceId: shield.instanceId });

    expect(state.players.find((player) => player.id === target.id)!.health).toBe(15);
  });

  it("Low Ammo makes each player discard a weapon or take damage", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const pistol = main("weapon_pistol");
    const lowAmmo = event("event_low_ammo");
    state = {
      ...state,
      eventDeck: [lowAmmo],
      players: state.players.map((player, index) => (index === 0 ? { ...player, hand: [pistol] } : { ...player, hand: [] }))
    };

    state = endCurrentRound(state);

    expect(state.players[0].hand).toHaveLength(0);
    expect(state.players[0].health).toBe(20);
    expect(state.players[1].health).toBe(17);
    expect(state.players[2].health).toBe(17);
    expect(state.discardPile.map((card) => card.instanceId)).toContain(pistol.instanceId);
    expect(state.eventDiscardPile.map((card) => card.instanceId)).toContain(lowAmmo.instanceId);
  });

  it("Critical Condition damages low-health players when revealed", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    state = {
      ...state,
      eventDeck: [event("event_critical_condition")],
      players: state.players.map((player, index) => ({ ...player, health: index === 0 ? 11 : index === 1 ? 10 : 4 }))
    };

    state = endCurrentRound(state);

    expect(state.players.map((player) => player.health)).toEqual([11, 9, 2]);
  });
});
