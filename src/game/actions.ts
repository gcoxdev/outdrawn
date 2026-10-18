import type { GameSettings } from "../data/constants";
import type { CardInstanceId, PlayerId, PlayerSetup } from "./types";

export type GameAction =
  | { type: "START_GAME"; playerNames: string[]; playerSetups?: PlayerSetup[]; settings?: GameSettings }
  | { type: "UPDATE_SETTINGS"; settings: GameSettings }
  | { type: "SELECT_CARD"; cardInstanceId: CardInstanceId | null }
  | { type: "DRAW_CARD"; playerId: PlayerId }
  | { type: "DISCARD_CARD"; playerId: PlayerId; cardInstanceId: CardInstanceId }
  | { type: "DISCARD_CARDS"; playerId: PlayerId; cardInstanceIds: CardInstanceId[] }
  | { type: "PLAY_HEALING"; playerId: PlayerId; cardInstanceId: CardInstanceId; targetPlayerId?: PlayerId }
  | { type: "TRANSFER_CARD"; playerId: PlayerId; targetPlayerId: PlayerId; cardInstanceId: CardInstanceId }
  | { type: "PLAY_ABILITY"; playerId: PlayerId; cardInstanceId: CardInstanceId; targetPlayerId?: PlayerId }
  | { type: "RESOLVE_PENDING_DISCARD"; playerId: PlayerId; cardInstanceIds: CardInstanceId[] }
  | { type: "RESOLVE_PENDING_SEARCH"; playerId: PlayerId; keepCardInstanceId: CardInstanceId }
  | { type: "RESOLVE_PENDING_REDIRECT"; defenderId: PlayerId; targetPlayerId: PlayerId }
  | { type: "RESOLVE_PENDING_ATTACK_COST"; attackerId: PlayerId; cardInstanceId: CardInstanceId }
  | { type: "START_BLACK_MARKET"; playerId: PlayerId; cardInstanceIds: CardInstanceId[] }
  | { type: "RESOLVE_MARKET_SEARCH"; playerId: PlayerId; keepCardInstanceIds: CardInstanceId[] }
  | { type: "PASS_BLACK_MARKET"; playerId: PlayerId }
  | { type: "RESOLVE_PENDING_STEAL"; playerId: PlayerId; targetPlayerId: PlayerId; cardInstanceId: CardInstanceId }
  | { type: "ACKNOWLEDGE_EVENT_DIALOG" }
  | { type: "PLAY_SECONDARY_REACTION"; defenderId: PlayerId; reactionCardInstanceId: CardInstanceId }
  | { type: "SKIP_SECONDARY_REACTION"; defenderId: PlayerId }
  | {
      type: "ATTACK";
      attackerId: PlayerId;
      targetPlayerId?: PlayerId;
      weaponInstanceId: CardInstanceId;
      damageByTarget?: Record<PlayerId, number>;
    }
  | { type: "PLAY_REACTION"; defenderId: PlayerId; reactionCardInstanceId: CardInstanceId }
  | { type: "SKIP_REACTION"; defenderId: PlayerId }
  | { type: "PASS_ACTION"; playerId: PlayerId }
  | { type: "END_TURN"; playerId: PlayerId }
  | { type: "RESET_GAME" }
  | { type: "RESTART_GAME" };
