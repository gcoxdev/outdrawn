import { describe, expect, it } from "vitest";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";
import { loadGame, saveGame } from "./persistence";
import type { GameState } from "./types";

const card = (definitionId: string) => ({ instanceId: `test_${definitionId}`, definitionId });
function fixture(round = 3, firstPlayerIndex = 0) {
  const state = createNewGame(["Ari", "Blake", "Casey", "Devon"], () => 0);
  state.round = round;
  state.firstPlayerIndex = firstPlayerIndex;
  state.currentPlayerIndex = firstPlayerIndex;
  state.settings.passDeviceMode = false;
  state.players.forEach(player => { player.hand = []; });
  state.mainDeck = [card("weapon_knife")];
  return state;
}
function endTurn(state: GameState) {
  return gameReducer(state, { type: "END_TURN", playerId: state.players[state.currentPlayerIndex].id });
}

describe("round-robin elimination boundaries", () => {
  it.each([[3, 0], [3, 2], [8, 0], [8, 2]])("finishes round %i in seating order after starter at seat index %i self-eliminates", (round, firstIndex) => {
    let state = fixture(round, firstIndex);
    const starter = state.players[firstIndex];
    starter.health = 2;
    starter.hand = [card("ability_adrenaline")];
    const marks = { [state.players[(firstIndex + 3) % 4].id]: 1 };
    state.markedTargets = marks;
    state = gameReducer(state, { type: "PLAY_ABILITY", playerId: starter.id, cardInstanceId: starter.hand[0].instanceId });
    expect(state.players[firstIndex].eliminated).toBe(true);
    expect(state.round).toBe(round);
    expect(state.markedTargets).toEqual(marks);
    expect(state.players.filter(player => !player.eliminated).map(player => player.health)).toEqual([20, 20, 20]);

    // Resume the match with the existing save format before completing the round.
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    expect(saveGame(state, storage)).toBe(true);
    state = loadGame({ ...state, phase: "setup" }, storage);
    expect(state.phase).toBe("action");
    for (let offset = 1; offset <= 3; offset++) {
      expect(state.currentPlayerIndex).toBe((firstIndex + offset) % 4);
      expect(state.round).toBe(round);
      expect(state.markedTargets).toEqual(marks);
      state = endTurn(state);
    }
    const collapse = round >= 8 ? 2 : 1;
    expect(state.round).toBe(round + 1);
    expect(state.currentPlayerIndex).toBe((firstIndex + 1) % 4);
    expect(state.firstPlayerIndex).toBe(state.currentPlayerIndex);
    expect(state.players.filter(player => !player.eliminated).map(player => player.health)).toEqual([20 - collapse, 20 - collapse, 20 - collapse]);
    expect(state.players.every(player => !player.actedThisRound)).toBe(true);
    expect(state.markedTargets).toEqual({});
    expect(state.log.filter(entry => entry.message.includes("collapse damage"))).toHaveLength(3);
  });

  it.each(["defense_counterattack", "defense_backfire"])("does not skip the remaining turns when %s eliminates the starter", reaction => {
    let state = fixture();
    state.players[0].health = 3;
    state.players[0].hand = [card("weapon_pistol")];
    state.players[1].hand = [card(reaction)];
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: card("weapon_pistol").instanceId });
    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: card(reaction).instanceId });
    expect(state.players[0].eliminated).toBe(true);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.round).toBe(3);
    expect(state.players.slice(1).map(player => player.health)).toEqual([reaction === "defense_counterattack" ? 17 : 20, 20, 20]);
    expect(state.log.some(entry => entry.message.includes("collapse damage"))).toBe(false);
  });

  it("waits for the event dialog, then gives surviving players their turns without collapse", () => {
    let state = fixture();
    state.players[0].health = 1;
    state.mainDeck = [card("event_pressure_zone"), card("weapon_knife")];
    state = gameReducer(state, { type: "DRAW_CARD", playerId: "player_1" });
    expect(state.players[0].eliminated).toBe(true);
    expect(state.pendingEventDialog).not.toBeNull();
    expect(state.round).toBe(3);
    state = gameReducer(state, { type: "ACKNOWLEDGE_EVENT_DIALOG" });
    expect(state.pendingEventDialog).toBeNull();
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.round).toBe(3);
    expect(state.players.slice(1).map(player => player.health)).toEqual([19, 19, 19]);
  });

  it("still ends the round when the starter dies after having taken their turn", () => {
    let state = fixture();
    state.players[0].health = 3;
    state.players[3].hand = [card("weapon_pistol")];
    state = endTurn(endTurn(endTurn(state)));
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_4", targetPlayerId: "player_1", weaponInstanceId: card("weapon_pistol").instanceId });
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: "player_1" });
    expect(state.round).toBe(3);
    state = endTurn(state);
    expect(state.round).toBe(4);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.players.slice(1).map(player => player.health)).toEqual([19, 19, 19]);
  });
});
