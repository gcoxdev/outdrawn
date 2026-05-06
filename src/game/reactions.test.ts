import { describe, expect, it } from "vitest";
import { mainDeckCards } from "../data/cards";
import { expandDeck } from "./deck";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";

function card(definitionId: string) {
  const instance = expandDeck(mainDeckCards, "reaction_test").find((candidate) => candidate.definitionId === definitionId);
  if (!instance) {
    throw new Error(`Missing ${definitionId}`);
  }
  return instance;
}

function attackWithReaction(reactionId: string, targetHealth = 20) {
  let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
  const attacker = state.players[state.currentPlayerIndex];
  const target = state.players.find((player) => player.id !== attacker.id)!;
  const weapon = card("weapon_pistol");
  const reaction = card(reactionId);
  state = {
    ...state,
    round: 3,
    players: state.players.map((player) =>
      player.id === attacker.id
        ? { ...player, hand: [weapon] }
        : player.id === target.id
          ? { ...player, health: targetHealth, hand: [reaction] }
          : player
    )
  };
  state = gameReducer(state, {
    type: "ATTACK",
    attackerId: attacker.id,
    targetPlayerId: target.id,
    weaponInstanceId: weapon.instanceId
  });
  state = gameReducer(state, {
    type: "PLAY_REACTION",
    defenderId: target.id,
    reactionCardInstanceId: reaction.instanceId
  });

  return { state, attacker, target, weapon, reaction };
}

describe("reaction defense cards", () => {
  it("counterattack deals damage back to the attacker after the defender takes damage", () => {
    const { state, attacker, target } = attackWithReaction("defense_counterattack");

    expect(state.players.find((player) => player.id === target.id)!.health).toBe(17);
    expect(state.players.find((player) => player.id === attacker.id)!.health).toBe(17);
  });

  it("fake death prevents lethal attack damage and discards the defender hand", () => {
    const { state, target, reaction } = attackWithReaction("defense_fake_death", 3);
    const defender = state.players.find((player) => player.id === target.id)!;

    expect(defender.eliminated).toBe(false);
    expect(defender.health).toBe(1);
    expect(defender.hand).toHaveLength(0);
    expect(state.discardPile.some((cardInstance) => cardInstance.instanceId === reaction.instanceId)).toBe(true);
  });
});
