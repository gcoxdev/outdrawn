import type { GameSettings } from "../data/constants";
import type { CardInstanceId, PlayerId } from "./types";

export type GameAction =
  | { type: "START_GAME"; playerNames: string[]; settings?: GameSettings }
  | { type: "UPDATE_SETTINGS"; settings: GameSettings }
  | { type: "SELECT_CARD"; cardInstanceId: CardInstanceId | null }
  | { type: "DRAW_CARD"; playerId: PlayerId }
  | { type: "DISCARD_CARD"; playerId: PlayerId; cardInstanceId: CardInstanceId }
  | { type: "PLAY_HEALING"; playerId: PlayerId; cardInstanceId: CardInstanceId }
  | { type: "PLAY_ABILITY"; playerId: PlayerId; cardInstanceId: CardInstanceId; targetPlayerId?: PlayerId }
  | { type: "RESOLVE_PENDING_DISCARD"; playerId: PlayerId; cardInstanceIds: CardInstanceId[] }
  | {
      type: "ATTACK";
      attackerId: PlayerId;
      targetPlayerId: PlayerId;
      weaponInstanceId: CardInstanceId;
    }
  | { type: "PLAY_REACTION"; defenderId: PlayerId; reactionCardInstanceId: CardInstanceId }
  | { type: "SKIP_REACTION"; defenderId: PlayerId }
  | { type: "PASS_ACTION"; playerId: PlayerId }
  | { type: "END_TURN"; playerId: PlayerId }
  | { type: "RESET_GAME" };
