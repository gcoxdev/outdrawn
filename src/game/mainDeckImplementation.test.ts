import { describe, expect, it } from "vitest";
import { mainDeckCards } from "../data/cards";
import { expandDeck } from "./deck";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";

function instances(definitionIds: string[]) {
  const deck = expandDeck(mainDeckCards, "main_deck_impl");
  return definitionIds.map((definitionId) => {
    const index = deck.findIndex((card) => card.definitionId === definitionId);
    if (index === -1) {
      throw new Error(`Missing ${definitionId}`);
    }
    const [card] = deck.splice(index, 1);
    return card;
  });
}

describe("remaining main deck card implementations", () => {
  it("Second Wind can be played as lethal defense and discards the defender hand", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const defender = state.players.find((player) => player.id !== attacker.id)!;
    const [weapon, secondWind, extraCard] = instances(["weapon_pistol", "healing_second_wind", "weapon_knife"]);
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [weapon] }
          : player.id === defender.id
            ? { ...player, health: 3, hand: [secondWind, extraCard] }
            : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: defender.id,
      weaponInstanceId: weapon.instanceId
    });
    state = gameReducer(state, {
      type: "PLAY_REACTION",
      defenderId: defender.id,
      reactionCardInstanceId: secondWind.instanceId
    });

    const updatedDefender = state.players.find((player) => player.id === defender.id)!;
    expect(updatedDefender.eliminated).toBe(false);
    expect(updatedDefender.health).toBe(1);
    expect(updatedDefender.hand).toHaveLength(0);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([secondWind.instanceId, extraCard.instanceId]));
  });

  it("Reload recovers the highest-damage weapon from discard into hand", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const [reload, pistol, shotgun] = instances(["ability_reload", "weapon_pistol", "weapon_shotgun"]);
    state = {
      ...state,
      discardPile: [pistol, shotgun],
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, hand: [reload], actionsRemaining: 2 } : candidate
      )
    };

    state = gameReducer(state, { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: reload.instanceId });

    const updatedPlayer = state.players.find((candidate) => candidate.id === player.id)!;
    expect(updatedPlayer.hand.map((card) => card.instanceId)).toEqual([shotgun.instanceId]);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual([pistol.instanceId, reload.instanceId]);
    expect(updatedPlayer.actionsRemaining).toBe(1);
  });

  it("Ricochet redirects an attack to another chosen player", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const defender = state.players.find((player) => player.id !== attacker.id)!;
    const redirectedTarget = state.players.find((player) => player.id !== attacker.id && player.id !== defender.id)!;
    const [weapon, ricochet] = instances(["weapon_pistol", "defense_decoy"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [weapon] }
          : player.id === defender.id
            ? { ...player, hand: [ricochet] }
            : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: defender.id,
      weaponInstanceId: weapon.instanceId
    });
    state = gameReducer(state, {
      type: "PLAY_REACTION",
      defenderId: defender.id,
      reactionCardInstanceId: ricochet.instanceId
    });
    expect(state.pendingRedirect?.defenderId).toBe(defender.id);

    state = gameReducer(state, {
      type: "RESOLVE_PENDING_REDIRECT",
      defenderId: defender.id,
      targetPlayerId: redirectedTarget.id
    });

    expect(state.players.find((player) => player.id === defender.id)!.health).toBe(20);
    expect(state.players.find((player) => player.id === redirectedTarget.id)!.health).toBe(17);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([weapon.instanceId, ricochet.instanceId]));
  });

  it("Backfire cancels incoming damage and only damages the attacker", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const defender = state.players.find((player) => player.id !== attacker.id)!;
    const [weapon, backfire] = instances(["weapon_pistol", "defense_backfire"]);
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [weapon] }
          : player.id === defender.id
            ? { ...player, hand: [backfire] }
            : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: defender.id,
      weaponInstanceId: weapon.instanceId
    });
    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: defender.id, reactionCardInstanceId: backfire.instanceId });

    expect(state.players.find((player) => player.id === defender.id)!.health).toBe(20);
    expect(state.players.find((player) => player.id === attacker.id)!.health).toBe(18);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([weapon.instanceId, backfire.instanceId]));
  });

  it("Minigun damages every other living player", () => {
    let state = createNewGame(["Ari", "Blake", "Casey", "Devon"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    const [minigun] = instances(["weapon_minigun"]);
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) => (player.id === attacker.id ? { ...player, hand: [minigun], actionsRemaining: 2 } : player))
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: minigun.instanceId
    });

    expect(state.pendingReaction).toBeNull();
    expect(state.players.find((player) => player.id === attacker.id)!.health).toBe(20);
    state.players
      .filter((player) => player.id !== attacker.id)
      .forEach((player) => expect(player.health).toBe(19));
    expect(state.players.find((player) => player.id === attacker.id)!.actionsRemaining).toBe(1);
    expect(state.discardPile.map((card) => card.instanceId)).toContain(minigun.instanceId);
  });

  it("Grenade damages the primary target and splashes nearby non-attackers", () => {
    let state = createNewGame(["Ari", "Blake", "Casey", "Devon"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players[1];
    const splashTarget = state.players[2];
    const [grenade] = instances(["weapon_grenade"]);
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) => (player.id === attacker.id ? { ...player, hand: [grenade] } : player))
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: grenade.instanceId
    });
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: target.id });

    expect(state.players.find((player) => player.id === target.id)!.health).toBe(16);
    expect(state.players.find((player) => player.id === splashTarget.id)!.health).toBe(18);
    expect(state.players.find((player) => player.id === attacker.id)!.health).toBe(20);
  });

  it("Intimidate makes the target discard a card before attacking the intimidating player", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const current = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== current.id)!;
    const [intimidate, weapon, costCard] = instances(["ability_intimidate", "weapon_pistol", "weapon_knife"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === current.id
          ? { ...player, hand: [intimidate], actionsRemaining: 2 }
          : player.id === target.id
            ? { ...player, hand: [weapon, costCard], actionsRemaining: 2 }
            : player
      )
    };

    state = gameReducer(state, {
      type: "PLAY_ABILITY",
      playerId: current.id,
      cardInstanceId: intimidate.instanceId,
      targetPlayerId: target.id
    });
    expect(state.intimidations[target.id]).toEqual([current.id]);

    state = {
      ...state,
      currentPlayerIndex: state.players.findIndex((player) => player.id === target.id)
    };
    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: target.id,
      targetPlayerId: current.id,
      weaponInstanceId: weapon.instanceId
    });
    expect(state.pendingAttackCost?.attackerId).toBe(target.id);

    state = gameReducer(state, {
      type: "RESOLVE_PENDING_ATTACK_COST",
      attackerId: target.id,
      cardInstanceId: costCard.instanceId
    });

    expect(state.pendingReaction?.defenderId).toBe(current.id);
    expect(state.players.find((player) => player.id === target.id)!.hand.map((card) => card.instanceId)).toEqual([weapon.instanceId]);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([intimidate.instanceId, costCard.instanceId]));
  });

  it("SMG resolves as two separate 2-damage hits with separate reaction windows", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const defender = state.players.find((player) => player.id !== attacker.id)!;
    const [smg, shield] = instances(["weapon_smg", "defense_shield_plate"]);
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [smg], actionsRemaining: 2 }
          : player.id === defender.id
            ? { ...player, hand: [shield] }
            : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: defender.id,
      weaponInstanceId: smg.instanceId
    });
    expect(state.pendingReaction?.baseDamage).toBe(2);
    expect(state.pendingMultiHitAttack?.hitsRemaining).toBe(2);

    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: defender.id, reactionCardInstanceId: shield.instanceId });
    expect(state.players.find((player) => player.id === defender.id)!.health).toBe(20);
    expect(state.pendingReaction?.baseDamage).toBe(2);
    expect(state.pendingMultiHitAttack?.hitsRemaining).toBe(1);

    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: defender.id });

    expect(state.players.find((player) => player.id === defender.id)!.health).toBe(18);
    expect(state.pendingReaction).toBeNull();
    expect(state.pendingMultiHitAttack).toBeNull();
    expect(state.players.find((player) => player.id === attacker.id)!.hand).toHaveLength(0);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([smg.instanceId, shield.instanceId]));
  });

  it("Smoke Bomb stops the second SMG hit after canceling the first hit", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const defender = state.players.find((player) => player.id !== attacker.id)!;
    const [smg, smoke] = instances(["weapon_smg", "defense_smoke_bomb"]);
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [smg], actionsRemaining: 2 }
          : player.id === defender.id
            ? { ...player, hand: [smoke] }
            : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: defender.id,
      weaponInstanceId: smg.instanceId
    });
    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: defender.id, reactionCardInstanceId: smoke.instanceId });

    expect(state.players.find((player) => player.id === defender.id)!.health).toBe(20);
    expect(state.pendingReaction).toBeNull();
    expect(state.pendingMultiHitAttack).toBeNull();
    expect(state.smokeProtectedPlayerIds).toContain(defender.id);
  });
});
