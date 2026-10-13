import { getDecisionPlayerId } from "./rules";
import type { GameState, PlayerId } from "./types";

export type PassDeviceContext = {
  playerId: PlayerId;
  playerName: string;
  reason: string;
};

export function getPassDeviceContext(state: GameState, lastRevealedHumanId: PlayerId | null): PassDeviceContext | null {
  if (!state.settings.passDeviceMode || state.phase !== "action") {
    return null;
  }

  const livingHumans = state.players.filter((player) => !player.eliminated && player.controller.type === "human");
  if (livingHumans.length <= 1) {
    return null;
  }

  const decisionPlayerId = getDecisionPlayerId(state);
  if (decisionPlayerId === lastRevealedHumanId) {
    return null;
  }

  const decisionPlayer = state.players.find((player) => player.id === decisionPlayerId);
  if (!decisionPlayer || decisionPlayer.controller.type !== "human") {
    return null;
  }

  return {
    playerId: decisionPlayer.id,
    playerName: decisionPlayer.name,
    reason: getPassDeviceReason(state)
  };
}

function getPassDeviceReason(state: GameState): string {
  if (state.pendingReaction) {
    return "They are being attacked and need to choose a defense or take the hit.";
  }

  if (state.pendingRedirect) {
    return "They played Ricochet and need to redirect the attack.";
  }

  if (state.pendingSecondaryDamage) {
    return "They can defend against secondary damage or take the hit.";
  }

  if (state.pendingAttackCost) {
    return "They are attacking an intimidated player and must discard a card first.";
  }

  if (state.pendingDiscard) {
    return "They need to choose which cards to discard.";
  }

  if (state.pendingSearch) {
    return "They need to choose which Search card to keep.";
  }

  if (state.pendingSupplyDrop) {
    return "They need to choose a Supply Drop card or pass.";
  }

  if (state.pendingMarketSearch) {
    return "They need to choose which Black Market card to keep.";
  }

  if (state.pendingBlackMarket) {
    return "They need to decide whether to use the Black Market.";
  }

  if (state.pendingSteal) {
    return "They need to choose which face-down card to steal.";
  }

  return "It is their turn.";
}
