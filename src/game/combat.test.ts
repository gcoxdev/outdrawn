import { describe, expect, it } from "vitest";
import { MAX_HEALTH } from "../data/constants";
import { mainDeckCards } from "../data/cards";
import { expandDeck } from "./deck";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";

function cardInstance(definitionId: string) {
  const card = expandDeck(mainDeckCards, "combat").find((instance) => instance.definitionId === definitionId);
  if (!card) {
    throw new Error(`Missing test card ${definitionId}`);
  }
  return card;
}

function stateWithCurrentPlayerCards(definitionIds: string[]) {
  const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
  const currentPlayer = state.players[state.currentPlayerIndex];
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === currentPlayer.id
        ? {
            ...player,
            hand: definitionIds.map(cardInstance),
            actionsRemaining: 2
          }
        : player
    )
  };
}

describe("combat and healing", () => {
  it("applies armor reduction and opening damage cap", () => {
    let state = stateWithCurrentPlayerCards(["weapon_sniper_rifle"]);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === target.id
          ? {
              ...player,
              equippedDefense: cardInstance("defense_armor_vest")
            }
          : player
      )
    };
    const weapon = attacker.hand[0];
    state = gameReducer(state, { type: "EQUIP_CARD", playerId: attacker.id, cardInstanceId: weapon.instanceId });
    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: weapon.instanceId
    });
    const damagedTarget = state.players.find((player) => player.id === target.id)!;

    expect(damagedTarget.health).toBe(16);
  });

  it("ignores armor for crossbow attacks", () => {
    let state = stateWithCurrentPlayerCards(["weapon_crossbow"]);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === target.id
          ? {
              ...player,
              equippedDefense: cardInstance("defense_armor_vest")
            }
          : player
      )
    };
    const weapon = attacker.hand[0];
    state = gameReducer(state, { type: "EQUIP_CARD", playerId: attacker.id, cardInstanceId: weapon.instanceId });
    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: weapon.instanceId
    });

    expect(state.players.find((player) => player.id === target.id)!.health).toBe(16);
  });

  it("tracks shotgun cooldown after attacking", () => {
    let state = stateWithCurrentPlayerCards(["weapon_shotgun"]);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    const weapon = attacker.hand[0];
    state = gameReducer(state, { type: "EQUIP_CARD", playerId: attacker.id, cardInstanceId: weapon.instanceId });
    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: weapon.instanceId
    });

    expect(state.players.find((player) => player.id === attacker.id)!.weaponCooldowns[weapon.instanceId]).toBe(1);
  });

  it("eliminates players and declares a winner", () => {
    let state = stateWithCurrentPlayerCards(["weapon_pistol"]);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) =>
        player.id === target.id
          ? { ...player, health: 3 }
          : player.id !== attacker.id
            ? { ...player, eliminated: true, health: 0 }
            : player
      )
    };
    const weapon = attacker.hand[0];
    state = gameReducer(state, { type: "EQUIP_CARD", playerId: attacker.id, cardInstanceId: weapon.instanceId });
    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: weapon.instanceId
    });

    expect(state.players.find((player) => player.id === target.id)!.eliminated).toBe(true);
    expect(state.phase).toBe("gameOver");
    expect(state.winnerId).toBe(attacker.id);
  });

  it("plays simple healing cards without exceeding max health", () => {
    let state = stateWithCurrentPlayerCards(["healing_bandage", "healing_painkillers"]);
    const player = state.players[state.currentPlayerIndex];
    state = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, health: MAX_HEALTH - 1 } : candidate
      )
    };
    const bandage = state.players[state.currentPlayerIndex].hand[0];
    state = gameReducer(state, {
      type: "PLAY_HEALING",
      playerId: player.id,
      cardInstanceId: bandage.instanceId
    });

    expect(state.players.find((candidate) => candidate.id === player.id)!.health).toBe(MAX_HEALTH);
    expect(state.players.find((candidate) => candidate.id === player.id)!.actionsRemaining).toBe(1);
  });
});
