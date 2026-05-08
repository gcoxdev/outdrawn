import { describe, expect, it } from "vitest";
import { MAX_HEALTH } from "../data/constants";
import { mainDeckCards } from "../data/cards";
import { expandDeck } from "./deck";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";

function cardInstance(definitionId: string) {
  const card = expandDeck(mainDeckCards, "combat").find((instance) => instance.definitionId === definitionId);
  if (!card) {
    throw new Error(`Missing test card ${definitionId}`);
  }
  return card;
}

function stateWithCurrentPlayerCards(definitionIds: string[]) {
  const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
  const currentPlayer = state.players[state.currentPlayerIndex];
  const instances = expandDeck(mainDeckCards, "combat_hand");
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === currentPlayer.id
        ? {
            ...player,
            hand: definitionIds.map((definitionId) => {
              const cardIndex = instances.findIndex((instance) => instance.definitionId === definitionId);
              if (cardIndex === -1) {
                throw new Error(`Missing test card ${definitionId}`);
              }
              const [card] = instances.splice(cardIndex, 1);
              return card;
            }),
            actionsRemaining: 2
          }
        : player
    )
  };
}

describe("combat and healing", () => {
  it("plays a weapon from hand, lets armor vest react, then discards both cards", () => {
    let state = stateWithCurrentPlayerCards(["weapon_sniper_rifle"]);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    const armor = cardInstance("defense_armor_vest");
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === target.id
          ? {
              ...player,
              hand: [armor]
            }
          : player
      )
    };
    const weapon = attacker.hand[0];
    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: weapon.instanceId
    });
    expect(state.pendingReaction?.defenderId).toBe(target.id);
    state = gameReducer(state, {
      type: "PLAY_REACTION",
      defenderId: target.id,
      reactionCardInstanceId: armor.instanceId
    });
    const damagedTarget = state.players.find((player) => player.id === target.id)!;
    const updatedAttacker = state.players.find((player) => player.id === attacker.id)!;

    expect(damagedTarget.health).toBe(14);
    expect(updatedAttacker.hand.some((card) => card.instanceId === weapon.instanceId)).toBe(false);
    expect(damagedTarget.hand.some((card) => card.instanceId === armor.instanceId)).toBe(false);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([weapon.instanceId, armor.instanceId]));
  });

  it("ignores armor reactions for crossbow attacks", () => {
    let state = stateWithCurrentPlayerCards(["weapon_crossbow"]);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    const armor = cardInstance("defense_armor_vest");
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === target.id
          ? {
              ...player,
              hand: [armor]
            }
          : player
      )
    };
    const weapon = attacker.hand[0];
    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: weapon.instanceId
    });
    state = gameReducer(state, {
      type: "PLAY_REACTION",
      defenderId: target.id,
      reactionCardInstanceId: armor.instanceId
    });

    expect(state.players.find((player) => player.id === target.id)!.health).toBe(16);
  });

  it("Assault Rifle deals 5 damage to one target", () => {
    let state = stateWithCurrentPlayerCards(["weapon_assault_rifle"]);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    const weapon = attacker.hand[0];

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: weapon.instanceId
    });

    expect(state.pendingReaction?.baseDamage).toBe(5);

    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: target.id });

    expect(state.players.find((player) => player.id === target.id)!.health).toBe(15);
  });

  it("does not keep a reusable shotgun after attacking", () => {
    let state = stateWithCurrentPlayerCards(["weapon_shotgun"]);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    const weapon = attacker.hand[0];
    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: weapon.instanceId
    });
    state = gameReducer(state, {
      type: "SKIP_REACTION",
      defenderId: target.id
    });

    expect(state.players.find((player) => player.id === attacker.id)!.hand).toHaveLength(0);
    expect(state.discardPile.some((card) => card.instanceId === weapon.instanceId)).toBe(true);
  });

  it("eliminates players and declares a winner", () => {
    let state = stateWithCurrentPlayerCards(["weapon_pistol"]);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) =>
        player.id === target.id
          ? { ...player, health: 3 }
          : player.id !== attacker.id
            ? { ...player, eliminated: true, health: 0 }
            : player
      )
    };
    const weapon = attacker.hand[0];
    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: weapon.instanceId
    });
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: target.id });

    expect(state.players.find((player) => player.id === target.id)!.eliminated).toBe(true);
    expect(state.phase).toBe("gameOver");
    expect(state.winnerId).toBe(attacker.id);
  });

  it("plays simple healing cards without exceeding max health", () => {
    let state = stateWithCurrentPlayerCards(["healing_bandage", "healing_painkillers"]);
    const player = state.players[state.currentPlayerIndex];
    state = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, health: MAX_HEALTH - 1 } : candidate
      )
    };
    const bandage = state.players[state.currentPlayerIndex].hand[0];
    state = gameReducer(state, {
      type: "PLAY_HEALING",
      playerId: player.id,
      cardInstanceId: bandage.instanceId
    });

    expect(state.players.find((candidate) => candidate.id === player.id)!.health).toBe(MAX_HEALTH);
    expect(state.players.find((candidate) => candidate.id === player.id)!.actionsRemaining).toBe(1);
  });

  it("requires players over the hand limit to discard before ending turn", () => {
    let state = stateWithCurrentPlayerCards([
      "weapon_pistol",
      "weapon_pistol",
      "weapon_pistol",
      "weapon_pistol",
      "weapon_pistol",
      "weapon_pistol",
      "weapon_knife",
      "weapon_knife"
    ]);
    const player = state.players[state.currentPlayerIndex];
    const discardedCard = player.hand[0];

    const blocked = gameReducer(state, { type: "END_TURN", playerId: player.id });
    expect(blocked.currentPlayerIndex).toBe(state.currentPlayerIndex);

    state = gameReducer(state, {
      type: "DISCARD_CARD",
      playerId: player.id,
      cardInstanceId: discardedCard.instanceId
    });
    expect(state.players[state.currentPlayerIndex].hand).toHaveLength(7);
    expect(state.discardPile.some((card) => card.instanceId === discardedCard.instanceId)).toBe(true);

    const ended = gameReducer(state, { type: "END_TURN", playerId: player.id });
    expect(ended.currentPlayerIndex).not.toBe(state.currentPlayerIndex);
  });
});
