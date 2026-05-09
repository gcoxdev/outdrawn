import { eventDeckCards, mainDeckCards } from "../data/cards";
import { defaultGameSettings, type GameSettings } from "../data/constants";
import { drawCards, expandDeck, shuffleDeck } from "./deck";
import type { GameState, PlayerSetup, PlayerState } from "./types";

export function createNewGame(
  playerInputs: string[] | PlayerSetup[],
  random: () => number = Math.random,
  settings: GameSettings = defaultGameSettings
): GameState {
  const playerSetups = normalizePlayerSetups(playerInputs);

  if (playerSetups.length < 3 || playerSetups.length > 6) {
    throw new Error("Outdrawn requires 3 to 6 players.");
  }

  let mainDeck = shuffleDeck(expandDeck(mainDeckCards, "main"), random);
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
      actionsRemaining: settings.actionsPerTurn
    };
  });
  mainDeck = shuffleDeck([...mainDeck, ...expandDeck(eventDeckCards, "event")], random);
  const firstPlayerIndex = Math.floor(random() * players.length);

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
    pendingReaction: null,
    pendingRedirect: null,
    pendingAttackCost: null,
    pendingMultiHitAttack: null,
    pendingDiscard: null,
    pendingSearch: null,
    pendingSupplyDrop: null,
    pendingMarketSearch: null,
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
        debugHandSnapshots: import.meta.env.DEV ? getHandSnapshots(players) : [],
        handSnapshots: import.meta.env.DEV && settings.debugHandSnapshots ? getHandSnapshots(players) : []
      }
    ],
    winnerId: null,
    winnerTeamId: null
  };
}

function getHandSnapshots(players: PlayerState[]): GameState["log"][number]["debugHandSnapshots"] {
  return players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    health: player.health,
    cards: player.hand.map((card) => ({ ...card }))
  }));
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
