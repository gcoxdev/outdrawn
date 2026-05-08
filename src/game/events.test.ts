import { describe, expect, it } from "vitest";
import { eventDeckCards, mainDeckCards } from "../data/cards";
import { defaultGameSettings } from "../data/constants";
import { expandDeck } from "./deck";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";

function main(definitionId: string) {
  const card = expandDeck(mainDeckCards, "event_main").find((candidate) => candidate.definitionId === definitionId);
  if (!card) {
    throw new Error(`Missing ${definitionId}`);
  }
  return card;
}

function event(definitionId: string) {
  const card = expandDeck(eventDeckCards, "event_test").find((candidate) => candidate.definitionId === definitionId);
  if (!card) {
    throw new Error(`Missing ${definitionId}`);
  }
  return card;
}

function endCurrentRound(state = createNewGame(["Ari", "Blake", "Casey"], () => 0)) {
  let next = state;
  const livingCount = next.players.filter((player) => !player.eliminated).length;
  for (let index = 0; index < livingCount; index += 1) {
    next = gameReducer(next, { type: "END_TURN", playerId: next.players[next.currentPlayerIndex].id });
  }
  return next;
}

describe("event cards", () => {
  it("reveals a this-round event when a new round begins", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const highGround = event("event_high_ground");
    state = {
      ...state,
      eventDeck: [highGround]
    };

    state = endCurrentRound(state);

    expect(state.round).toBe(2);
    expect(state.activeEvent?.card.instanceId).toBe(highGround.instanceId);
    expect(state.eventDeck).toHaveLength(0);
    expect(state.log.at(-1)?.message).toContain("Event: High Ground");
  });

  it("mixes event cards into the main deck and disables round-start event reveals", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, {
      ...defaultGameSettings,
      eventHandling: "mixedDeck"
    });
    const highGround = event("event_high_ground");
    state = {
      ...state,
      eventDeck: [highGround]
    };

    state = endCurrentRound(state);

    expect(state.round).toBe(2);
    expect(state.activeEvent).toBeNull();
    expect(state.eventDeck.map((card) => card.instanceId)).toEqual([highGround.instanceId]);
    expect(state.log.at(-1)?.message).toContain("Event: none");
  });

  it("does not deal mixed event cards into starting hands", () => {
    const state = createNewGame(["Ari", "Blake", "Casey"], () => 0, {
      ...defaultGameSettings,
      eventHandling: "mixedDeck",
      startingHandSize: 7
    });

    expect(state.eventDeck).toHaveLength(0);
    expect(state.players.flatMap((player) => player.hand).some((card) => card.definitionId.startsWith("event_"))).toBe(false);
    expect(state.mainDeck.some((card) => card.definitionId.startsWith("event_"))).toBe(true);
  });

  it("resolves a mixed this-round event when it is drawn instead of adding it to hand", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, {
      ...defaultGameSettings,
      eventHandling: "mixedDeck"
    });
    const player = state.players[state.currentPlayerIndex];
    const highGround = event("event_high_ground");
    state = {
      ...state,
      mainDeck: [highGround],
      players: state.players.map((candidate) => (candidate.id === player.id ? { ...candidate, hand: [], actionsRemaining: 2 } : candidate))
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });

    expect(state.activeEvent?.card.instanceId).toBe(highGround.instanceId);
    expect(state.players.find((candidate) => candidate.id === player.id)?.hand).toHaveLength(0);
    expect(state.players.find((candidate) => candidate.id === player.id)?.actionsRemaining).toBe(1);
    expect(state.log.at(-1)?.message).toContain("drew High Ground");
  });

  it("High Ground adds 1 damage to a player's first attack this round", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    const pistol = main("weapon_pistol");
    state = {
      ...state,
      round: 3,
      activeEvent: { card: event("event_high_ground"), timing: "thisRound" },
      players: state.players.map((player) => (player.id === attacker.id ? { ...player, hand: [pistol] } : player))
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: pistol.instanceId
    });

    expect(state.pendingReaction?.baseDamage).toBe(4);
  });

  it("No Cover makes block reactions prevent 1 less damage", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    const sniper = main("weapon_sniper_rifle");
    const shield = main("defense_shield_plate");
    state = {
      ...state,
      round: 3,
      activeEvent: { card: event("event_no_cover"), timing: "thisRound" },
      players: state.players.map((player) =>
        player.id === attacker.id ? { ...player, hand: [sniper] } : player.id === target.id ? { ...player, hand: [shield] } : player
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: sniper.instanceId
    });
    state = gameReducer(state, { type: "PLAY_REACTION", defenderId: target.id, reactionCardInstanceId: shield.instanceId });

    expect(state.players.find((player) => player.id === target.id)!.health).toBe(15);
  });

  it("Low Ammo makes each player discard a weapon or take damage", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const pistol = main("weapon_pistol");
    const lowAmmo = event("event_low_ammo");
    state = {
      ...state,
      eventDeck: [lowAmmo],
      players: state.players.map((player, index) => (index === 0 ? { ...player, hand: [pistol] } : { ...player, hand: [] }))
    };

    state = endCurrentRound(state);

    expect(state.players[0].hand).toHaveLength(0);
    expect(state.players[0].health).toBe(20);
    expect(state.players[1].health).toBe(17);
    expect(state.players[2].health).toBe(17);
    expect(state.discardPile.map((card) => card.instanceId)).toContain(pistol.instanceId);
    expect(state.eventDiscardPile.map((card) => card.instanceId)).toContain(lowAmmo.instanceId);
    expect(state.log.map((entry) => entry.message)).toEqual(expect.arrayContaining([
      "Blake took 3 Low Ammo damage.",
      "Casey took 3 Low Ammo damage."
    ]));
  });

  it("Critical Condition damages low-health players when revealed", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    state = {
      ...state,
      eventDeck: [event("event_critical_condition")],
      players: state.players.map((player, index) => ({ ...player, health: index === 0 ? 11 : index === 1 ? 10 : 4 }))
    };

    state = endCurrentRound(state);

    expect(state.players.map((player) => player.health)).toEqual([11, 9, 2]);
    expect(state.log.map((entry) => entry.message)).toEqual(expect.arrayContaining([
      "Blake took 1 Critical Condition damage.",
      "Casey took 2 Critical Condition damage."
    ]));
  });

  it("Bounty draws a card for attackers who damage the highest-health player", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const attacker = state.players[state.currentPlayerIndex];
    const target = state.players.find((player) => player.id !== attacker.id)!;
    const pistol = main("weapon_pistol");
    const reward = main("weapon_knife");
    state = {
      ...state,
      round: 3,
      activeEvent: { card: event("event_bounty"), timing: "thisRound" },
      mainDeck: [reward],
      players: state.players.map((player) =>
        player.id === attacker.id
          ? { ...player, health: 14, hand: [pistol] }
          : player.id === target.id
            ? { ...player, health: 20 }
            : { ...player, health: 12 }
      )
    };

    state = gameReducer(state, {
      type: "ATTACK",
      attackerId: attacker.id,
      targetPlayerId: target.id,
      weaponInstanceId: pistol.instanceId
    });
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: target.id });

    expect(state.players.find((player) => player.id === attacker.id)!.hand.map((card) => card.instanceId)).toEqual([reward.instanceId]);
    expect(state.mainDeck).toHaveLength(0);
  });

  it("Pressure Zone damages players who did not attack when the event expires", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    state = {
      ...state,
      activeEvent: { card: event("event_pressure_zone"), timing: "thisRound" },
      players: state.players.map((player, index) => ({ ...player, attackedThisRound: index === 0 }))
    };

    state = endCurrentRound(state);

    expect(state.players.map((player) => player.health)).toEqual([20, 19, 19]);
  });

  it("collapse damage starts at the end of round 3", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    state = {
      ...state,
      round: 3
    };

    state = endCurrentRound(state);

    expect(state.players.map((player) => player.health)).toEqual([19, 19, 19]);
  });

  it("simultaneous collapse elimination breaks ties by pre-collapse health then hand size", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const [knife] = [main("weapon_knife")];
    state = {
      ...state,
      round: 8,
      players: state.players.map((player, index) => ({
        ...player,
        health: 2,
        hand: index === 1 ? [knife] : [],
        actedThisRound: true
      }))
    };

    state = gameReducer(state, { type: "END_TURN", playerId: state.players[state.currentPlayerIndex].id });

    expect(state.phase).toBe("gameOver");
    expect(state.winnerId).toBe("player_2");
  });

  it("stops resolving end-round effects once collapse produces a winner", () => {
    let state = createNewGame(["Ari", "Blake", "Devon"], () => 0);
    state = {
      ...state,
      round: 10,
      currentPlayerIndex: 0,
      eventDeck: [event("event_critical_condition")],
      players: state.players.map((player, index) => ({
        ...player,
        health: index === 0 ? 2 : index === 2 ? 3 : 0,
        eliminated: index === 1,
        actedThisRound: index === 2
      }))
    };

    state = gameReducer(state, { type: "END_TURN", playerId: "player_1" });

    expect(state.phase).toBe("gameOver");
    expect(state.winnerId).toBe("player_3");
    expect(state.players.map((player) => player.health)).toEqual([0, 0, 1]);
    expect(state.log.map((entry) => entry.message)).toContain("Devon is the last hand standing.");
    expect(state.log.map((entry) => entry.message)).not.toContain("Devon took 2 Critical Condition damage.");
  });

  it("simultaneous elimination tiebreaker favors prior eliminations first", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    state = {
      ...state,
      round: 8,
      players: state.players.map((player, index) => ({
        ...player,
        health: 2,
        eliminations: index === 2 ? 1 : 0,
        hand: index === 1 ? [main("weapon_knife")] : [],
        actedThisRound: true
      }))
    };

    state = gameReducer(state, { type: "END_TURN", playerId: state.players[state.currentPlayerIndex].id });

    expect(state.phase).toBe("gameOver");
    expect(state.winnerId).toBe("player_3");
  });

  it("Supply Drop reveals three cards and lets players claim or pass in low-health order", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const supplyDrop = event("event_supply_drop");
    const pistol = main("weapon_pistol");
    const shield = main("defense_shield_plate");
    const search = main("ability_search");
    state = {
      ...state,
      eventDeck: [supplyDrop],
      mainDeck: [pistol, shield, search],
      players: state.players.map((player, index) => ({ ...player, health: [12, 8, 16][index], hand: [] }))
    };

    state = endCurrentRound(state);
    expect(state.pendingSupplyDrop?.playerOrder).toEqual(["player_2", "player_1", "player_3"]);
    expect(state.pendingSupplyDrop?.revealedCards.map((card) => card.instanceId)).toEqual([pistol.instanceId, shield.instanceId, search.instanceId]);

    state = gameReducer(state, { type: "RESOLVE_SUPPLY_DROP_PICK", playerId: "player_2", cardInstanceId: shield.instanceId });
    state = gameReducer(state, { type: "RESOLVE_SUPPLY_DROP_PICK", playerId: "player_1", cardInstanceId: null });
    state = gameReducer(state, { type: "RESOLVE_SUPPLY_DROP_PICK", playerId: "player_3", cardInstanceId: pistol.instanceId });

    expect(state.pendingSupplyDrop).toBeNull();
    expect(state.players.find((player) => player.id === "player_2")!.hand.map((card) => card.instanceId)).toEqual([shield.instanceId]);
    expect(state.players.find((player) => player.id === "player_3")!.hand.map((card) => card.instanceId)).toEqual([pistol.instanceId]);
    expect(state.discardPile.map((card) => card.instanceId)).toContain(search.instanceId);
  });

  it("Supply Drop forces immediate discard-down when a player claims over max hand size", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const supplyDrop = event("event_supply_drop");
    const reward = main("weapon_pistol");
    const fillerCards = [
      main("weapon_knife"),
      main("weapon_knife"),
      main("weapon_knife"),
      main("weapon_knife"),
      main("weapon_knife"),
      main("weapon_knife"),
      main("weapon_knife")
    ];
    state = {
      ...state,
      eventDeck: [supplyDrop],
      mainDeck: [reward],
      players: state.players.map((player, index) => ({ ...player, health: [8, 12, 16][index], hand: index === 0 ? fillerCards : [] }))
    };

    state = endCurrentRound(state);
    state = gameReducer(state, { type: "RESOLVE_SUPPLY_DROP_PICK", playerId: "player_1", cardInstanceId: reward.instanceId });

    expect(state.pendingDiscard?.playerId).toBe("player_1");
    expect(state.pendingDiscard?.count).toBe(1);
    expect(state.pendingDiscard?.reason).toBe("hand limit");
  });

  it("personal Supply Drop from a mixed event only offers cards to the drawing player", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, {
      ...defaultGameSettings,
      eventHandling: "mixedDeck",
      personalSupplyDrops: true
    });
    const player = state.players[state.currentPlayerIndex];
    const supplyDrop = event("event_supply_drop");
    const pistol = main("weapon_pistol");
    const shield = main("defense_shield_plate");
    const search = main("ability_search");
    state = {
      ...state,
      mainDeck: [supplyDrop, pistol, shield, search],
      players: state.players.map((candidate) => (candidate.id === player.id ? { ...candidate, hand: [], actionsRemaining: 2 } : candidate))
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });

    expect(state.pendingSupplyDrop?.playerOrder).toEqual([player.id]);
    expect(state.pendingSupplyDrop?.revealedCards.map((card) => card.instanceId)).toEqual([pistol.instanceId, shield.instanceId, search.instanceId]);

    state = gameReducer(state, { type: "RESOLVE_SUPPLY_DROP_PICK", playerId: player.id, cardInstanceId: shield.instanceId });

    expect(state.pendingSupplyDrop).toBeNull();
    expect(state.players.find((candidate) => candidate.id === player.id)?.hand.map((card) => card.instanceId)).toEqual([shield.instanceId]);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([pistol.instanceId, search.instanceId]));
    expect(state.eventDiscardPile.map((card) => card.instanceId)).toContain(supplyDrop.instanceId);
  });

  it("personal Supply Drop discards overflow instead of prompting discard-down", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, {
      ...defaultGameSettings,
      eventHandling: "mixedDeck",
      personalSupplyDrops: true,
      maxHandSize: 1
    });
    const player = state.players[state.currentPlayerIndex];
    const supplyDrop = event("event_supply_drop");
    const existing = main("weapon_knife");
    const pistol = main("weapon_pistol");
    state = {
      ...state,
      mainDeck: [supplyDrop, pistol],
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, hand: [existing], actionsRemaining: 2 } : candidate
      )
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });
    state = gameReducer(state, { type: "RESOLVE_SUPPLY_DROP_PICK", playerId: player.id, cardInstanceId: pistol.instanceId });

    expect(state.pendingDiscard).toBeNull();
    expect(state.players.find((candidate) => candidate.id === player.id)?.hand.map((card) => card.instanceId)).toEqual([existing.instanceId]);
    expect(state.discardPile.map((card) => card.instanceId)).toContain(pistol.instanceId);
  });

  it("Black Market lets a player discard two cards and choose one revealed deck card", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const firstDiscard = main("weapon_pistol");
    const secondDiscard = main("weapon_knife");
    const pistol = main("weapon_pistol");
    const shotgun = main("weapon_shotgun");
    const shield = main("defense_shield_plate");
    state = {
      ...state,
      activeEvent: { card: event("event_black_market"), timing: "thisRound" },
      mainDeck: [pistol, shotgun, shield],
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, hand: [firstDiscard, secondDiscard], actionsRemaining: 2 } : candidate
      )
    };

    state = gameReducer(state, {
      type: "START_BLACK_MARKET",
      playerId: player.id,
      cardInstanceIds: [firstDiscard.instanceId, secondDiscard.instanceId]
    });
    expect(state.pendingMarketSearch?.playerId).toBe(player.id);
    expect(state.pendingMarketSearch?.cards.map((card) => card.instanceId)).toEqual([pistol.instanceId, shotgun.instanceId, shield.instanceId]);

    state = gameReducer(state, {
      type: "RESOLVE_MARKET_SEARCH",
      playerId: player.id,
      keepCardInstanceIds: [shotgun.instanceId]
    });

    const updatedPlayer = state.players.find((candidate) => candidate.id === player.id)!;
    expect(updatedPlayer.hand.map((card) => card.instanceId)).toEqual([shotgun.instanceId]);
    expect(updatedPlayer.actionsRemaining).toBe(1);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(
      expect.arrayContaining([firstDiscard.instanceId, secondDiscard.instanceId, pistol.instanceId, shield.instanceId])
    );
  });

  it("Black Market bigger preset keeps two revealed cards", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, { ...defaultGameSettings, blackMarketPreset: "bigger" });
    const player = state.players[state.currentPlayerIndex];
    const firstDiscard = main("weapon_pistol");
    const secondDiscard = main("weapon_knife");
    const revealed = [main("weapon_pistol"), main("weapon_shotgun"), main("defense_shield_plate"), main("weapon_smg"), main("healing_bandage")];
    state = {
      ...state,
      activeEvent: { card: event("event_black_market"), timing: "thisRound" },
      mainDeck: revealed,
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, hand: [firstDiscard, secondDiscard], actionsRemaining: 2 } : candidate
      )
    };

    state = gameReducer(state, {
      type: "START_BLACK_MARKET",
      playerId: player.id,
      cardInstanceIds: [firstDiscard.instanceId, secondDiscard.instanceId]
    });

    expect(state.pendingMarketSearch?.keepCount).toBe(2);
    expect(state.pendingMarketSearch?.cards).toHaveLength(5);

    state = gameReducer(state, {
      type: "RESOLVE_MARKET_SEARCH",
      playerId: player.id,
      keepCardInstanceIds: [revealed[1].instanceId, revealed[3].instanceId]
    });

    const updatedPlayer = state.players.find((candidate) => candidate.id === player.id)!;
    expect(updatedPlayer.hand.map((card) => card.instanceId)).toEqual([revealed[1].instanceId, revealed[3].instanceId]);
    expect(updatedPlayer.actionsRemaining).toBe(1);
  });

  it("Black Market health-pay preset pays health instead of cards", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0, { ...defaultGameSettings, blackMarketPreset: "healthPay" });
    const player = state.players[state.currentPlayerIndex];
    const pistol = main("weapon_pistol");
    const shotgun = main("weapon_shotgun");
    const shield = main("defense_shield_plate");
    state = {
      ...state,
      activeEvent: { card: event("event_black_market"), timing: "thisRound" },
      mainDeck: [pistol, shotgun, shield],
      players: state.players.map((candidate) => (candidate.id === player.id ? { ...candidate, hand: [], actionsRemaining: 2 } : candidate))
    };

    state = gameReducer(state, {
      type: "START_BLACK_MARKET",
      playerId: player.id,
      cardInstanceIds: []
    });

    const payingPlayer = state.players.find((candidate) => candidate.id === player.id)!;
    expect(payingPlayer.health).toBe(18);
    expect(payingPlayer.actionsRemaining).toBe(1);
    expect(state.pendingMarketSearch?.keepCount).toBe(1);
  });
});
