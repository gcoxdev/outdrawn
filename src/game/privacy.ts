import { getPlayerDecision } from "./decisions";
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
  const decision = getPlayerDecision(state);
  if (decision?.kind === "reaction") {
    return "They are being attacked and need to choose a defense or take the hit.";
  }

  if (decision?.kind === "redirect") {
    return "They played Ricochet and need to redirect the attack.";
  }

  if (decision?.kind === "secondary") {
    return "They can defend against secondary damage or take the hit.";
  }

  if (decision?.kind === "attackCost") {
    return "They are attacking an intimidated player and must discard a card first.";
  }

  if (decision?.kind === "discard") {
    return "They need to choose which cards to discard.";
  }

  if (decision?.kind === "search") {
    return "They need to choose which Search card to keep.";
  }

  if (decision?.kind === "supplyDrop") {
    return "They need to choose a Supply Drop card or pass.";
  }

  if (decision?.kind === "marketSearch") {
    return "They need to choose which Black Market card to keep.";
  }

  if (decision?.kind === "blackMarket") {
    return "They need to decide whether to use the Black Market.";
  }

  if (decision?.kind === "steal") {
    return "They need to choose which face-down card to steal.";
  }

  return "It is their turn.";
}
