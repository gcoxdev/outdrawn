import type { Card, CardTiming, CardType } from "../data/cards";
import type { GameSettings } from "../data/constants";

export type PlayerId = string;
export type TeamId = string;
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
  teamId?: TeamId;
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
  teamId?: TeamId;
  health: number;
  hand: CardInstance[];
  eliminated: boolean;
  eliminations: number;
  attackedThisRound: boolean;
  actedThisRound: boolean;
  actionsRemaining: number;
  freeDrawsRemaining: number;
};

export type ActiveEvent = {
  card: CardInstance;
  timing: Extract<CardTiming, "thisRound" | "ongoing">;
  sourcePlayerId?: PlayerId;
  exemptPlayerIds?: PlayerId[];
};

export type PendingEventDialog = {
  card: CardInstance;
  playerId: PlayerId;
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
  allowedCardInstanceIds?: CardInstanceId[];
  continuation?: {
    type: "forced_discard";
    remainingPlayerIds: PlayerId[];
    cardType: CardType;
    reason: string;
  };
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
  keepCount: number;
};

export type PendingBlackMarket = {
  card: CardInstance;
  playerId: PlayerId;
};

export type PendingSteal = {
  playerId: PlayerId;
  targetPlayerId: PlayerId;
};

export type SecondaryDamageSource = "splash" | "ricochet" | "minigun" | "counterattack" | "backfire";

export type SecondaryDamageItem = {
  attackerId: PlayerId;
  defenderId: PlayerId;
  weapon: CardInstance;
  baseDamage: number;
  source: SecondaryDamageSource;
};

export type PendingSecondaryDamage = SecondaryDamageItem & {
  remaining: SecondaryDamageItem[];
};

export type GamePhase = "setup" | "action" | "gameOver";

export type DrawContinuation = {
  playerId: PlayerId;
  remaining: number;
  cards: CardInstance[];
  destination: "hand" | "search";
  replaceEvents: boolean;
  spendDraw?: boolean;
  playedCard?: CardInstance;
};

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
  pendingEventDialog: PendingEventDialog | null;
  eventDialogQueue?: PendingEventDialog[];
  resolvedEventCount?: number;
  drawContinuations?: DrawContinuation[];
  pendingReaction: PendingReaction | null;
  pendingRedirect: PendingRedirect | null;
  pendingAttackCost: PendingAttackCost | null;
  pendingMultiHitAttack: PendingMultiHitAttack | null;
  pendingDiscard: PendingDiscard | null;
  pendingSearch: PendingSearch | null;
  pendingSupplyDrop: PendingSupplyDrop | null;
  pendingMarketSearch: PendingMarketSearch | null;
  pendingBlackMarket: PendingBlackMarket | null;
  pendingSteal: PendingSteal | null;
  pendingSecondaryDamage: PendingSecondaryDamage | null;
  selectedCardId: CardInstanceId | null;
  attackBonuses: Record<PlayerId, number>;
  reloadPlayerIds: PlayerId[];
  markedTargets: Record<PlayerId, number>;
  smokeProtectedPlayerIds: PlayerId[];
  intimidations: Record<PlayerId, PlayerId[]>;
  log: LogEntry[];
  winnerId: PlayerId | null;
  winnerTeamId: TeamId | null;
};
