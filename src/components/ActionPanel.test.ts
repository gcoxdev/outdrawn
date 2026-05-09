import { describe, expect, it } from "vitest";
import type { Card } from "../data/cards";
import type { PlayerState } from "../game/types";
import { canPlayHealingCard } from "./ActionPanel";

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
    actionsRemaining
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
