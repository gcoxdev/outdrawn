import { describe, expect, it } from "vitest";
import { gameReducer } from "./reducer";
import { createNewGame, createSetupState } from "./setup";
import { loadGame, saveGame } from "./persistence";

function collapseFixture() {
  const state = createNewGame(["Ari", "Blake", "Casey", "Morgan"], () => 0);
  state.round = 8;
  state.firstPlayerIndex = 1;
  state.players.forEach((player, index) => {
    player.health = index === 3 ? 0 : 2;
    player.eliminated = index === 3;
    player.eliminations = index === 3 ? 99 : 2;
    player.hand = index === 3 ? [] : player.hand.slice(0, 1);
    player.actedThisRound = true;
  });
  return state;
}

describe("tiebreak explanations", () => {
  it.each(["eliminations", "health", "hand"])("explains the deciding %s comparison after Collapse", criterion => {
    const state = collapseFixture();
    if (criterion === "eliminations") state.players[0].eliminations = 3;
    if (criterion === "health") {
      state.players[1].health = 1;
      state.players[2].eliminations = 0; // More health cannot beat an earlier criterion.
    }
    if (criterion === "hand") {
      state.players[1].hand = [];
      state.players[2].eliminations = 0;
    }
    const result = gameReducer(state, { type: "END_TURN", playerId: "player_1" });
    expect(result.winnerId).toBe("player_1");
    expect(result.outcome?.kind).toBe("tiebreak");
    const expected = {
      eliminations: "Ari wins on eliminations: 3; the next highest among the remaining contenders was 2.",
      health: "Eliminations were tied. Ari wins on health before the final effect: 2; the next highest among the remaining contenders was 1.",
      hand: "Eliminations and health were tied. Ari wins on cards in hand before the final effect: 1; the next highest among the remaining contenders was 0."
    }[criterion];
    expect(result.outcome?.description).toBe(`Everyone fell in the final effect. ${expected}`);
    expect(result.players.every(player => player.hand.length === 0)).toBe(true);
    let saved = "";
    expect(saveGame(result, { setItem: (_, value) => { saved = value; }, removeItem() {} })).toBe(true);
    expect(loadGame(createSetupState(), { getItem: () => saved }).outcome).toEqual(result.outcome);
  });

  it("names the other finalist when an event eliminates the last two players", () => {
    const state = collapseFixture();
    state.players[0].health = state.players[1].health = 1;
    state.players[0].eliminations = 3;
    state.players[2].eliminated = true;
    state.players[2].health = 0;
    state.players[2].hand = [];
    state.mainDeck = [{ instanceId: "final_pressure", definitionId: "event_pressure_zone" }];
    const result = gameReducer(state, { type: "DRAW_CARD", playerId: "player_1" });
    expect(result.winnerId).toBe("player_1");
    expect(result.outcome?.description).toBe("Everyone fell in the final effect. Ari wins on eliminations: 3 vs. Blake’s 2.");
  });

  it("still declares a tie when all three criteria match", () => {
    const result = gameReducer(collapseFixture(), { type: "END_TURN", playerId: "player_1" });
    expect(result.winnerId).toBeNull();
    expect(result.outcome?.kind).toBe("tie");
    expect(result.outcome?.description).toContain("tied on eliminations, pre-effect health, and pre-effect hand size");
  });
});
