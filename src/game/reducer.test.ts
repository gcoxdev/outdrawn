import { describe, expect, it } from "vitest";
import { ACTIONS_PER_TURN, defaultGameSettings, STARTING_HAND_SIZE } from "../data/constants";
import { mainDeckCards } from "../data/cards";
import { expandDeck } from "./deck";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";
import { getCurrentPlayer } from "./rules";

function cardInstance(definitionId: string) {
  const card = expandDeck(mainDeckCards, "test").find((instance) => instance.definitionId === definitionId);
  if (!card) {
    throw new Error(`Missing test card ${definitionId}`);
  }
  return card;
}

describe("game reducer turns and combat", () => {
  it("draws a card and spends one action", () => {
    const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = getCurrentPlayer(state);
    const next = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });
    const nextPlayer = getCurrentPlayer(next);

    expect(nextPlayer.hand).toHaveLength(STARTING_HAND_SIZE + 1);
    expect(nextPlayer.actionsRemaining).toBe(ACTIONS_PER_TURN - 1);
    expect(nextPlayer.drawsRemaining).toBe(1);
    expect(next.mainDeck).toHaveLength(state.mainDeck.length - 1);
  });

  it("can draw from a separate draw allowance without spending actions", () => {
    const state = createNewGame(["Ari", "Blake", "Casey"], () => 0, {
      ...defaultGameSettings,
      drawsPerTurn: 2,
      drawsUseActions: false
    });
    const player = getCurrentPlayer(state);
    const next = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });
    const nextPlayer = getCurrentPlayer(next);

    expect(nextPlayer.hand).toHaveLength(STARTING_HAND_SIZE + 1);
    expect(nextPlayer.actionsRemaining).toBe(ACTIONS_PER_TURN);
    expect(nextPlayer.drawsRemaining).toBe(1);
  });

  it("starts an attack by playing a weapon from hand", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = getCurrentPlayer(state);
    const weapon = cardInstance("weapon_pistol");
    state = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? {
              ...candidate,
              hand: [weapon],
              actionsRemaining: 2
            }
          : candidate
      )
    };

    const target = state.players.find((candidate) => candidate.id !== player.id)!;
    const next = gameReducer(state, {
      type: "ATTACK",
      attackerId: player.id,
      targetPlayerId: target.id,
      weaponInstanceId: weapon.instanceId
    });

    expect(next.pendingReaction?.weapon.instanceId).toBe(weapon.instanceId);
    expect(next.pendingReaction?.defenderId).toBe(target.id);
  });

  it("advances turns and starts a new round after all living players act", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const firstPlayerId = getCurrentPlayer(state).id;

    state = gameReducer(state, { type: "END_TURN", playerId: firstPlayerId });
    expect(getCurrentPlayer(state).id).not.toBe(firstPlayerId);
    expect(state.round).toBe(1);

    state = gameReducer(state, { type: "END_TURN", playerId: getCurrentPlayer(state).id });
    state = gameReducer(state, { type: "END_TURN", playerId: getCurrentPlayer(state).id });

    expect(state.round).toBe(2);
    expect(getCurrentPlayer(state).actionsRemaining).toBe(ACTIONS_PER_TURN);
    expect(state.players.every((player) => !player.actedThisRound)).toBe(true);
  });

  it("keeps the same round starter in round robin turn order", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, { ...defaultGameSettings, turnOrder: "roundRobin" });

    expect(getCurrentPlayer(state).id).toBe("player_1");
    state = gameReducer(state, { type: "END_TURN", playerId: "player_1" });
    expect(getCurrentPlayer(state).id).toBe("player_2");
    state = gameReducer(state, { type: "END_TURN", playerId: "player_2" });
    expect(getCurrentPlayer(state).id).toBe("player_3");
    state = gameReducer(state, { type: "END_TURN", playerId: "player_3" });

    expect(state.round).toBe(2);
    expect(getCurrentPlayer(state).id).toBe("player_1");
    expect(state.firstPlayerIndex).toBe(0);
  });

  it("ignores table actions after the game is over", () => {
    const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = getCurrentPlayer(state);
    const gameOverState = {
      ...state,
      phase: "gameOver" as const,
      winnerId: player.id
    };

    const next = gameReducer(gameOverState, { type: "END_TURN", playerId: player.id });

    expect(next).toBe(gameOverState);
    expect(next.log).toHaveLength(gameOverState.log.length);
  });

  it("starts a fresh game from game over with the same players and settings", () => {
    const state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" } },
        { name: "Blake", controller: { type: "computer", strategy: "expert" } },
        { name: "Casey", controller: { type: "computer", strategy: "competent" } }
      ],
      () => 0,
      { ...defaultGameSettings, maxHandSize: 10 }
    );
    const gameOverState = {
      ...state,
      phase: "gameOver" as const,
      winnerId: state.players[0].id
    };

    const next = gameReducer(gameOverState, { type: "RESTART_GAME" });

    expect(next.phase).toBe("action");
    expect(next.settings.maxHandSize).toBe(10);
    expect(next.players.map((player) => ({ name: player.name, controller: player.controller }))).toEqual([
      { name: "Ari", controller: { type: "human" } },
      { name: "Blake", controller: { type: "computer", strategy: "expert" } },
      { name: "Casey", controller: { type: "computer", strategy: "competent" } }
    ]);
  });
});
