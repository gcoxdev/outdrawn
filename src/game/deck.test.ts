import { describe, expect, it } from "vitest";
import { eventDeckCards, mainDeckCards } from "../data/cards";
import { drawCardsWithRefill, expandDeck, findCardDefinition } from "./deck";

describe("deck helpers", () => {
  it("shuffles a refill reproducibly without mutating or losing cards", () => {
    const discard = expandDeck(mainDeckCards, "refill").slice(0, 8);
    const before = structuredClone(discard);
    Object.freeze(discard);
    const draw = drawCardsWithRefill([], discard, 8, 1234);
    expect(draw.drawn).not.toEqual(before);
    expect(draw.drawn.map(card => card.instanceId).sort()).toEqual(before.map(card => card.instanceId).sort());
    expect(draw.mainDeck).toEqual([]);
    expect(draw.discardPile).toEqual([]);
    expect(draw.deckRandomState).not.toBe(1234);
    expect(discard).toEqual(before);
    expect(drawCardsWithRefill([], discard, 8, 1234)).toEqual(draw);
    expect(drawCardsWithRefill([], discard, 8, 5678).drawn).not.toEqual(draw.drawn);
  });

  it("keeps the current deck order and random state until a refill is needed", () => {
    const cards = expandDeck(mainDeckCards, "partial").slice(0, 10);
    const deck = cards.slice(0, 2), discard = cards.slice(2);
    expect(drawCardsWithRefill(deck, discard, 1, 1234)).toEqual({ drawn: deck.slice(0, 1), mainDeck: deck.slice(1), discardPile: discard, deckRandomState: 1234 });
    const draw = drawCardsWithRefill(deck, discard, 5, 1234);
    expect(draw.drawn.slice(0, 2)).toEqual(deck);
    expect(draw.drawn.slice(2)).toEqual(drawCardsWithRefill([], discard, 3, 1234).drawn);
    expect(draw.drawn.concat(draw.mainDeck).map(card => card.instanceId).sort()).toEqual(cards.map(card => card.instanceId).sort());
    expect(drawCardsWithRefill([], discard, 0, 1234).deckRandomState).toBe(1234);
    expect(drawCardsWithRefill([], [], 5, 1234).deckRandomState).toBe(1234);
  });

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
