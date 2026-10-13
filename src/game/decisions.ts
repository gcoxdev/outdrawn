import type { GameAction } from "./actions";
import type { GameState, PlayerId } from "./types";

// A single typed view of the active choice. Stored continuations remain separate:
// a market offer, for example, survives while its revealed-card choice is active.
type DecisionFields = {
  event: "pendingEventDialog";
  reaction: "pendingReaction";
  redirect: "pendingRedirect";
  secondary: "pendingSecondaryDamage";
  attackCost: "pendingAttackCost";
  discard: "pendingDiscard";
  search: "pendingSearch";
  supplyDrop: "pendingSupplyDrop";
  marketSearch: "pendingMarketSearch";
  blackMarket: "pendingBlackMarket";
  steal: "pendingSteal";
};
export type PendingDecision = {
  [Kind in keyof DecisionFields]: {
    kind: Kind;
    playerId: PlayerId;
    pending: NonNullable<GameState[DecisionFields[Kind]]>;
  }
}[keyof DecisionFields];

export function getPlayerDecision(state: GameState): Exclude<PendingDecision, { kind: "event" }> | null {
  if (state.pendingReaction) return { kind: "reaction", playerId: state.pendingReaction.defenderId, pending: state.pendingReaction };
  if (state.pendingRedirect) return { kind: "redirect", playerId: state.pendingRedirect.defenderId, pending: state.pendingRedirect };
  if (state.pendingSecondaryDamage) return { kind: "secondary", playerId: state.pendingSecondaryDamage.defenderId, pending: state.pendingSecondaryDamage };
  if (state.pendingAttackCost) return { kind: "attackCost", playerId: state.pendingAttackCost.attackerId, pending: state.pendingAttackCost };
  if (state.pendingDiscard) return { kind: "discard", playerId: state.pendingDiscard.playerId, pending: state.pendingDiscard };
  if (state.pendingSearch) return { kind: "search", playerId: state.pendingSearch.playerId, pending: state.pendingSearch };
  if (state.pendingSupplyDrop) return { kind: "supplyDrop", playerId: state.pendingSupplyDrop.playerOrder[state.pendingSupplyDrop.currentIndex], pending: state.pendingSupplyDrop };
  if (state.pendingMarketSearch) return { kind: "marketSearch", playerId: state.pendingMarketSearch.playerId, pending: state.pendingMarketSearch };
  if (state.pendingBlackMarket) return { kind: "blackMarket", playerId: state.pendingBlackMarket.playerId, pending: state.pendingBlackMarket };
  if (state.pendingSteal) return { kind: "steal", playerId: state.pendingSteal.playerId, pending: state.pendingSteal };
  return null;
}

export function getPendingDecision(state: GameState): PendingDecision | null {
  return state.pendingEventDialog
    ? { kind: "event", playerId: state.pendingEventDialog.playerId, pending: state.pendingEventDialog }
    : getPlayerDecision(state);
}

const resolutionActions: Record<PendingDecision["kind"], readonly GameAction["type"][]> = {
  event: ["ACKNOWLEDGE_EVENT_DIALOG"],
  reaction: ["PLAY_REACTION", "SKIP_REACTION"],
  redirect: ["RESOLVE_PENDING_REDIRECT"],
  secondary: ["PLAY_SECONDARY_REACTION", "SKIP_SECONDARY_REACTION"],
  attackCost: ["RESOLVE_PENDING_ATTACK_COST"],
  discard: ["RESOLVE_PENDING_DISCARD"],
  search: ["RESOLVE_PENDING_SEARCH"],
  supplyDrop: ["RESOLVE_SUPPLY_DROP_PICK"],
  marketSearch: ["RESOLVE_MARKET_SEARCH"],
  blackMarket: ["START_BLACK_MARKET", "PASS_BLACK_MARKET"],
  steal: ["RESOLVE_PENDING_STEAL"]
};

export function acceptsDecisionAction(state: GameState, action: GameAction): boolean {
  const decision = getPendingDecision(state);
  if (!decision) return true;
  if (["RESET_GAME", "RESTART_GAME", "UPDATE_SETTINGS"].includes(action.type)) return true;
  if (action.type === "SELECT_CARD") return decision.kind !== "event";
  return resolutionActions[decision.kind].includes(action.type);
}
