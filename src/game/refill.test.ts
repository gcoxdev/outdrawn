import { describe, expect, it } from "vitest";
import { createNewGame } from "./setup";
import { gameReducer } from "./reducer";
import { resolveHealing } from "./combat";
import { drawCardsWithRefill } from "./deck";
import { getCardDefinitionById } from "./rules";
import { ownedCards } from "./simulator";
import type { GameState } from "./types";

describe("discard shuffle integration", () => {
  it.each(["draw", "search", "market", "healing", "direct healing"])("persists shuffle state through %s and leaves events out of refills", mode => {
    const state = createNewGame(["A", "B", "C"], () => 0);
    const card = (id: string) => ({ instanceId: `refill_${id}`, definitionId: id });
    state.players.forEach(player => { player.hand = []; });
    state.mainDeck = [];
    state.discardPile = ["weapon_pistol", "weapon_knife", "weapon_shotgun", "defense_dodge", "healing_bandage"].map(card);
    state.eventDiscardPile = [card("event_pressure_zone")];
    state.deckRandomState = 1234;
    const expected = drawCardsWithRefill([], state.discardPile, mode === "search" || mode === "market" ? 3 : 1, state.deckRandomState);
    const run = (input: GameState) => {
      if (mode === "draw") return gameReducer(input, { type: "DRAW_CARD", playerId: "player_1" });
      if (mode === "search") return gameReducer(input, { type: "PLAY_ABILITY", playerId: "player_1", cardInstanceId: "refill_ability_search" });
      if (mode === "market") return gameReducer(input, { type: "START_BLACK_MARKET", playerId: "player_1", cardInstanceIds: [] });
      if (mode === "healing") return gameReducer(input, { type: "PLAY_HEALING", playerId: "player_1", cardInstanceId: "refill_healing_painkillers" });
      if (mode === "direct healing") return resolveHealing(input, input.players[0], card("healing_painkillers"), getCardDefinitionById("healing_painkillers")!).state;
      throw new Error(`Unknown refill path: ${mode}`);
    };
    if (mode === "search") state.players[0].hand = [card("ability_search")];
    if (mode.includes("healing")) { state.players[0].hand = [card("healing_painkillers")]; state.players[0].health = 10; }
    if (mode === "market") {
      state.settings.blackMarketPreset = "healthPay";
      state.pendingBlackMarket = { playerId: "player_1", card: card("event_black_market") };
    }
    const before = structuredClone(state);
    const next = run(state);
    expect(state).toEqual(before);
    expect(run(state)).toEqual(next);
    expect(next.deckRandomState).toBe(expected.deckRandomState);
    expect(next.mainDeck).toEqual(expected.mainDeck);
    expect(next.eventDiscardPile).toEqual(state.eventDiscardPile);
    const drawn = next.pendingSearch?.cards ?? next.pendingMarketSearch?.cards ?? next.players[0].hand;
    expect(drawn).toEqual(expected.drawn);
    expect(ownedCards(next).map(card => card.instanceId).sort()).toEqual(ownedCards(state).map(card => card.instanceId).sort());
  });
});
