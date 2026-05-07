import { describe, expect, it } from "vitest";
import { defaultGameSettings } from "../data/constants";
import { mainDeckCards } from "../data/cards";
import { expandDeck } from "./deck";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";

function instances(definitionIds: string[]) {
  const deck = expandDeck(mainDeckCards, "correction_test");
  return definitionIds.map((definitionId) => {
    const index = deck.findIndex((card) => card.definitionId === definitionId);
    if (index === -1) {
      throw new Error(`Missing ${definitionId}`);
    }
    const [card] = deck.splice(index, 1);
    return card;
  });
}

describe("gameplay corrections", () => {
  it("Disarm makes the target discard their highest-damage weapon from hand", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const current = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== current.id)!;
    const [disarm] = instances(["ability_disarm"]);
    const [pistol, shotgun] = instances(["weapon_pistol", "weapon_shotgun"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === current.id
          ? { ...player, hand: [disarm], actionsRemaining: 2 }
          : player.id === target.id
            ? { ...player, hand: [pistol, shotgun] }
            : player
      )
    };

    state = gameReducer(state, {
      type: "PLAY_ABILITY",
      playerId: current.id,
      cardInstanceId: disarm.instanceId,
      targetPlayerId: target.id
    });

    expect(state.players.find((player) => player.id === target.id)!.hand.map((card) => card.instanceId)).toEqual([pistol.instanceId]);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([disarm.instanceId, shotgun.instanceId]));
  });

  it("Disarm discards only one weapon when the target has multiple matching weapons", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const current = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== current.id)!;
    const [disarm] = instances(["ability_disarm"]);
    const [firstPistol, secondPistol] = instances(["weapon_pistol", "weapon_pistol"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === current.id
          ? { ...player, hand: [disarm], actionsRemaining: 2 }
          : player.id === target.id
            ? { ...player, hand: [firstPistol, secondPistol] }
            : player
      )
    };

    state = gameReducer(state, {
      type: "PLAY_ABILITY",
      playerId: current.id,
      cardInstanceId: disarm.instanceId,
      targetPlayerId: target.id
    });

    const targetHand = state.players.find((player) => player.id === target.id)!.hand;
    expect(targetHand).toHaveLength(1);
    expect(state.discardPile.filter((card) => card.definitionId === "weapon_pistol")).toHaveLength(1);
  });

  it("does not record hand snapshots by default", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const current = state.players[state.currentPlayerIndex];

    state = gameReducer(state, { type: "PASS_ACTION", playerId: current.id });

    const latest = state.log.at(-1)!;
    expect(latest.handSnapshots).toHaveLength(0);
    expect(latest.debugHandSnapshots).toHaveLength(3);
  });

  it("records hand snapshots on log entries only when debug snapshots are enabled", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, { ...defaultGameSettings, debugHandSnapshots: true });
    const current = state.players[state.currentPlayerIndex];

    state = gameReducer(state, { type: "PASS_ACTION", playerId: current.id });

    const latest = state.log.at(-1)!;
    expect(latest.handSnapshots).toHaveLength(3);
    const currentSnapshot = latest.handSnapshots.find((snapshot) => snapshot.playerId === current.id);
    expect(currentSnapshot?.cards).toHaveLength(current.hand.length);
    expect(currentSnapshot?.health).toBe(current.health);
  });

  it("reveals historical hand snapshots when debug snapshots are turned on mid-game", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, { ...defaultGameSettings, debugHandSnapshots: false });

    expect(state.log[0].handSnapshots).toHaveLength(0);

    state = gameReducer(state, {
      type: "UPDATE_SETTINGS",
      settings: { ...state.settings, debugHandSnapshots: true }
    });

    expect(state.log[0].handSnapshots).toHaveLength(3);
    expect(state.log).toHaveLength(1);
  });

  it("removes visible hand snapshots when debug snapshots are turned off", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, { ...defaultGameSettings, debugHandSnapshots: true });
    const current = state.players[state.currentPlayerIndex];

    state = gameReducer(state, { type: "PASS_ACTION", playerId: current.id });
    expect(state.log.at(-1)?.handSnapshots).toHaveLength(3);

    state = gameReducer(state, {
      type: "UPDATE_SETTINGS",
      settings: { ...state.settings, debugHandSnapshots: false }
    });

    expect(state.log.every((entry) => entry.handSnapshots.length === 0)).toBe(true);
    expect(state.log.every((entry) => entry.debugHandSnapshots.length === 3)).toBe(true);
  });

  it("keeps log snapshot health fixed at the time of the log entry", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, { ...defaultGameSettings, debugHandSnapshots: true });
    const current = state.players[state.currentPlayerIndex];

    state = gameReducer(state, { type: "PASS_ACTION", playerId: current.id });
    const passEntryId = state.log.at(-1)!.id;
    const passSnapshot = state.log.at(-1)!.handSnapshots.find((snapshot) => snapshot.playerId === current.id)!;

    state = {
      ...state,
      players: state.players.map((player) => (player.id === current.id ? { ...player, health: 7 } : player))
    };
    state = gameReducer(state, { type: "PASS_ACTION", playerId: current.id });

    const originalEntry = state.log.find((entry) => entry.id === passEntryId)!;
    expect(passSnapshot.health).toBe(20);
    expect(originalEntry.handSnapshots.find((snapshot) => snapshot.playerId === current.id)?.health).toBe(20);
  });

  it("Smoke Bomb prevents targeting until that player's next turn", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    const [weapon] = instances(["weapon_pistol"]);
    const [smoke] = instances(["defense_smoke_bomb"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [weapon] }
          : player.id === target.id
            ? { ...player, hand: [smoke] }
            : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: weapon.instanceId
    });
    state = gameReducer(state, {
      type: "PLAY_REACTION",
      defenderId: target.id,
      reactionCardInstanceId: smoke.instanceId
    });
    expect(state.smokeProtectedPlayerIds).toContain(target.id);

    const nextAttacker = state.players[state.currentPlayerIndex];
    const [secondWeapon] = instances(["weapon_pistol"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === nextAttacker.id ? { ...player, hand: [secondWeapon], actionsRemaining: 1 } : player
      )
    };
    const blocked = gameReducer(state, {
      type: "ATTACK",
      attackerId: nextAttacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: secondWeapon.instanceId
    });
    expect(blocked.pendingReaction).toBeNull();

    state = gameReducer(state, { type: "END_TURN", playerId: nextAttacker.id });
    expect(state.players[state.currentPlayerIndex].id).toBe(target.id);
    expect(state.smokeProtectedPlayerIds).not.toContain(target.id);
  });

  it("eliminating a player transfers their remaining hand to the attacker", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    const [weapon, loot] = instances(["weapon_pistol", "weapon_knife"]);
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [weapon] }
          : player.id === target.id
            ? { ...player, health: 3, hand: [loot] }
            : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: weapon.instanceId
    });
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: target.id });

    expect(state.players.find((player) => player.id === target.id)!.hand).toHaveLength(0);
    expect(state.players.find((player) => player.id === attacker.id)!.hand.map((card) => card.instanceId)).toContain(loot.instanceId);
  });

  it("draw action reshuffles discard into deck when the main deck is empty", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const [discarded] = instances(["weapon_pistol"]);
    state = {
      ...state,
      mainDeck: [],
      discardPile: [discarded],
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, hand: [], actionsRemaining: 1 } : candidate
      )
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });

    expect(state.players.find((candidate) => candidate.id === player.id)!.hand[0].instanceId).toBe(discarded.instanceId);
    expect(state.discardPile).toHaveLength(0);
  });

  it("healing draw effects also refill from discard when the main deck is empty", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const [painkillers, discarded] = instances(["healing_painkillers", "weapon_pistol"]);
    state = {
      ...state,
      mainDeck: [],
      discardPile: [discarded],
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, health: 12, hand: [painkillers], actionsRemaining: 1 } : candidate
      )
    };

    state = gameReducer(state, { type: "PLAY_HEALING", playerId: player.id, cardInstanceId: painkillers.instanceId });

    const updatedPlayer = state.players.find((candidate) => candidate.id === player.id)!;
    expect(updatedPlayer.hand.map((card) => card.instanceId)).toEqual([discarded.instanceId]);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual([painkillers.instanceId]);
  });
});
