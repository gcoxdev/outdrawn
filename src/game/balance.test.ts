import { describe, expect, it } from "vitest";
import { mainDeckCards } from "../data/cards";
import { getDeckBalance } from "./simulator";

function totalDamageSupport() {
  return mainDeckCards
    .filter((card) => card.id === "ability_ambush" || card.id === "ability_mark_target")
    .reduce((total, card) => total + (card.damage ?? 0) * card.count, 0);
}

function estimatedSurvivalValue() {
  return mainDeckCards.reduce((total, card) => {
    if (card.type === "healing") {
      return total + (card.heal ?? 0) * card.count;
    }

    if (card.id === "defense_dodge" || card.id === "defense_smoke_bomb") {
      return total + 4 * card.count;
    }

    if (card.id === "defense_backfire") {
      return total + 6 * card.count;
    }

    if (card.id === "defense_shield_plate") {
      return total + 3 * card.count;
    }

    if (card.id === "defense_revive") {
      return total + 5 * card.count;
    }

    if (card.type === "defense") {
      return total + (card.block ?? 0) * card.count;
    }

    return total;
  }, 0);
}

describe("coarse starter deck composition", () => {
  it("counts each SMG as 4 damage in the report and guardrail", () => {
    // Current deck: 152 pressure from other weapons, plus three 4-damage SMGs.
    // SMG's catalog damage is already the total of its two 2-damage hits.
    expect(getDeckBalance().weaponDamagePotential).toBe(152 + 3 * 4);
  });
  it("leans toward damage without making survival cards irrelevant", () => {
    const pressure = getDeckBalance().weaponDamagePotential + totalDamageSupport();
    const survival = estimatedSurvivalValue();
    const weaponCount = mainDeckCards.filter((card) => card.type === "weapon").reduce((total, card) => total + card.count, 0);
    const survivalCount = mainDeckCards
      .filter((card) => card.type === "defense" || card.type === "healing")
      .reduce((total, card) => total + card.count, 0);

    expect(pressure / survival).toBeGreaterThanOrEqual(1.45);
    expect(pressure / survival).toBeLessThanOrEqual(1.9);
    expect(weaponCount).toBeGreaterThan(survivalCount);
  });
});
