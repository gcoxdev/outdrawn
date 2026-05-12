import { describe, expect, it } from "vitest";
import { mainDeckCards } from "../data/cards";

function totalWeaponDamage() {
  return mainDeckCards
    .filter((card) => card.type === "weapon")
    .reduce((total, card) => total + estimatedWeaponPressure(card) * card.count, 0);
}

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

    if (card.id === "defense_brace") {
      return total + 3 * card.count;
    }

    if (card.id === "defense_fake_death") {
      return total + 5 * card.count;
    }

    if (card.type === "defense") {
      return total + (card.block ?? 0) * card.count;
    }

    return total;
  }, 0);
}

function estimatedWeaponPressure(card: { id: string; damage?: number; splashDamage?: number; maxTargets?: number }) {
  if (card.id === "weapon_minigun") {
    return (card.damage ?? 0) * (card.maxTargets ?? 6);
  }

  return (card.damage ?? 0) + (card.splashDamage ?? 0);
}

describe("starter deck balance", () => {
  it("leans toward damage without making survival cards irrelevant", () => {
    const pressure = totalWeaponDamage() + totalDamageSupport();
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
