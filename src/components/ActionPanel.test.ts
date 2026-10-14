import { describe, expect, it } from "vitest";
import type { Card } from "../data/cards";
import type { PlayerState } from "../game/types";
import { getHandLimitWarning } from "./ActionPanel";
import { canPlayHealingCard } from "../game/cardTargets";

function player(health: number, actionsRemaining = 2): PlayerState {
  return {
    id: "player_1",
    name: "Ari",
    controller: { type: "human" },
    health,
    hand: [],
    eliminated: false,
    eliminations: 0,
    attackedThisRound: false,
    actedThisRound: false,
    actionsRemaining,
    freeDrawsRemaining: 0
  };
}

const bandage = {
  id: "healing_bandage",
  name: "Bandage",
  type: "healing",
  heal: 3
} as Card;

const painkillers = {
  id: "healing_painkillers",
  name: "Painkillers",
  type: "healing",
  heal: 2,
  draw: 1
} as Card;

describe("healing play availability", () => {
  it("disables healing cards that would do nothing at full health", () => {
    expect(canPlayHealingCard(player(20), bandage, player(20), 20, true)).toBe(false);
  });

  it("allows healing cards with draw effects at full health", () => {
    expect(canPlayHealingCard(player(20), painkillers, player(20), 20, true)).toBe(true);
  });
});

describe("hand limit warning", () => {
  it("warns before end turn whenever a living player is over max hand size", () => {
    const overLimit = { ...player(20, 1), hand: Array.from({ length: 8 }, (_, index) => ({ instanceId: `card_${index}`, definitionId: "weapon_pistol" })) };

    expect(getHandLimitWarning(overLimit, 7)).toBe("Ari has 8 cards. Discard down to 7 before ending turn.");
  });

  it("does not warn eliminated players because their turn should advance", () => {
    const eliminated = {
      ...player(0, 1),
      eliminated: true,
      hand: Array.from({ length: 8 }, (_, index) => ({ instanceId: `card_${index}`, definitionId: "weapon_pistol" }))
    };

    expect(getHandLimitWarning(eliminated, 7)).toBeNull();
  });
});
