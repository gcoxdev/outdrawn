import { describe, expect, it } from "vitest";
import { mainDeckCards } from "../data/cards";
import { defaultGameSettings } from "../data/constants";
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
  it("Revive applies healing cards and discards the defender hand", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const defender = state.players.find((player) => player.id !== attacker.id)!;
    const [weapon, revive, medkit, bandage, extraCard] = instances(["weapon_pistol", "defense_fake_death", "healing_medkit", "healing_bandage", "weapon_knife"]);
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [weapon] }
          : player.id === defender.id
            ? { ...player, health: 3, hand: [revive, medkit, bandage, extraCard] }
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
      reactionCardInstanceId: revive.instanceId
    });

    const updatedDefender = state.players.find((player) => player.id === defender.id)!;
    expect(updatedDefender.eliminated).toBe(false);
    expect(updatedDefender.health).toBe(10);
    expect(updatedDefender.hand).toHaveLength(0);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(
      expect.arrayContaining([revive.instanceId, medkit.instanceId, bandage.instanceId, extraCard.instanceId])
    );
  });

  it("Reload keeps the next weapon in hand after it resolves", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const target = state.players.find((candidate) => candidate.id !== player.id)!;
    const [reload, pistol] = instances(["ability_reload", "weapon_pistol"]);
    state = {
      ...state,
      round: 3,
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, hand: [reload, pistol], actionsRemaining: 2 } : candidate
      )
    };

    state = gameReducer(state, { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: reload.instanceId });
    expect(state.reloadPlayerIds).toContain(player.id);

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: player.id,
      targetPlayerId: target.id,
      weaponInstanceId: pistol.instanceId
    });
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: target.id });

    const updatedPlayer = state.players.find((candidate) => candidate.id === player.id)!;
    expect(updatedPlayer.hand.map((card) => card.instanceId)).toEqual([pistol.instanceId]);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual([reload.instanceId]);
    expect(state.reloadPlayerIds).not.toContain(player.id);
    expect(updatedPlayer.actionsRemaining).toBe(0);
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

  it("Backfire cancels incoming damage and mirrors it onto the attacker", () => {
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
    expect(state.players.find((player) => player.id === attacker.id)!.health).toBe(17);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([weapon.instanceId, backfire.instanceId]));
  });

  it("can allow defense against Backfire damage", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, {
      ...defaultGameSettings,
      allowSecondaryDefense: true
    });
    const attacker = state.players[state.currentPlayerIndex];
    const defender = state.players.find((player) => player.id !== attacker.id)!;
    const [weapon, backfire, shield] = instances(["weapon_pistol", "defense_backfire", "defense_shield_plate"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [weapon, shield] }
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

    expect(state.pendingSecondaryDamage).toMatchObject({ defenderId: attacker.id, source: "backfire", baseDamage: 3 });

    state = gameReducer(state, {
      type: "PLAY_SECONDARY_REACTION",
      defenderId: attacker.id,
      reactionCardInstanceId: shield.instanceId
    });

    expect(state.players.find((player) => player.id === defender.id)!.health).toBe(20);
    expect(state.players.find((player) => player.id === attacker.id)!.health).toBe(20);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([weapon.instanceId, backfire.instanceId, shield.instanceId]));
  });

  it("can allow defense against Counterattack damage", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, {
      ...defaultGameSettings,
      allowSecondaryDefense: true
    });
    const attacker = state.players[state.currentPlayerIndex];
    const defender = state.players.find((player) => player.id !== attacker.id)!;
    const [weapon, counterattack, shield] = instances(["weapon_pistol", "defense_counterattack", "defense_shield_plate"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [weapon, shield] }
          : player.id === defender.id
            ? { ...player, hand: [counterattack] }
            : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: defender.id,
      weaponInstanceId: weapon.instanceId
    });
    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: defender.id, reactionCardInstanceId: counterattack.instanceId });

    expect(state.pendingSecondaryDamage).toMatchObject({ defenderId: attacker.id, source: "counterattack", baseDamage: 3 });

    state = gameReducer(state, {
      type: "PLAY_SECONDARY_REACTION",
      defenderId: attacker.id,
      reactionCardInstanceId: shield.instanceId
    });

    expect(state.players.find((player) => player.id === defender.id)!.health).toBe(17);
    expect(state.players.find((player) => player.id === attacker.id)!.health).toBe(20);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([weapon.instanceId, counterattack.instanceId, shield.instanceId]));
  });

  it("can allow defense against assigned Minigun damage", () => {
    let state = createNewGame(["Ari", "Blake", "Casey", "Devon"], () => 0, {
      ...defaultGameSettings,
      allowSecondaryDefense: true
    });
    const attacker = state.players[state.currentPlayerIndex];
    const defender = state.players.find((player) => player.id !== attacker.id)!;
    const [minigun, shield] = instances(["weapon_minigun", "defense_shield_plate"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [minigun], actionsRemaining: 2 }
          : player.id === defender.id
            ? { ...player, hand: [shield] }
            : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      weaponInstanceId: minigun.instanceId,
      damageByTarget: { [defender.id]: 3, [state.players.find((player) => player.id !== attacker.id && player.id !== defender.id)!.id]: 2 }
    });

    expect(state.pendingSecondaryDamage).toMatchObject({ defenderId: defender.id, source: "minigun", baseDamage: 3 });

    state = gameReducer(state, {
      type: "PLAY_SECONDARY_REACTION",
      defenderId: defender.id,
      reactionCardInstanceId: shield.instanceId
    });

    expect(state.players.find((player) => player.id === defender.id)!.health).toBe(20);
    expect(state.pendingSecondaryDamage?.source).toBe("minigun");
  });

  it("Minigun allocates 6 total damage among opponents", () => {
    let state = createNewGame(["Ari", "Blake", "Casey", "Devon"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const [minigun] = instances(["weapon_minigun"]);
    const targets = state.players.filter((player) => player.id !== attacker.id);
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) => (player.id === attacker.id ? { ...player, hand: [minigun], actionsRemaining: 2 } : player))
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      weaponInstanceId: minigun.instanceId,
      damageByTarget: {
        [targets[0].id]: 3,
        [targets[1].id]: 2,
        [targets[2].id]: 1
      }
    });

    expect(state.pendingReaction).toBeNull();
    expect(state.players.find((player) => player.id === attacker.id)!.health).toBe(20);
    expect(state.players.find((player) => player.id === targets[0].id)!.health).toBe(17);
    expect(state.players.find((player) => player.id === targets[1].id)!.health).toBe(18);
    expect(state.players.find((player) => player.id === targets[2].id)!.health).toBe(19);
    expect(state.players.find((player) => player.id === attacker.id)!.actionsRemaining).toBe(1);
    expect(state.discardPile.map((card) => card.instanceId)).toContain(minigun.instanceId);
  });

  it("Minigun rejects allocations above the total pool or per-target cap", () => {
    let state = createNewGame(Array.from({ length: 10 }, (_, index) => `Player ${index + 1}`), () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const [minigun] = instances(["weapon_minigun"]);
    const targets = state.players.filter((player) => player.id !== attacker.id);
    state = {
      ...state,
      round: 3,
      players: state.players.map((player) => (player.id === attacker.id ? { ...player, hand: [minigun], actionsRemaining: 2 } : player))
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      weaponInstanceId: minigun.instanceId,
      damageByTarget: {
        [targets[0].id]: 4,
        [targets[1].id]: 2
      }
    });

    expect(state.players.every((player) => player.health === 20)).toBe(true);
    expect(state.discardPile.map((card) => card.instanceId)).not.toContain(minigun.instanceId);

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      weaponInstanceId: minigun.instanceId,
      damageByTarget: {
        [targets[0].id]: 3,
        [targets[1].id]: 3,
        [targets[2].id]: 1
      }
    });

    expect(state.players.every((player) => player.health === 20)).toBe(true);
  });

  it("Ambush adds to the Minigun damage pool instead of each target", () => {
    let state = createNewGame(["Ari", "Blake", "Casey", "Devon"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const [ambush, minigun] = instances(["ability_ambush", "weapon_minigun"]);
    const targets = state.players.filter((player) => player.id !== attacker.id);
    state = {
      ...state,
      players: state.players.map((player) => (player.id === attacker.id ? { ...player, hand: [ambush, minigun], actionsRemaining: 2 } : player))
    };

    state = gameReducer(state, { type: "PLAY_ABILITY", playerId: attacker.id, cardInstanceId: ambush.instanceId });
    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      weaponInstanceId: minigun.instanceId,
      damageByTarget: {
        [targets[0].id]: 3,
        [targets[1].id]: 3,
        [targets[2].id]: 3
      }
    });

    expect(state.players.find((player) => player.id === targets[0].id)!.health).toBe(17);
    expect(state.players.find((player) => player.id === targets[1].id)!.health).toBe(17);
    expect(state.players.find((player) => player.id === targets[2].id)!.health).toBe(17);
    expect(state.attackBonuses[attacker.id]).toBeUndefined();
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

  it("can allow defense against Grenade splash damage", () => {
    let state = createNewGame(["Ari", "Blake", "Casey", "Devon"], () => 0, {
      ...defaultGameSettings,
      allowSecondaryDefense: true
    });
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players[1];
    const splashTarget = state.players[2];
    const [grenade, shield] = instances(["weapon_grenade", "defense_shield_plate"]);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, hand: [grenade] }
          : player.id === splashTarget.id
            ? { ...player, hand: [shield] }
            : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: grenade.instanceId
    });
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: target.id });

    expect(state.pendingSecondaryDamage?.defenderId).toBe(splashTarget.id);

    state = gameReducer(state, {
      type: "PLAY_SECONDARY_REACTION",
      defenderId: splashTarget.id,
      reactionCardInstanceId: shield.instanceId
    });

    expect(state.players.find((player) => player.id === target.id)!.health).toBe(16);
    expect(state.players.find((player) => player.id === splashTarget.id)!.health).toBe(20);
    expect(state.discardPile.map((card) => card.instanceId)).toContain(shield.instanceId);
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
    expect(state.players.find((player) => player.id === attacker.id)!.hand).toHaveLength(0);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([smg.instanceId, smoke.instanceId]));
  });
});
