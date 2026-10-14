import { describe, expect, it } from "vitest";
import { defaultGameSettings } from "../data/constants";
import { acceptsDecisionAction, getPendingDecision } from "./decisions";
import { gameReducer } from "./reducer";
import { getDecisionPlayerId, canPlayerEndTurn } from "./rules";
import { createNewGame } from "./setup";
import { chooseAutomatedAction, getBotObservation } from "./simulator";
import type { CardInstance, GameState, StrategyLevel } from "./types";

const card = (id: string, instanceId = id): CardInstance => ({ definitionId: id, instanceId });
const strategies: StrategyLevel[] = ["beginner", "novice", "competent", "expert", "master"];

function hiddenAlternative(state: GameState) {
  const actor = getDecisionPlayerId(state);
  return { ...state,
    players: state.players.map(p => p.id === actor ? p : { ...p, hand: p.hand.map(c => ({ ...c, definitionId: "defense_dodge" })) }),
    deckRandomState: 987654321,
    mainDeck: state.mainDeck.map(c => ({ ...c, definitionId: "healing_bandage" })),
    log: state.log.map(entry => ({ ...entry, message: "Secret information changed" }))
  };
}

describe("bot information boundaries", () => {
  it.each(strategies)("%s ignores opponents' card identities and deck contents", strategy => {
    for (const ownCard of ["weapon_pistol", "weapon_minigun", "ability_disarm", "ability_steal"]) {
      const base = createNewGame(["A", "B", "C"], () => 0);
      const state = { ...base, players: base.players.map((p, i) => ({ ...p, hand: i === 0 ? [card(ownCard)] : [card("weapon_sniper_rifle", `hidden_${i}`)] })) };
      for (const randomValue of [0.1, 0.6, 0.9]) {
        expect(chooseAutomatedAction(state, strategy, () => randomValue))
          .toEqual(chooseAutomatedAction(hiddenAlternative(state), strategy, () => randomValue));
      }
      const stealing = { ...state, pendingSteal: { playerId: "player_1", targetPlayerId: "player_2" } };
      expect(chooseAutomatedAction(stealing, strategy, () => 0.6))
        .toEqual(chooseAutomatedAction(hiddenAlternative(stealing), strategy, () => 0.6));
    }
  });

  it("keeps the actual defender's cards available while hiding the attacker", () => {
    const base = createNewGame(["A", "B", "C"], () => 0);
    const state: GameState = { ...base, pendingReaction: { attackerId: "player_1", defenderId: "player_2", weapon: card("weapon_pistol"), baseDamage: 3 } };
    const view = getBotObservation(state);
    expect(view.players[1].hand).toEqual(state.players[1].hand);
    expect(view.players[0].hand.every(c => c.definitionId === "unknown")).toBe(true);
    expect(view.mainDeck.every(c => c.definitionId === "unknown" && /^hidden_\d+$/.test(c.instanceId))).toBe(true);
    expect(view.log).toEqual([]);
    expect(view.deckRandomState).toBeUndefined();
    expect(state.players[0].hand.every(c => c.definitionId !== "unknown")).toBe(true);
  });
});

describe("pending decision priority", () => {
  it("announces events before resolving their choice and keeps the real choice owner", () => {
    const state: GameState = { ...createNewGame(["A", "B", "C"], () => 0),
      pendingEventDialog: { playerId: "player_1", card: card("event_low_ammo") },
      pendingDiscard: { playerId: "player_2", sourcePlayerId: "player_1", count: 1, reason: "Low Ammo" }
    };
    expect(getPendingDecision(state)?.kind).toBe("event");
    expect(getDecisionPlayerId(state)).toBe("player_2");
    const discard = { type: "RESOLVE_PENDING_DISCARD" as const, playerId: "player_2", cardInstanceIds: [state.players[1].hand[0].instanceId] };
    expect(gameReducer(state, discard)).toBe(state);
    const acknowledged = gameReducer(state, { type: "ACKNOWLEDGE_EVENT_DIALOG" });
    expect(getPendingDecision(acknowledged)?.kind).toBe("discard");
    expect(acceptsDecisionAction(acknowledged, discard)).toBe(true);
  });

  it("cannot bypass a Black Market card choice by passing the retained offer", () => {
    const state: GameState = { ...createNewGame(["A", "B", "C"], () => 0),
      pendingBlackMarket: { playerId: "player_2", card: card("event_black_market") },
      pendingMarketSearch: { playerId: "player_2", cards: [card("weapon_pistol")], keepCount: 1 }
    };
    expect(getPendingDecision(state)?.kind).toBe("marketSearch");
    expect(getDecisionPlayerId(state)).toBe("player_2");
    expect(chooseAutomatedAction(state, "master").type).toBe("RESOLVE_MARKET_SEARCH");
    expect(gameReducer(state, { type: "PASS_BLACK_MARKET", playerId: "player_2" })).toBe(state);
  });

  it("blocks turn changes during automatic continuations without inventing a user choice", () => {
    const state: GameState = { ...createNewGame(["A", "B", "C"], () => 0),
      drawContinuations: [{ playerId: "player_1", cards: [], remaining: 2, destination: "hand", replaceEvents: true }]
    };
    expect(getPendingDecision(state)).toBeNull();
    expect(canPlayerEndTurn(state, "player_1")).toBe(false);
  });
});

it("bounds snapshot history and releases it immediately when disabled", () => {
  let state = createNewGame(["A", "B", "C"], () => 0, { ...defaultGameSettings, debugHandSnapshots: true });
  for (let i = 0; i < 120; i++) {
    state = { ...state, players: state.players.map((p, index) => index === state.currentPlayerIndex ? { ...p, actionsRemaining: 2 } : p) };
    state = gameReducer(state, { type: "PASS_ACTION", playerId: "player_1" });
  }
  expect(state.log.length).toBe(121);
  expect(state.log.filter(entry => entry.debugHandSnapshots.length)).toHaveLength(50);
  state = gameReducer(state, { type: "UPDATE_SETTINGS", settings: { ...state.settings, debugHandSnapshots: false } });
  expect(state.log.every(entry => !entry.debugHandSnapshots.length && !entry.handSnapshots.length)).toBe(true);
  state = gameReducer(state, { type: "UPDATE_SETTINGS", settings: { ...state.settings, debugHandSnapshots: true } });
  expect(state.log.every(entry => !entry.debugHandSnapshots.length)).toBe(true);
});
