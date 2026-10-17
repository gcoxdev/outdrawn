import { describe, expect, it } from "vitest";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";
import { defaultGameSettings } from "../data/constants";
import { normalizeSettings } from "./settings";

describe("turn order", () => {
  it("rotates turns clockwise and starts the next round with the next first player", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, { ...defaultGameSettings, turnOrder: "standard" });
    expect(state.players[state.currentPlayerIndex].name).toBe("Ari");

    state = gameReducer(state, { type: "END_TURN", playerId: state.players[state.currentPlayerIndex].id });
    expect(state.players[state.currentPlayerIndex].name).toBe("Blake");

    state = gameReducer(state, { type: "END_TURN", playerId: state.players[state.currentPlayerIndex].id });
    expect(state.players[state.currentPlayerIndex].name).toBe("Casey");

    state = gameReducer(state, { type: "END_TURN", playerId: state.players[state.currentPlayerIndex].id });
    expect(state.round).toBe(2);
    expect(state.players[state.currentPlayerIndex].name).toBe("Blake");

    state = gameReducer(state, { type: "END_TURN", playerId: state.players[state.currentPlayerIndex].id });
    expect(state.players[state.currentPlayerIndex].name).toBe("Casey");
  });
  it("defaults to repeating the same seating order across rounds", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    expect(state.settings.turnOrder).toBe("roundRobin");
    for (const expected of ["Ari", "Blake", "Casey", "Ari", "Blake", "Casey"]) {
      expect(state.players[state.currentPlayerIndex].name).toBe(expected);
      state = gameReducer(state, { type: "END_TURN", playerId: state.players[state.currentPlayerIndex].id });
    }
    expect(state.round).toBe(3);
    expect(state.firstPlayerIndex).toBe(0);
  });

  it("uses the new default for unspecified settings and preserves explicit rotating-start settings", () => {
    expect(normalizeSettings({}).turnOrder).toBe("roundRobin");
    expect(normalizeSettings({ turnOrder: undefined }).turnOrder).toBe("roundRobin");
    expect(normalizeSettings({ turnOrder: "standard" }).turnOrder).toBe("standard");
  });
});
