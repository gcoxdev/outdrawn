import { describe, expect, it } from "vitest";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";

describe("turn order", () => {
  it("rotates turns clockwise and starts the next round with the next first player", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
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
});
