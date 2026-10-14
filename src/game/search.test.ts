import { describe, expect, it } from "vitest";
import { mainDeckCards } from "../data/cards";
import { expandDeck } from "./deck";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";

function instances(definitionIds: string[]) {
  const deck = expandDeck(mainDeckCards, "search_test");
  return definitionIds.map((definitionId) => {
    const index = deck.findIndex((card) => card.definitionId === definitionId);
    if (index === -1) {
      throw new Error(`Missing ${definitionId}`);
    }
    const [card] = deck.splice(index, 1);
    return card;
  });
}

describe("Search ability", () => {
  it("draws three cards, waits for a keep choice, and discards the rest", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const [search] = instances(["ability_search"]);
    const [pistol, knife, shotgun] = instances(["weapon_pistol", "weapon_knife", "weapon_shotgun"]);
    state = {
      ...state,
      mainDeck: [pistol, knife, shotgun],
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, hand: [search], actionsRemaining: 2 } : candidate
      )
    };

    state = gameReducer(state, { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: search.instanceId });
    expect(state.pendingSearch?.playerId).toBe(player.id);
    expect(state.pendingSearch?.cards.map((card) => card.instanceId)).toEqual([pistol.instanceId, knife.instanceId, shotgun.instanceId]);

    state = gameReducer(state, {
      type: "RESOLVE_PENDING_SEARCH",
      playerId: player.id,
      keepCardInstanceId: shotgun.instanceId
    });

    const updatedPlayer = state.players.find((candidate) => candidate.id === player.id)!;
    expect(updatedPlayer.hand.map((card) => card.instanceId)).toEqual([shotgun.instanceId]);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([search.instanceId, pistol.instanceId, knife.instanceId]));
  });

  it("refills from discard when Search reaches the end of the deck", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const [search] = instances(["ability_search"]);
    const [pistol, knife, shotgun] = instances(["weapon_pistol", "weapon_knife", "weapon_shotgun"]);
    state = {
      ...state,
      mainDeck: [pistol],
      discardPile: [knife, shotgun],
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, hand: [search], actionsRemaining: 2 } : candidate
      )
    };

    state = gameReducer(state, { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: search.instanceId });

    expect(state.pendingSearch?.cards.map((card) => card.instanceId)).toEqual([pistol.instanceId, shotgun.instanceId, knife.instanceId]);
    expect(state.deckRandomState).not.toBe(0);
    expect(state.mainDeck).toHaveLength(0);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual([search.instanceId]);
  });

  it("does not create a keep choice when Search finds no cards", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const [search] = instances(["ability_search"]);
    state = {
      ...state,
      mainDeck: [],
      discardPile: [],
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, hand: [search], actionsRemaining: 2 } : candidate
      )
    };

    state = gameReducer(state, { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: search.instanceId });

    expect(state.pendingSearch).toBeNull();
    expect(state.players.find((candidate) => candidate.id === player.id)?.hand).toHaveLength(0);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual([search.instanceId]);
    expect(state.log.at(-1)?.message).toContain("found no cards");
  });
});
