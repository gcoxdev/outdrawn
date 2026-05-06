import { describe, expect, it } from "vitest";
import { ACTIONS_PER_TURN, STARTING_HAND_SIZE } from "../data/constants";
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

describe("game reducer turns and equipment", () => {
  it("draws a card and spends one action", () => {
    const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = getCurrentPlayer(state);
    const next = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });
    const nextPlayer = getCurrentPlayer(next);

    expect(nextPlayer.hand).toHaveLength(STARTING_HAND_SIZE + 1);
    expect(nextPlayer.actionsRemaining).toBe(ACTIONS_PER_TURN - 1);
    expect(next.mainDeck).toHaveLength(state.mainDeck.length - 1);
  });

  it("equips weapon and defense cards from hand", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = getCurrentPlayer(state);
    const weapon = cardInstance("weapon_pistol");
    const defense = cardInstance("defense_armor_vest");
    state = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? {
              ...candidate,
              hand: [weapon, defense],
              actionsRemaining: 2
            }
          : candidate
      )
    };

    const withWeapon = gameReducer(state, {
      type: "EQUIP_CARD",
      playerId: player.id,
      cardInstanceId: weapon.instanceId
    });
    const withDefense = gameReducer(withWeapon, {
      type: "EQUIP_CARD",
      playerId: player.id,
      cardInstanceId: defense.instanceId
    });
    const nextPlayer = getCurrentPlayer(withDefense);

    expect(nextPlayer.equippedWeapon?.definitionId).toBe(weapon.definitionId);
    expect(nextPlayer.equippedDefense?.definitionId).toBe("defense_armor_vest");
    expect(nextPlayer.actionsRemaining).toBe(0);
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
});
