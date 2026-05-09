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
  it("always mixes event cards into the main deck after starting hands", () => {
    const state = createNewGame(["Ari", "Blake", "Casey"], () => 0, {
      ...defaultGameSettings,
      startingHandSize: 7
    });

    expect(state.eventDeck).toHaveLength(0);
    expect(state.players.flatMap((player) => player.hand).some((card) => card.definitionId.startsWith("event_"))).toBe(false);
    expect(state.mainDeck.some((card) => card.definitionId.startsWith("event_"))).toBe(true);
  });

  it("resolves an event when it is drawn instead of adding it to hand", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const pressureZone = event("event_pressure_zone");
    state = {
      ...state,
      mainDeck: [pressureZone],
      players: state.players.map((candidate) => (candidate.id === player.id ? { ...candidate, hand: [], actionsRemaining: 2 } : candidate))
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });

    expect(state.activeEvent).toBeNull();
    expect(state.eventDiscardPile.map((card) => card.instanceId)).toContain(pressureZone.instanceId);
    expect(state.players.find((candidate) => candidate.id === player.id)?.hand).toHaveLength(0);
    expect(state.players.map((candidate) => candidate.health)).toEqual([19, 19, 19]);
    expect(state.players.find((candidate) => candidate.id === player.id)?.actionsRemaining).toBe(2);
    expect(state.log.at(-1)?.message).toContain("drew Pressure Zone");
  });

  it("does not leave an immediate event active when the drawing player draws again", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const pressureZone = event("event_pressure_zone");
    const pistol = main("weapon_pistol");
    state = {
      ...state,
      mainDeck: [pressureZone, pistol],
      players: state.players.map((candidate) => (candidate.id === player.id ? { ...candidate, hand: [], actionsRemaining: 2 } : candidate))
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });
    expect(state.activeEvent).toBeNull();

    state = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });

    expect(state.activeEvent).toBeNull();
    expect(state.eventDiscardPile.map((card) => card.instanceId)).toContain(pressureZone.instanceId);
    expect(state.players.find((candidate) => candidate.id === player.id)?.hand.map((card) => card.instanceId)).toEqual([pistol.instanceId]);
  });

  it("auto-resolves event cards revealed by Search instead of offering them as choices", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const search = main("ability_search");
    const pressureZone = event("event_pressure_zone");
    const pistol = main("weapon_pistol");
    const shield = main("defense_shield_plate");
    const knife = main("weapon_knife");
    state = {
      ...state,
      mainDeck: [pressureZone, pistol, shield, knife],
      players: state.players.map((candidate) => (candidate.id === player.id ? { ...candidate, hand: [search], actionsRemaining: 2 } : candidate))
    };

    state = gameReducer(state, { type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: search.instanceId });

    expect(state.activeEvent).toBeNull();
    expect(state.eventDiscardPile.map((card) => card.instanceId)).toContain(pressureZone.instanceId);
    expect(state.players.map((candidate) => candidate.health)).toEqual([19, 19, 19]);
    expect(state.pendingSearch?.cards.map((card) => card.instanceId)).toEqual([pistol.instanceId, shield.instanceId, knife.instanceId]);
  });

  it("High Ground immediately draws 1 card for each living player", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const pistol = main("weapon_pistol");
    const knife = main("weapon_knife");
    const shield = main("defense_shield_plate");
    state = {
      ...state,
      mainDeck: [event("event_high_ground"), pistol, knife, shield],
      players: state.players.map((player) => ({ ...player, hand: [] }))
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: state.players[state.currentPlayerIndex].id });

    expect(state.players.map((player) => player.hand.map((card) => card.instanceId))).toEqual([
      [pistol.instanceId],
      [knife.instanceId],
      [shield.instanceId]
    ]);
  });

  it("No Cover makes each player discard defense or take damage", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const shield = main("defense_shield_plate");
    const dodge = main("defense_dodge");
    state = {
      ...state,
      mainDeck: [event("event_no_cover")],
      players: state.players.map((player, index) => ({ ...player, hand: index === 0 ? [shield] : index === 1 ? [dodge] : [] }))
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: state.players[state.currentPlayerIndex].id });

    expect(state.players.map((player) => player.health)).toEqual([20, 20, 18]);
    expect(state.players[0].hand).toHaveLength(0);
    expect(state.players[1].hand).toHaveLength(0);
    expect(state.discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([shield.instanceId, dodge.instanceId]));
  });

  it("Low Ammo makes each player discard a weapon or take damage", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const pistol = main("weapon_pistol");
    const lowAmmo = event("event_low_ammo");
    state = {
      ...state,
      mainDeck: [lowAmmo],
      players: state.players.map((player, index) => (index === 0 ? { ...player, hand: [pistol] } : { ...player, hand: [] }))
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: state.players[state.currentPlayerIndex].id });

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
      mainDeck: [event("event_critical_condition")],
      players: state.players.map((player, index) => ({ ...player, health: index === 0 ? 11 : index === 1 ? 10 : 4 }))
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: state.players[state.currentPlayerIndex].id });

    expect(state.players.map((player) => player.health)).toEqual([11, 9, 2]);
    expect(state.log.map((entry) => entry.message)).toEqual(expect.arrayContaining([
      "Blake took 1 Critical Condition damage.",
      "Casey took 2 Critical Condition damage."
    ]));
  });

  it("Bounty immediately damages the highest-health player", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    state = {
      ...state,
      mainDeck: [event("event_bounty")],
      players: state.players.map((player, index) => ({ ...player, health: [14, 20, 12][index] }))
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: state.players[state.currentPlayerIndex].id });

    expect(state.players.map((player) => player.health)).toEqual([14, 18, 12]);
  });

  it("Pressure Zone immediately damages every living player", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    state = {
      ...state,
      mainDeck: [event("event_pressure_zone")]
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: state.players[state.currentPlayerIndex].id });

    expect(state.players.map((player) => player.health)).toEqual([19, 19, 19]);
  });

  it("collapse damage starts at the end of round 3", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    state = {
      ...state,
      round: 3,
      eventDeck: []
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
    expect(state.log.map((entry) => entry.message)).toContain("Devon wins.");
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

  it("Supply Drop draws three cards into the drawing player's hand", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const supplyDrop = event("event_supply_drop");
    const pistol = main("weapon_pistol");
    const shield = main("defense_shield_plate");
    const search = main("ability_search");
    state = {
      ...state,
      mainDeck: [supplyDrop, pistol, shield, search],
      players: state.players.map((candidate) => (candidate.id === player.id ? { ...candidate, hand: [] } : candidate))
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });

    expect(state.pendingSupplyDrop).toBeNull();
    expect(state.players.find((candidate) => candidate.id === player.id)?.hand.map((card) => card.instanceId)).toEqual([
      pistol.instanceId,
      shield.instanceId,
      search.instanceId
    ]);
    expect(state.eventDiscardPile.map((card) => card.instanceId)).toContain(supplyDrop.instanceId);
  });

  it("Supply Drop forces discard-down when drawing over max hand size", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const supplyDrop = event("event_supply_drop");
    const rewards = [main("weapon_pistol"), main("defense_shield_plate"), main("ability_search")];
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
      mainDeck: [supplyDrop, ...rewards],
      players: state.players.map((candidate) => (candidate.id === player.id ? { ...candidate, hand: fillerCards } : candidate))
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });

    expect(state.pendingDiscard?.playerId).toBe(player.id);
    expect(state.pendingDiscard?.count).toBe(3);
    expect(state.pendingDiscard?.reason).toBe("hand limit");
  });

  it("auto-resolves event cards drawn by Supply Drop", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const supplyDrop = event("event_supply_drop");
    const pressureZone = event("event_pressure_zone");
    const pistol = main("weapon_pistol");
    const shield = main("defense_shield_plate");
    const knife = main("weapon_knife");
    state = {
      ...state,
      mainDeck: [supplyDrop, pressureZone, pistol, shield, knife],
      players: state.players.map((candidate) => (candidate.id === player.id ? { ...candidate, hand: [], actionsRemaining: 2 } : candidate))
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });

    expect(state.activeEvent).toBeNull();
    expect(state.eventDiscardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([supplyDrop.instanceId, pressureZone.instanceId]));
    expect(state.players.map((candidate) => candidate.health)).toEqual([19, 19, 19]);
    expect(state.players.find((candidate) => candidate.id === player.id)?.hand.map((card) => card.instanceId)).toEqual([
      pistol.instanceId,
      shield.instanceId,
      knife.instanceId
    ]);
  });

  it("Black Market opens the configured exchange when drawn", () => {
    let state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    const player = state.players[state.currentPlayerIndex];
    const blackMarket = event("event_black_market");
    state = {
      ...state,
      mainDeck: [blackMarket],
      players: state.players.map((candidate) => (candidate.id === player.id ? { ...candidate, hand: [], actionsRemaining: 2 } : candidate))
    };

    state = gameReducer(state, { type: "DRAW_CARD", playerId: player.id });

    expect(state.activeEvent?.card.definitionId).toBe("event_black_market");
    expect(state.players.find((candidate) => candidate.id === player.id)?.actionsRemaining).toBe(2);
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
