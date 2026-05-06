import { eventDeckCards, mainDeckCards } from "../data/cards";
import { ACTIONS_PER_TURN, STARTING_HAND_SIZE, STARTING_HEALTH } from "../data/constants";
import { drawCards, expandDeck, shuffleDeck } from "./deck";
import type { GameState, PlayerState } from "./types";

export function createNewGame(playerNames: string[], random: () => number = Math.random): GameState {
  const names = playerNames.map((name) => name.trim()).filter(Boolean);

  if (names.length < 3 || names.length > 6) {
    throw new Error("Last Hand Standing requires 3 to 6 players.");
  }

  let mainDeck = shuffleDeck(expandDeck(mainDeckCards, "main"), random);
  const eventDeck = shuffleDeck(expandDeck(eventDeckCards, "event"), random);
  const players: PlayerState[] = names.map((name, index) => {
    const draw = drawCards(mainDeck, STARTING_HAND_SIZE);
    mainDeck = draw.deck;

    return {
      id: `player_${index + 1}`,
      name,
      health: STARTING_HEALTH,
      hand: draw.drawn,
      equippedWeapon: null,
      equippedDefense: null,
      eliminated: false,
      attackedThisRound: false,
      actedThisRound: false,
      actionsRemaining: ACTIONS_PER_TURN,
      weaponCooldowns: {}
    };
  });
  const firstPlayerIndex = Math.floor(random() * players.length);

  return {
    phase: "action",
    round: 1,
    players,
    currentPlayerIndex: firstPlayerIndex,
    firstPlayerIndex,
    mainDeck,
    eventDeck,
    discardPile: [],
    eventDiscardPile: [],
    activeEvent: null,
    selectedCardId: null,
    log: [
      {
        id: "log_setup",
        round: 1,
        message: `${names[firstPlayerIndex]} takes the first turn.`
      }
    ],
    winnerId: null
  };
}
