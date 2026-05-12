import { describe, expect, it } from "vitest";
import { mainDeckCards } from "../data/cards";
import { defaultGameSettings } from "../data/constants";
import { expandDeck } from "./deck";
import { gameReducer } from "./reducer";
import { labelTeam } from "./rules";
import { createNewGame } from "./setup";

function instances(definitionIds: string[]) {
  const deck = expandDeck(mainDeckCards, "teams");
  return definitionIds.map((definitionId) => {
    const index = deck.findIndex((card) => card.definitionId === definitionId);
    if (index === -1) {
      throw new Error(`Missing ${definitionId}`);
    }
    const [card] = deck.splice(index, 1);
    return card;
  });
}

describe("team mode", () => {
  it("labels and resolves dynamic team ids", () => {
    const state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" }, teamId: "team_12" },
        { name: "Blake", controller: { type: "human" }, teamId: "team_24" },
        { name: "Casey", controller: { type: "computer", strategy: "competent" }, teamId: "team_12" },
        { name: "Devon", controller: { type: "computer", strategy: "competent" }, teamId: "team_24" }
      ],
      () => 0
    );
    const finishedState = {
      ...state,
      players: state.players.map((player) => (player.teamId === "team_12" ? player : { ...player, health: 0, eliminated: true }))
    };
    const afterTurn = gameReducer(finishedState, { type: "END_TURN", playerId: finishedState.players[0].id });

    expect(labelTeam("team_4")).toBe("Team 4");
    expect(labelTeam("team_alpha")).toBe("Team Alpha");
    expect(afterTurn.phase).toBe("gameOver");
    expect(afterTurn.winnerTeamId).toBe("team_12");
  });

  it("supports 2v2v2 with a third team winner", () => {
    const teamC = "team_c";
    const state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" }, teamId: "team_a" },
        { name: "Blake", controller: { type: "human" }, teamId: "team_b" },
        { name: "Casey", controller: { type: "human" }, teamId: teamC },
        { name: "Devon", controller: { type: "computer", strategy: "competent" }, teamId: "team_a" },
        { name: "Eli", controller: { type: "computer", strategy: "competent" }, teamId: "team_b" },
        { name: "Finn", controller: { type: "computer", strategy: "competent" }, teamId: teamC }
      ],
      () => 0
    );
    const finishedState = {
      ...state,
      currentPlayerIndex: 2,
      players: state.players.map((player) => (player.teamId === teamC ? player : { ...player, health: 0, eliminated: true }))
    };
    const afterTurn = gameReducer(finishedState, { type: "END_TURN", playerId: finishedState.players[2].id });

    expect(state.players.map((player) => player.teamId)).toEqual(["team_a", "team_b", teamC, "team_a", "team_b", teamC]);
    expect(labelTeam(teamC)).toBe("Team C");
    expect(afterTurn.phase).toBe("gameOver");
    expect(afterTurn.winnerTeamId).toBe(teamC);
  });

  it("stores team assignments during setup", () => {
    const state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" }, teamId: "team_a" },
        { name: "Blake", controller: { type: "human" }, teamId: "team_b" },
        { name: "Casey", controller: { type: "computer", strategy: "competent" }, teamId: "team_a" },
        { name: "Devon", controller: { type: "computer", strategy: "competent" }, teamId: "team_b" }
      ],
      () => 0
    );

    expect(state.players.map((player) => player.teamId)).toEqual(["team_a", "team_b", "team_a", "team_b"]);
  });

  it("does not allow hostile single-target cards against teammates", () => {
    let state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" }, teamId: "team_a" },
        { name: "Blake", controller: { type: "human" }, teamId: "team_b" },
        { name: "Casey", controller: { type: "human" }, teamId: "team_a" },
        { name: "Devon", controller: { type: "human" }, teamId: "team_b" }
      ],
      () => 0
    );
    const attacker = state.players[state.currentPlayerIndex];
    const teammate = state.players.find((player) => player.id !== attacker.id && player.teamId === attacker.teamId)!;
    const [pistol, sabotage] = instances(["weapon_pistol", "ability_sabotage"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [pistol, sabotage], actionsRemaining: 2 }
          : player.id === teammate.id
            ? { ...player, hand: instances(["weapon_knife"]) }
            : player
      )
    };

    const afterAttack = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: teammate.id,
      weaponInstanceId: pistol.instanceId
    });
    const afterAbility = gameReducer(state, {
      type: "PLAY_ABILITY",
      playerId: attacker.id,
      targetPlayerId: teammate.id,
      cardInstanceId: sabotage.instanceId
    });

    expect(afterAttack).toBe(state);
    expect(afterAbility).toBe(state);
  });

  it("ends a team game when only one team has living players", () => {
    let state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" }, teamId: "team_a" },
        { name: "Blake", controller: { type: "human" }, teamId: "team_b" },
        { name: "Casey", controller: { type: "human" }, teamId: "team_a" },
        { name: "Devon", controller: { type: "human" }, teamId: "team_b" }
      ],
      () => 0
    );
    const attacker = state.players[state.currentPlayerIndex];
    const finalOpponent = state.players.find((player) => player.teamId !== attacker.teamId)!;
    const [pistol] = instances(["weapon_pistol"]);
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [pistol] }
          : player.id === finalOpponent.id
            ? { ...player, health: 3 }
            : player.teamId !== attacker.teamId
              ? { ...player, health: 0, eliminated: true }
              : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: finalOpponent.id,
      weaponInstanceId: pistol.instanceId
    });
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: finalOpponent.id });

    expect(state.phase).toBe("gameOver");
    expect(state.winnerTeamId).toBe(attacker.teamId);
  });

  it("ends immediately when collapse eliminates the last opposing team member", () => {
    let state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" }, teamId: "team_a" },
        { name: "Blake", controller: { type: "human" }, teamId: "team_b" },
        { name: "Casey", controller: { type: "human" }, teamId: "team_a" },
        { name: "Devon", controller: { type: "human" }, teamId: "team_b" }
      ],
      () => 0
    );
    const current = state.players[state.currentPlayerIndex];
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) =>
        player.teamId === current.teamId
          ? { ...player, health: 5, actedThisRound: player.id !== current.id }
          : player.id === "player_2"
            ? { ...player, health: 1, actedThisRound: true }
            : { ...player, health: 0, eliminated: true, actedThisRound: true }
      )
    };

    state = gameReducer(state, { type: "END_TURN", playerId: current.id });

    expect(state.phase).toBe("gameOver");
    expect(state.winnerTeamId).toBe(current.teamId);
    expect(state.log.map((entry) => entry.message)).toContain("Blake was eliminated by collapse.");
  });

  it("does not apply friendly fire from grenade splash or minigun", () => {
    let state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" }, teamId: "team_a" },
        { name: "Blake", controller: { type: "human" }, teamId: "team_b" },
        { name: "Casey", controller: { type: "human" }, teamId: "team_a" },
        { name: "Devon", controller: { type: "human" }, teamId: "team_b" }
      ],
      () => 0
    );
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.teamId !== attacker.teamId)!;
    const teammate = state.players.find((player) => player.id !== attacker.id && player.teamId === attacker.teamId)!;
    const [grenade, minigun] = instances(["weapon_grenade", "weapon_minigun"]);
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) => (player.id === attacker.id ? { ...player, hand: [grenade, minigun], actionsRemaining: 2 } : player))
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: grenade.instanceId
    });
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: target.id });
    expect(state.players.find((player) => player.id === teammate.id)!.health).toBe(20);

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      weaponInstanceId: minigun.instanceId
    });
    expect(state.players.find((player) => player.id === teammate.id)!.health).toBe(20);
  });

  it("limits Ricochet redirect targets to the defender's opposing team", () => {
    let state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" }, teamId: "team_a" },
        { name: "Blake", controller: { type: "human" }, teamId: "team_b" },
        { name: "Casey", controller: { type: "human" }, teamId: "team_a" },
        { name: "Devon", controller: { type: "human" }, teamId: "team_b" }
      ],
      () => 0
    );
    const attacker = state.players[state.currentPlayerIndex];
    const defender = state.players.find((player) => player.teamId !== attacker.teamId)!;
    const defenderTeammate = state.players.find((player) => player.id !== defender.id && player.teamId === defender.teamId)!;
    const attackerTeammate = state.players.find((player) => player.id !== attacker.id && player.teamId === attacker.teamId)!;
    const [pistol, ricochet] = instances(["weapon_pistol", "defense_decoy"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [pistol], actionsRemaining: 2 }
          : player.id === defender.id
            ? { ...player, hand: [ricochet] }
            : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: defender.id,
      weaponInstanceId: pistol.instanceId
    });
    state = gameReducer(state, {
      type: "PLAY_REACTION",
      defenderId: defender.id,
      reactionCardInstanceId: ricochet.instanceId
    });

    const blocked = gameReducer(state, {
      type: "RESOLVE_PENDING_REDIRECT",
      defenderId: defender.id,
      targetPlayerId: defenderTeammate.id
    });
    const redirected = gameReducer(state, {
      type: "RESOLVE_PENDING_REDIRECT",
      defenderId: defender.id,
      targetPlayerId: attackerTeammate.id
    });

    expect(blocked).toBe(state);
    expect(redirected.pendingRedirect).toBeNull();
    expect(redirected.log.at(-1)?.message).toContain(attackerTeammate.name);
  });

  it("allows players to heal a teammate with their healing cards", () => {
    let state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" }, teamId: "team_a" },
        { name: "Blake", controller: { type: "human" }, teamId: "team_b" },
        { name: "Casey", controller: { type: "human" }, teamId: "team_a" },
        { name: "Devon", controller: { type: "human" }, teamId: "team_b" }
      ],
      () => 0
    );
    const healer = state.players[state.currentPlayerIndex];
    const teammate = state.players.find((player) => player.id !== healer.id && player.teamId === healer.teamId)!;
    const opponent = state.players.find((player) => player.teamId !== healer.teamId)!;
    const [bandage] = instances(["healing_bandage"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === healer.id
          ? { ...player, hand: [bandage], actionsRemaining: 2 }
          : player.id === teammate.id
            ? { ...player, health: 10 }
            : player.id === opponent.id
              ? { ...player, health: 10 }
              : player
      )
    };
    const beforeBlocked = state;

    const blocked = gameReducer(state, {
      type: "PLAY_HEALING",
      playerId: healer.id,
      targetPlayerId: opponent.id,
      cardInstanceId: bandage.instanceId
    });
    state = gameReducer(state, {
      type: "PLAY_HEALING",
      playerId: healer.id,
      targetPlayerId: teammate.id,
      cardInstanceId: bandage.instanceId
    });

    expect(blocked).toBe(beforeBlocked);
    expect(state.players.find((player) => player.id === teammate.id)!.health).toBe(13);
    expect(state.players.find((player) => player.id === healer.id)!.hand).toHaveLength(0);
    expect(state.players.find((player) => player.id === healer.id)!.actionsRemaining).toBe(1);
  });

  it("can disable teammate healing through settings", () => {
    let state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" }, teamId: "team_a" },
        { name: "Blake", controller: { type: "human" }, teamId: "team_b" },
        { name: "Casey", controller: { type: "human" }, teamId: "team_a" },
        { name: "Devon", controller: { type: "human" }, teamId: "team_b" }
      ],
      () => 0,
      { ...defaultGameSettings, allowTeamHealing: false }
    );
    const healer = state.players[state.currentPlayerIndex];
    const teammate = state.players.find((player) => player.id !== healer.id && player.teamId === healer.teamId)!;
    const [bandage] = instances(["healing_bandage"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === healer.id
          ? { ...player, hand: [bandage], actionsRemaining: 2 }
          : player.id === teammate.id
            ? { ...player, health: 10 }
            : player
      )
    };

    const blocked = gameReducer(state, {
      type: "PLAY_HEALING",
      playerId: healer.id,
      targetPlayerId: teammate.id,
      cardInstanceId: bandage.instanceId
    });

    expect(blocked).toBe(state);
  });

  it("allows players to transfer one card to a teammate as an action", () => {
    let state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" }, teamId: "team_a" },
        { name: "Blake", controller: { type: "human" }, teamId: "team_b" },
        { name: "Casey", controller: { type: "human" }, teamId: "team_a" },
        { name: "Devon", controller: { type: "human" }, teamId: "team_b" }
      ],
      () => 0
    );
    const giver = state.players[state.currentPlayerIndex];
    const teammate = state.players.find((player) => player.id !== giver.id && player.teamId === giver.teamId)!;
    const opponent = state.players.find((player) => player.teamId !== giver.teamId)!;
    const [pistol] = instances(["weapon_pistol"]);
    state = {
      ...state,
      players: state.players.map((player) => (player.id === giver.id ? { ...player, hand: [pistol], actionsRemaining: 2 } : player))
    };
    const beforeBlocked = state;

    const blocked = gameReducer(state, {
      type: "TRANSFER_CARD",
      playerId: giver.id,
      targetPlayerId: opponent.id,
      cardInstanceId: pistol.instanceId
    });
    state = gameReducer(state, {
      type: "TRANSFER_CARD",
      playerId: giver.id,
      targetPlayerId: teammate.id,
      cardInstanceId: pistol.instanceId
    });

    expect(blocked).toBe(beforeBlocked);
    expect(state.players.find((player) => player.id === giver.id)!.hand).toHaveLength(0);
    expect(state.players.find((player) => player.id === teammate.id)!.hand.map((card) => card.instanceId)).toContain(pistol.instanceId);
    expect(state.players.find((player) => player.id === giver.id)!.actionsRemaining).toBe(1);
  });

  it("can disable teammate card transfers through settings", () => {
    let state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" }, teamId: "team_a" },
        { name: "Blake", controller: { type: "human" }, teamId: "team_b" },
        { name: "Casey", controller: { type: "human" }, teamId: "team_a" },
        { name: "Devon", controller: { type: "human" }, teamId: "team_b" }
      ],
      () => 0,
      { ...defaultGameSettings, allowTeamCardTransfer: false }
    );
    const giver = state.players[state.currentPlayerIndex];
    const teammate = state.players.find((player) => player.id !== giver.id && player.teamId === giver.teamId)!;
    const [pistol] = instances(["weapon_pistol"]);
    state = {
      ...state,
      players: state.players.map((player) => (player.id === giver.id ? { ...player, hand: [pistol], actionsRemaining: 2 } : player))
    };

    const blocked = gameReducer(state, {
      type: "TRANSFER_CARD",
      playerId: giver.id,
      targetPlayerId: teammate.id,
      cardInstanceId: pistol.instanceId
    });

    expect(blocked).toBe(state);
  });
});
