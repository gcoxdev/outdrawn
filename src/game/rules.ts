import { allCards } from "../data/cards";
import { labelGeneratedTeam } from "./setupOptions";
import type { CardInstanceId, GameState, PlayerId, PlayerState, TeamId } from "./types";

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
    !state.pendingBlackMarket &&
    !state.pendingSteal &&
    !state.pendingSecondaryDamage &&
    player.id === playerId &&
    !player.eliminated &&
    player.actionsRemaining > 0
  );
}

export function canPlayerDraw(state: GameState, playerId: PlayerId): boolean {
  const player = getCurrentPlayer(state);
  const hasDrawResource = state.settings.drawsUseActions ? player.actionsRemaining > 0 : player.drawsRemaining > 0;

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
    !state.pendingBlackMarket &&
    !state.pendingSteal &&
    !state.pendingSecondaryDamage &&
    player.id === playerId &&
    !player.eliminated &&
    hasDrawResource
  );
}

export function isGameOver(state: GameState): boolean {
  return getLivingPlayers(state).length <= 1 || Boolean(getWinningTeamId(state));
}

export function getWinner(state: GameState): PlayerState | null {
  const livingPlayers = getLivingPlayers(state);
  return livingPlayers.length === 1 ? livingPlayers[0] : null;
}

export function getWinningTeamId(state: GameState): TeamId | null {
  const livingPlayers = getLivingPlayers(state);
  const livingTeamIds = new Set(livingPlayers.map((player) => player.teamId).filter((teamId): teamId is TeamId => Boolean(teamId)));

  return livingPlayers.length >= 1 && livingTeamIds.size === 1 && livingPlayers.every((player) => player.teamId) ? [...livingTeamIds][0] : null;
}

export function getTeamMembers(state: GameState, teamId: TeamId): PlayerState[] {
  return state.players.filter((player) => player.teamId === teamId);
}

export function areTeammates(left: PlayerState | undefined, right: PlayerState | undefined): boolean {
  return Boolean(left?.teamId && right?.teamId && left.teamId === right.teamId);
}

export function isHostileTarget(attacker: PlayerState, target: PlayerState): boolean {
  return attacker.id !== target.id && !areTeammates(attacker, target);
}

export function labelTeam(teamId: TeamId): string {
  const labels: Record<string, string> = {
    team_a: "Team A",
    team_b: "Team B",
    team_c: "Team C"
  };

  return labels[teamId] ?? labelGeneratedTeam(teamId);
}
