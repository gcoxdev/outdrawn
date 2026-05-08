import { allCards } from "../data/cards";
import type { CardInstanceId, GameState, PlayerId, PlayerState } from "./types";

export function getLivingPlayers(state: GameState): PlayerState[] {
  return state.players.filter((player) => !player.eliminated);
}

export function getCurrentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

export function getPlayer(state: GameState, playerId: PlayerId): PlayerState | undefined {
  return state.players.find((player) => player.id === playerId);
}

export function getCardDefinitionById(definitionId: string) {
  return allCards.find((card) => card.id === definitionId);
}

export function getCardFromPlayer(player: PlayerState, cardInstanceId: CardInstanceId) {
  return player.hand.find((card) => card.instanceId === cardInstanceId);
}

export function canPlayerAct(state: GameState, playerId: PlayerId): boolean {
  const player = getCurrentPlayer(state);
  return (
    state.phase === "action" &&
    !state.pendingReaction &&
    !state.pendingRedirect &&
    !state.pendingAttackCost &&
    !state.pendingMultiHitAttack &&
    !state.pendingDiscard &&
    !state.pendingSearch &&
    !state.pendingSupplyDrop &&
    !state.pendingMarketSearch &&
    !state.pendingSteal &&
    player.id === playerId &&
    !player.eliminated &&
    player.actionsRemaining > 0
  );
}

export function isGameOver(state: GameState): boolean {
  return getLivingPlayers(state).length <= 1;
}

export function getWinner(state: GameState): PlayerState | null {
  const livingPlayers = getLivingPlayers(state);
  return livingPlayers.length === 1 ? livingPlayers[0] : null;
}
