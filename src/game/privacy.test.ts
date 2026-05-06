import { describe, expect, it } from "vitest";
import { defaultGameSettings } from "../data/constants";
import { mainDeckCards } from "../data/cards";
import { expandDeck } from "./deck";
import { getPassDeviceContext } from "./privacy";
import { createNewGame } from "./setup";

function instance(definitionId: string) {
  const card = expandDeck(mainDeckCards, "privacy_test").find((candidate) => candidate.definitionId === definitionId);
  if (!card) {
    throw new Error(`Missing ${definitionId}`);
  }
  return card;
}

describe("pass device privacy", () => {
  it("does not prompt when only one living human remains", () => {
    const state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" } },
        { name: "Blake", controller: { type: "computer", strategy: "competent" } },
        { name: "Casey", controller: { type: "computer", strategy: "competent" } }
      ],
      () => 0,
      { ...defaultGameSettings, passDeviceMode: true }
    );

    expect(getPassDeviceContext(state, null)).toBeNull();
  });

  it("does not re-prompt for follow-up choices by the same human", () => {
    const search = instance("ability_search");
    let state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" } },
        { name: "Blake", controller: { type: "human" } },
        { name: "Casey", controller: { type: "computer", strategy: "competent" } }
      ],
      () => 0,
      { ...defaultGameSettings, passDeviceMode: true }
    );
    const current = state.players[state.currentPlayerIndex];
    state = {
      ...state,
      players: state.players.map((player) => (player.id === current.id ? { ...player, hand: [search], actionsRemaining: 2 } : player)),
      pendingSearch: {
        playerId: current.id,
        cards: [instance("weapon_pistol"), instance("weapon_knife"), instance("healing_bandage")]
      }
    };

    expect(getPassDeviceContext(state, current.id)).toBeNull();
  });

  it("explains reaction prompts when a different human is attacked", () => {
    const state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" } },
        { name: "Blake", controller: { type: "human" } },
        { name: "Casey", controller: { type: "computer", strategy: "competent" } }
      ],
      () => 0,
      { ...defaultGameSettings, passDeviceMode: true }
    );
    const attacker = state.players[state.currentPlayerIndex];
    const defender = state.players.find((player) => player.id !== attacker.id && player.controller.type === "human")!;
    const context = getPassDeviceContext(
      {
        ...state,
        pendingReaction: {
          attackerId: attacker.id,
          defenderId: defender.id,
          weapon: instance("weapon_pistol"),
          baseDamage: 3
        }
      },
      attacker.id
    );

    expect(context?.playerId).toBe(defender.id);
    expect(context?.reason).toContain("being attacked");
  });
});
