import { eventDeckCards, mainDeckCards } from "../data/cards";
import { defaultGameSettings, type GameSettings } from "../data/constants";
import { drawCards, expandDeck, shuffleDeck } from "./deck";
import { getHandSnapshots, shouldCaptureHandSnapshots } from "./logSnapshots";
import { MAX_PLAYERS, MIN_PLAYERS } from "./setupOptions";
import type { GameState, PlayerSetup, PlayerState } from "./types";

export function createNewGame(
  playerInputs: string[] | PlayerSetup[],
  random: () => number = Math.random,
  settings: GameSettings = defaultGameSettings
): GameState {
  const playerSetups = normalizePlayerSetups(playerInputs);

  if (playerSetups.length < MIN_PLAYERS || playerSetups.length > MAX_PLAYERS) {
    throw new Error(`Outdrawn requires ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
  }

  let mainDeck = shuffleDeck(createScaledDeckForInitialHands(playerSetups.length, settings.startingHandSize), random);
  const players: PlayerState[] = playerSetups.map((setup, index) => {
    const draw = drawCards(mainDeck, settings.startingHandSize);
    mainDeck = draw.deck;

    return {
      id: `player_${index + 1}`,
      name: setup.name,
      controller: setup.controller,
      teamId: setup.teamId,
      health: settings.startingHealth,
      hand: draw.drawn,
      eliminated: false,
      eliminations: 0,
      attackedThisRound: false,
      actedThisRound: false,
      actionsRemaining: settings.actionsPerTurn,
      freeDrawsRemaining: settings.freeDrawsPerTurn
    };
  });
  mainDeck = shuffleDeck([...mainDeck, ...expandDeck(eventDeckCards, "event")], random);
  const firstPlayerIndex = Math.floor(random() * players.length);
  const debugHandSnapshots = shouldCaptureHandSnapshots(players.length, settings.debugHandSnapshots) ? getHandSnapshots(players) : [];

  return {
    phase: "action",
    settings,
    round: 1,
    players,
    currentPlayerIndex: firstPlayerIndex,
    firstPlayerIndex,
    mainDeck,
    eventDeck: [],
    discardPile: [],
    eventDiscardPile: [],
    activeEvent: null,
    pendingEventDialog: null,
    pendingReaction: null,
    pendingRedirect: null,
    pendingAttackCost: null,
    pendingMultiHitAttack: null,
    pendingDiscard: null,
    pendingSearch: null,
    pendingSupplyDrop: null,
    pendingMarketSearch: null,
    pendingBlackMarket: null,
    pendingSteal: null,
    pendingSecondaryDamage: null,
    selectedCardId: null,
    attackBonuses: {},
    reloadPlayerIds: [],
    markedTargets: {},
    smokeProtectedPlayerIds: [],
    intimidations: {},
    log: [
      {
        id: "log_setup",
        round: 1,
        message: `${playerSetups[firstPlayerIndex].name} takes the first turn.`,
        debugHandSnapshots,
        handSnapshots: settings.debugHandSnapshots ? debugHandSnapshots : []
      }
    ],
    winnerId: null,
    winnerTeamId: null
  };
}

function createScaledDeckForInitialHands(playerCount: number, startingHandSize: number) {
  const baseDeck = expandDeck(mainDeckCards, "main");
  const requiredCards = playerCount * startingHandSize;
  const copies = Math.max(1, Math.ceil(requiredCards / baseDeck.length));

  return Array.from({ length: copies }).flatMap((_, copyIndex) =>
    expandDeck(mainDeckCards, copyIndex === 0 ? "main" : `main${copyIndex + 1}`)
  );
}

function normalizePlayerSetups(playerInputs: string[] | PlayerSetup[]): PlayerSetup[] {
  return playerInputs
    .map((input) => {
      if (typeof input === "string") {
        return { name: input.trim(), controller: { type: "human" } as const };
      }

      return {
        ...input,
        name: input.name.trim(),
        teamId: input.teamId
      };
    })
    .filter((setup) => setup.name);
}
