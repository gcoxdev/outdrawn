import type { Card } from "../data/cards";
import type { CardInstance } from "./types";

export function expandDeck(cards: Card[], prefix: string): CardInstance[] {
  return cards.flatMap((card) =>
    Array.from({ length: card.count }, (_, index) => ({
      instanceId: `${prefix}_${card.id}_${index + 1}`,
      definitionId: card.id
    }))
  );
}

export function findCardDefinition(
  instance: CardInstance | null | undefined,
  definitions: Card[]
): Card | undefined {
  if (!instance) {
    return undefined;
  }

  return definitions.find((card) => card.id === instance.definitionId);
}

export function shuffleDeck<T>(cards: T[], random: () => number = Math.random): T[] {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function drawCards(deck: CardInstance[], count: number) {
  return {
    drawn: deck.slice(0, count),
    deck: deck.slice(count)
  };
}

export function drawCardsWithRefill(
  mainDeck: CardInstance[],
  discardPile: CardInstance[],
  count: number
): {
  drawn: CardInstance[];
  mainDeck: CardInstance[];
  discardPile: CardInstance[];
} {
  const drawn: CardInstance[] = [];
  let deck = mainDeck;
  let discard = discardPile;

  while (drawn.length < count && (deck.length > 0 || discard.length > 0)) {
    if (deck.length === 0) {
      deck = discard;
      discard = [];
    }

    const [nextCard, ...rest] = deck;
    drawn.push(nextCard);
    deck = rest;
  }

  return {
    drawn,
    mainDeck: deck,
    discardPile: discard
  };
}
