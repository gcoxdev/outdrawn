import { describe, expect, it } from "vitest";
import { mainDeckCards } from "../data/cards";
import { expandDeck } from "./deck";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";

function instances(definitionIds: string[]) {
  const deck = expandDeck(mainDeckCards, "ability_test");
  return definitionIds.map((definitionId) => {
    const index = deck.findIndex((card) => card.definitionId === definitionId);
    if (index === -1) {
      throw new Error(`Missing ${definitionId}`);
    }
    const [card] = deck.splice(index, 1);
    return card;
  });
}

function stateWithHands(currentIds: string[], targetIds: string[] = []) {
  const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
  const current = state.players[state.currentPlayerIndex];
  const target = state.players.find((player) => player.id !== current.id)!;

  return {
    state: {
      ...state,
      players: state.players.map((player) =>
        player.id === current.id
          ? { ...player, hand: instances(currentIds), actionsRemaining: 2 }
          : player.id === target.id
            ? { ...player, hand: instances(targetIds) }
            : player
      )
    },
    current,
    target
  };
}

describe("ability cards", () => {
  it("uses Ambush to boost the next attack and then clears the boost", () => {
    let { state, current, target } = stateWithHands(["ability_ambush", "weapon_pistol"]);
    const ambush = state.players[state.currentPlayerIndex].hand[0];
    const pistol = state.players[state.currentPlayerIndex].hand[1];

    state = gameReducer(state, { type: "PLAY_ABILITY", playerId: current.id, cardInstanceId: ambush.instanceId });
    expect(state.attackBonuses[current.id]).toBe(3);
    expect(state.players[state.currentPlayerIndex].actionsRemaining).toBe(1);

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: current.id,
      targetPlayerId: target.id,
      weaponInstanceId: pistol.instanceId
    });
    expect(state.pendingReaction?.baseDamage).toBe(6);

    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: target.id });
    expect(state.players.find((player) => player.id === target.id)!.health).toBe(14);
    expect(state.attackBonuses[current.id]).toBeUndefined();
  });

  it("uses Adrenaline to keep the same action count and lose health", () => {
    let { state, current } = stateWithHands(["ability_adrenaline"]);
    const adrenaline = state.players[state.currentPlayerIndex].hand[0];

    state = gameReducer(state, { type: "PLAY_ABILITY", playerId: current.id, cardInstanceId: adrenaline.instanceId });
    const player = state.players.find((candidate) => candidate.id === current.id)!;

    expect(player.actionsRemaining).toBe(2);
    expect(player.health).toBe(18);
    expect(state.discardPile.some((card) => card.instanceId === adrenaline.instanceId)).toBe(true);
  });

  it("uses Steal to take the first card from a target hand", () => {
    let { state, current, target } = stateWithHands(["ability_steal"], ["weapon_pistol"]);
    const steal = state.players[state.currentPlayerIndex].hand[0];
    const stolen = state.players.find((player) => player.id === target.id)!.hand[0];

    state = gameReducer(state, {
      type: "PLAY_ABILITY",
      playerId: current.id,
      cardInstanceId: steal.instanceId,
      targetPlayerId: target.id
    });

    expect(state.players.find((player) => player.id === current.id)!.hand.some((card) => card.instanceId === stolen.instanceId)).toBe(true);
    expect(state.players.find((player) => player.id === target.id)!.hand).toHaveLength(0);
  });

  it("uses Sabotage to discard two cards from a target hand", () => {
    let { state, current, target } = stateWithHands(["ability_sabotage"], ["weapon_pistol", "weapon_knife"]);
    const sabotage = state.players[state.currentPlayerIndex].hand[0];
    const targetCards = state.players.find((player) => player.id === target.id)!.hand;

    state = gameReducer(state, {
      type: "PLAY_ABILITY",
      playerId: current.id,
      cardInstanceId: sabotage.instanceId,
      targetPlayerId: target.id
    });

    expect(state.pendingDiscard?.playerId).toBe(target.id);
    expect(state.pendingDiscard?.count).toBe(2);
    expect(state.players.find((player) => player.id === target.id)!.hand).toHaveLength(2);

    state = gameReducer(state, {
      type: "RESOLVE_PENDING_DISCARD",
      playerId: target.id,
      cardInstanceIds: targetCards.map((card) => card.instanceId)
    });

    expect(state.players.find((player) => player.id === target.id)!.hand).toHaveLength(0);
    expect(state.discardPile).toHaveLength(3);
  });

  it("uses Mark Target to add damage against that player this round", () => {
    let { state, current, target } = stateWithHands(["ability_mark_target", "weapon_pistol"]);
    const mark = state.players[state.currentPlayerIndex].hand[0];
    const pistol = state.players[state.currentPlayerIndex].hand[1];

    state = gameReducer(state, {
      type: "PLAY_ABILITY",
      playerId: current.id,
      cardInstanceId: mark.instanceId,
      targetPlayerId: target.id
    });
    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: current.id,
      targetPlayerId: target.id,
      weaponInstanceId: pistol.instanceId
    });

    expect(state.pendingReaction?.baseDamage).toBe(4);
  });
});
