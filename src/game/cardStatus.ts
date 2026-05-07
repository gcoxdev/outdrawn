import type { Card } from "../data/cards";

const incompleteCardStatus: Partial<Record<string, "partial" | "pending">> = {};

export function getCardImplementationStatus(card: Card): "implemented" | "partial" | "pending" {
  return incompleteCardStatus[card.id] ?? "implemented";
}

export function getCardImplementationNote(card: Card): string {
  const status = getCardImplementationStatus(card);

  if (status === "implemented") {
    return "";
  }

  if (status === "partial") {
    return "Partially implemented.";
  }

  if (card.type === "ability") {
    return "Ability is not fully implemented yet.";
  }

  if (card.type === "event") {
    return "Event is not fully implemented yet.";
  }

  return "Card is not fully implemented yet.";
}
