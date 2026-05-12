import { describe, expect, it } from "vitest";
import type { GameState, PlayerState } from "../game/types";
import { canRevealTableHand, canToggleHandPrivacy, getHandDiscardRequirement } from "./GameTable";

function player(name: string, controller: PlayerState["controller"]): GameState["players"][number] {
  return {
    id: name.toLowerCase(),
    name,
    controller,
    health: 10,
    hand: [],
    eliminated: false,
    eliminations: 0,
    attackedThisRound: false,
    actedThisRound: false,
    actionsRemaining: 2,
    freeDrawsRemaining: 0
  };
}

describe("game table team hand visibility", () => {
  const teamHuman = { ...player("Ari", { type: "human" }), id: "player_1", teamId: "team_a" as const };
  const teamComputer = { ...player("Casey", { type: "computer", strategy: "competent" }), id: "player_3", teamId: "team_a" as const };
  const opponentComputer = { ...player("Blake", { type: "computer", strategy: "competent" }), id: "player_2", teamId: "team_b" as const };
  const teamState = { players: [teamHuman, opponentComputer, teamComputer], phase: "action" } as GameState;

  it("reveals the only human player's computer teammate", () => {
    expect(canRevealTableHand(teamState, teamComputer, teamComputer, false)).toBe(true);
  });

  it("keeps opposing computer team hands face down", () => {
    expect(canRevealTableHand(teamState, opponentComputer, opponentComputer, false)).toBe(false);
  });
});

describe("game table hand privacy toggle", () => {
  const human = { ...player("Ari", { type: "human" }), id: "player_1", teamId: "team_a" as const };
  const computer = { ...player("Blake", { type: "computer", strategy: "competent" }), id: "player_2", teamId: "team_b" as const };
  const teammateComputer = { ...player("Casey", { type: "computer", strategy: "competent" }), id: "player_3", teamId: "team_a" as const };

  it("allows visible human and teammate hands to be hidden", () => {
    const state = { players: [human, computer, teammateComputer] } as GameState;

    expect(canToggleHandPrivacy(state, human, human, false)).toBe(true);
    expect(canToggleHandPrivacy(state, teammateComputer, teammateComputer, false)).toBe(true);
    expect(canToggleHandPrivacy(state, teammateComputer, human, false)).toBe(true);
    expect(canToggleHandPrivacy(state, human, computer, false)).toBe(false);
    expect(canToggleHandPrivacy(state, computer, computer, false)).toBe(false);
  });

  it("does not show the toggle while a pass-device gate is active or when no humans remain", () => {
    const computerOnlyState = { players: [computer, { ...computer, id: "player_3", name: "Casey" }] } as GameState;

    expect(canToggleHandPrivacy({ players: [human, computer] } as GameState, human, human, true)).toBe(false);
    expect(canToggleHandPrivacy(computerOnlyState, computerOnlyState.players[0], computerOnlyState.players[0], false)).toBe(false);
  });
});

describe("game table hand discard selection", () => {
  const firstCard = { instanceId: "card_1", definitionId: "weapon_pistol" };
  const secondCard = { instanceId: "card_2", definitionId: "defense_dodge" };
  const human = { ...player("Ari", { type: "human" }), id: "player_1", hand: [firstCard, secondCard] };

  it("uses the displayed hand for pending discard choices", () => {
    const state = {
      players: [human],
      pendingDiscard: {
        sourcePlayerId: "player_2",
        playerId: human.id,
        count: 1,
        reason: "Sabotage",
        allowedCardInstanceIds: [secondCard.instanceId]
      },
      pendingBlackMarket: null,
      settings: { maxHandSize: 7, blackMarketPreset: "standard" }
    } as GameState;

    expect(getHandDiscardRequirement(state, human, human)).toEqual({
      type: "pendingDiscard",
      playerId: human.id,
      count: 1,
      allowedCardInstanceIds: [secondCard.instanceId],
      reason: "Sabotage"
    });
  });

  it("uses the displayed hand for Black Market discard costs", () => {
    const state = {
      players: [human],
      pendingDiscard: null,
      pendingBlackMarket: {
        card: { instanceId: "market", definitionId: "event_black_market" },
        playerId: human.id
      },
      settings: { maxHandSize: 7, blackMarketPreset: "standard" }
    } as GameState;

    expect(getHandDiscardRequirement(state, human, human)).toMatchObject({
      type: "blackMarket",
      playerId: human.id,
      count: 2
    });
  });

  it("uses the displayed hand for Intimidate attack-cost discards", () => {
    const state = {
      players: [human],
      pendingDiscard: null,
      pendingBlackMarket: null,
      pendingAttackCost: {
        attackerId: human.id,
        targetPlayerId: "player_2",
        weaponInstanceId: firstCard.instanceId,
        sourcePlayerId: "player_2"
      },
      settings: { maxHandSize: 7, blackMarketPreset: "standard" }
    } as GameState;

    expect(getHandDiscardRequirement(state, human, human)).toEqual({
      type: "attackCost",
      playerId: human.id,
      count: 1,
      allowedCardInstanceIds: [secondCard.instanceId],
      reason: "Intimidate"
    });
  });

  it("only requires hand-limit discards after actions are exhausted", () => {
    const overLimitHuman = {
      ...human,
      actionsRemaining: 1,
      hand: [
        firstCard,
        secondCard,
        { instanceId: "card_3", definitionId: "weapon_knife" },
        { instanceId: "card_4", definitionId: "weapon_knife" },
        { instanceId: "card_5", definitionId: "weapon_knife" },
        { instanceId: "card_6", definitionId: "weapon_knife" },
        { instanceId: "card_7", definitionId: "weapon_knife" },
        { instanceId: "card_8", definitionId: "weapon_knife" }
      ]
    };
    const state = {
      players: [overLimitHuman],
      pendingDiscard: null,
      pendingBlackMarket: null,
      pendingAttackCost: null,
      settings: { maxHandSize: 7, blackMarketPreset: "standard" }
    } as GameState;

    expect(getHandDiscardRequirement(state, overLimitHuman, overLimitHuman)).toBeNull();
    expect(getHandDiscardRequirement(state, { ...overLimitHuman, actionsRemaining: 0 }, { ...overLimitHuman, actionsRemaining: 0 })).toEqual({
      type: "handLimit",
      playerId: overLimitHuman.id,
      count: 1,
      reason: "hand limit"
    });
  });
});
