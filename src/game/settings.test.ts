import { describe, expect, it } from "vitest";
import { defaultGameSettings } from "../data/constants";
import { expandDeck } from "./deck";
import { mainDeckCards } from "../data/cards";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";

function hand(count: number) {
  return expandDeck(mainDeckCards, "settings").slice(0, count);
}

describe("game settings", () => {
  it("uses custom health settings when starting a game", () => {
    const state = createNewGame(
      ["Ari", "Blake", "Casey"],
      () => 0,
      {
        ...defaultGameSettings,
        startingHealth: 30,
        maxHealth: 30
      }
    );

    expect(state.settings.startingHealth).toBe(30);
    expect(state.players.every((player) => player.health === 30)).toBe(true);
  });

  it("uses custom max hand size for end-turn cleanup", () => {
    const state = createNewGame(
      ["Ari", "Blake", "Casey"],
      () => 0,
      {
        ...defaultGameSettings,
        maxHandSize: 3
      }
    );
    const currentPlayer = state.players[state.currentPlayerIndex];
    const overLimit = {
      ...state,
      players: state.players.map((player) =>
        player.id === currentPlayer.id
          ? {
              ...player,
              hand: hand(4)
            }
          : player
      )
    };

    const blocked = gameReducer(overLimit, { type: "END_TURN", playerId: currentPlayer.id });

    expect(blocked.currentPlayerIndex).toBe(overLimit.currentPlayerIndex);
    expect(blocked.log.at(-1)?.message).toContain("discard down to 3");
  });

  it("uses custom draw settings when starting a game", () => {
    const state = createNewGame(["Ari", "Blake", "Casey"], () => 0, {
      ...defaultGameSettings,
      drawsPerTurn: 3,
      drawsUseActions: false
    });

    expect(state.settings.drawsPerTurn).toBe(3);
    expect(state.settings.drawsUseActions).toBe(false);
    expect(state.players.every((player) => player.drawsRemaining === 3)).toBe(true);
  });
});
