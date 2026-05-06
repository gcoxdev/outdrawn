import type { Card, CardTiming } from "../data/cards";
import type { GameSettings } from "../data/constants";

export type PlayerId = string;
export type CardInstanceId = string;

export type CardDefinition = Card;

export type CardInstance = {
  instanceId: CardInstanceId;
  definitionId: string;
};

export type PlayerState = {
  id: PlayerId;
  name: string;
  health: number;
  hand: CardInstance[];
  equippedWeapon: CardInstance | null;
  equippedDefense: CardInstance | null;
  eliminated: boolean;
  attackedThisRound: boolean;
  actedThisRound: boolean;
  actionsRemaining: number;
  weaponCooldowns: Record<CardInstanceId, number>;
};

export type ActiveEvent = {
  card: CardInstance;
  timing: Extract<CardTiming, "thisRound" | "ongoing">;
};

export type LogEntry = {
  id: string;
  round: number;
  message: string;
};

export type PendingReaction = {
  attackerId: PlayerId;
  defenderId: PlayerId;
  weapon: CardInstance;
  baseDamage: number;
};

export type GamePhase = "setup" | "action" | "gameOver";

export type GameState = {
  phase: GamePhase;
  settings: GameSettings;
  round: number;
  players: PlayerState[];
  currentPlayerIndex: number;
  firstPlayerIndex: number;
  mainDeck: CardInstance[];
  eventDeck: CardInstance[];
  discardPile: CardInstance[];
  eventDiscardPile: CardInstance[];
  activeEvent: ActiveEvent | null;
  pendingReaction: PendingReaction | null;
  selectedCardId: CardInstanceId | null;
  attackBonuses: Record<PlayerId, number>;
  markedTargets: Record<PlayerId, number>;
  log: LogEntry[];
  winnerId: PlayerId | null;
};
