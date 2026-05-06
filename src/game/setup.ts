import { eventDeckCards, mainDeckCards } from "../data/cards";
import { defaultGameSettings, type GameSettings } from "../data/constants";
import { drawCards, expandDeck, shuffleDeck } from "./deck";
import type { GameState, PlayerState } from "./types";

export function createNewGame(
  playerNames: string[],
  random: () => number = Math.random,
  settings: GameSettings = defaultGameSettings
): GameState {
  const names = playerNames.map((name) => name.trim()).filter(Boolean);

  if (names.length < 3 || names.length > 6) {
    throw new Error("Last Hand Standing requires 3 to 6 players.");
  }

  let mainDeck = shuffleDeck(expandDeck(mainDeckCards, "main"), random);
  const eventDeck = shuffleDeck(expandDeck(eventDeckCards, "event"), random);
  const players: PlayerState[] = names.map((name, index) => {
    const draw = drawCards(mainDeck, settings.startingHandSize);
    mainDeck = draw.deck;

    return {
      id: `player_${index + 1}`,
      name,
      health: settings.startingHealth,
      hand: draw.drawn,
      equippedWeapon: null,
      equippedDefense: null,
      eliminated: false,
      attackedThisRound: false,
      actedThisRound: false,
      actionsRemaining: settings.actionsPerTurn,
      weaponCooldowns: {}
    };
  });
  const firstPlayerIndex = Math.floor(random() * players.length);

  return {
    phase: "action",
    settings,
    round: 1,
    players,
    currentPlayerIndex: firstPlayerIndex,
    firstPlayerIndex,
    mainDeck,
    eventDeck,
    discardPile: [],
    eventDiscardPile: [],
    activeEvent: null,
    pendingReaction: null,
    pendingRedirect: null,
    pendingAttackCost: null,
    pendingDiscard: null,
    pendingSearch: null,
    selectedCardId: null,
    attackBonuses: {},
    markedTargets: {},
    smokeProtectedPlayerIds: [],
    intimidations: {},
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
