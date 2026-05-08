import type { Card, CardTiming } from "../data/cards";
import type { GameSettings } from "../data/constants";

export type PlayerId = string;
export type CardInstanceId = string;
export type StrategyLevel = "beginner" | "novice" | "competent" | "expert" | "master";

export type PlayerController =
  | { type: "human" }
  | {
      type: "computer";
      strategy: StrategyLevel;
    };

export type PlayerSetup = {
  name: string;
  controller: PlayerController;
};

export type CardDefinition = Card;

export type CardInstance = {
  instanceId: CardInstanceId;
  definitionId: string;
};

export type PlayerState = {
  id: PlayerId;
  name: string;
  controller: PlayerController;
  health: number;
  hand: CardInstance[];
  eliminated: boolean;
  eliminations: number;
  attackedThisRound: boolean;
  actedThisRound: boolean;
  actionsRemaining: number;
};

export type ActiveEvent = {
  card: CardInstance;
  timing: Extract<CardTiming, "thisRound" | "ongoing">;
};

export type LogEntry = {
  id: string;
  round: number;
  message: string;
  debugHandSnapshots: Array<{
    playerId: PlayerId;
    playerName: string;
    health: number;
    cards: CardInstance[];
  }>;
  handSnapshots: Array<{
    playerId: PlayerId;
    playerName: string;
    health: number;
    cards: CardInstance[];
  }>;
};

export type PendingReaction = {
  attackerId: PlayerId;
  defenderId: PlayerId;
  weapon: CardInstance;
  baseDamage: number;
};

export type PendingRedirect = PendingReaction & {
  decoy: CardInstance;
};

export type PendingAttackCost = {
  attackerId: PlayerId;
  targetPlayerId: PlayerId;
  weaponInstanceId: CardInstanceId;
  sourcePlayerId: PlayerId;
};

export type PendingMultiHitAttack = {
  attackerId: PlayerId;
  defenderId: PlayerId;
  weapon: CardInstance;
  hitsRemaining: number;
  hitDamage: number;
};

export type PendingDiscard = {
  sourcePlayerId: PlayerId;
  playerId: PlayerId;
  count: number;
  reason: string;
};

export type PendingSearch = {
  playerId: PlayerId;
  cards: CardInstance[];
};

export type PendingSupplyDrop = {
  playerOrder: PlayerId[];
  currentIndex: number;
  revealedCards: CardInstance[];
};

export type PendingMarketSearch = {
  playerId: PlayerId;
  cards: CardInstance[];
};

export type PendingSteal = {
  playerId: PlayerId;
  targetPlayerId: PlayerId;
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
  pendingRedirect: PendingRedirect | null;
  pendingAttackCost: PendingAttackCost | null;
  pendingMultiHitAttack: PendingMultiHitAttack | null;
  pendingDiscard: PendingDiscard | null;
  pendingSearch: PendingSearch | null;
  pendingSupplyDrop: PendingSupplyDrop | null;
  pendingMarketSearch: PendingMarketSearch | null;
  pendingSteal: PendingSteal | null;
  selectedCardId: CardInstanceId | null;
  attackBonuses: Record<PlayerId, number>;
  reloadPlayerIds: PlayerId[];
  markedTargets: Record<PlayerId, number>;
  smokeProtectedPlayerIds: PlayerId[];
  intimidations: Record<PlayerId, PlayerId[]>;
  log: LogEntry[];
  winnerId: PlayerId | null;
};
