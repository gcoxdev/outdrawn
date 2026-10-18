import { getPendingDecision, getPlayerDecision } from "./decisions";
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

export function hasPendingDecision(state: GameState): boolean {
  return Boolean(getPendingDecision(state) || state.pendingMultiHitAttack || state.drawContinuations?.length);
}

export function canPlayerEndTurn(state: GameState, playerId: PlayerId): boolean {
  return state.phase === "action" && !hasPendingDecision(state) && getCurrentPlayer(state)?.id === playerId && !getCurrentPlayer(state)?.recovering;
}

export function canPlayerAct(state: GameState, playerId: PlayerId): boolean {
  const player = getCurrentPlayer(state);
  return canPlayerEndTurn(state, playerId) && !player.eliminated && player.actionsRemaining > 0;
}

export function canPlayerDraw(state: GameState, playerId: PlayerId): boolean {
  const player = getCurrentPlayer(state);
  return canPlayerEndTurn(state, playerId) && !player.eliminated && (player.freeDrawsRemaining > 0 || player.actionsRemaining > 0);
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
  return attacker.id !== target.id && !target.recovering && !areTeammates(attacker, target);
}

export function labelTeam(teamId: TeamId): string {
  return labelGeneratedTeam(teamId);
}

export function getDecisionPlayerId(state: GameState): string {
  return getPlayerDecision(state)?.playerId ?? getCurrentPlayer(state)?.id ?? "";
}


/** Smoke does not restrict Ricochet. Return to the attacker only as a fallback. */
export function getRicochetTargets(state: GameState, attackerId: PlayerId, defenderId: PlayerId): PlayerState[] {
  const defender = getPlayer(state, defenderId);
  if (!defender) return [];
  const opponents = state.players.filter(player => !player.eliminated && isHostileTarget(defender, player));
  const otherOpponents = opponents.filter(player => player.id !== attackerId);
  return otherOpponents.length ? otherOpponents : opponents.filter(player => player.id === attackerId);
}
