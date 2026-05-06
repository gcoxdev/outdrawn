import type { CardInstanceId, PlayerId } from "./types";

export type GameAction =
  | { type: "START_GAME"; playerNames: string[] }
  | { type: "SELECT_CARD"; cardInstanceId: CardInstanceId | null }
  | { type: "DRAW_CARD"; playerId: PlayerId }
  | { type: "DISCARD_CARD"; playerId: PlayerId; cardInstanceId: CardInstanceId }
  | { type: "PLAY_HEALING"; playerId: PlayerId; cardInstanceId: CardInstanceId }
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
