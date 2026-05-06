import { describe, expect, it } from "vitest";
import { eventDeckCards, mainDeckCards } from "../data/cards";
import { expandDeck, findCardDefinition } from "./deck";

describe("deck helpers", () => {
  it("expands card counts into unique instances", () => {
    const deck = expandDeck(mainDeckCards, "main");
    const expectedCount = mainDeckCards.reduce((total, card) => total + card.count, 0);
    const uniqueIds = new Set(deck.map((card) => card.instanceId));

    expect(deck).toHaveLength(expectedCount);
    expect(uniqueIds.size).toBe(deck.length);
  });

  it("expands event cards separately from main deck cards", () => {
    const deck = expandDeck(eventDeckCards, "event");
    const expectedCount = eventDeckCards.reduce((total, card) => total + card.count, 0);

    expect(deck).toHaveLength(expectedCount);
    expect(deck.every((card) => card.instanceId.startsWith("event_"))).toBe(true);
  });

  it("finds definitions by instance", () => {
    const deck = expandDeck(mainDeckCards, "main");

    expect(findCardDefinition(deck[0], mainDeckCards)?.id).toBe(deck[0].definitionId);
  });
});
