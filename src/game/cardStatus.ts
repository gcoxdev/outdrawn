import type { Card } from "../data/cards";

const implementedCardIds = new Set([
  "weapon_pistol",
  "weapon_shotgun",
  "weapon_sniper_rifle",
  "weapon_knife",
  "weapon_grenade",
  "weapon_crossbow",
  "weapon_smg",
  "defense_armor_vest",
  "defense_shield_plate",
  "defense_dodge",
  "defense_counterattack",
  "defense_smoke_bomb",
  "defense_brace",
  "defense_fake_death",
  "ability_ambush",
  "ability_steal",
  "ability_sabotage",
  "ability_mark_target",
  "ability_adrenaline",
  "healing_bandage",
  "healing_medkit",
  "healing_painkillers"
]);

export function getCardImplementationStatus(card: Card): "implemented" | "partial" | "pending" {
  if (implementedCardIds.has(card.id)) {
    if (card.id === "weapon_grenade" || card.id === "weapon_smg") {
      return "partial";
    }
    return "implemented";
  }

  return "pending";
}

export function getCardImplementationNote(card: Card): string {
  const status = getCardImplementationStatus(card);

  if (status === "implemented") {
    return "Playable in the current prototype.";
  }

  if (status === "partial") {
    return "Basic damage works; special text is not fully implemented yet.";
  }

  if (card.type === "ability") {
    return "Ability card is still on the todo list.";
  }

  if (card.type === "event") {
    return "Event resolution is still on the todo list.";
  }

  return "Special timing/effect is still on the todo list.";
}
