import type { TeamId } from "./types";

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 100;
export const PLAYER_COUNT_PRESETS = [4, 6, 10, 20, 50, 100] as const;

export type LobbyMode = "ffa" | "duos" | "trios" | "squads" | "twoTeams" | "custom";

const defaultNames = ["Ari", "Blake", "Casey", "Devon", "Eli", "Finn"];

export function clampPlayerCount(value: number): number {
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.floor(value || MIN_PLAYERS)));
}

export function getPlayerCountOptions(): number[] {
  return Array.from(new Set([MIN_PLAYERS, ...PLAYER_COUNT_PRESETS, MAX_PLAYERS])).sort((left, right) => left - right);
}

export function getDefaultPlayerName(index: number): string {
  return defaultNames[index] ?? `Player ${index + 1}`;
}

export function labelGeneratedTeam(teamId: TeamId): string {
  const suffix = teamId.replace(/^team_/, "");
  const numeric = Number(suffix);
  if (Number.isInteger(numeric) && numeric > 0) {
    return `Team ${numeric}`;
  }

  return `Team ${suffix.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())}`;
}

export function getTeamOptionsForMode(mode: LobbyMode, playerCount: number): TeamId[] {
  if (mode === "ffa") {
    return [];
  }

  if (mode === "custom") {
    return createTeamIds(Math.max(2, Math.ceil(playerCount / 2)));
  }

  return createTeamIds(getGeneratedTeamCount(mode, playerCount));
}

export function assignTeamsForMode(mode: LobbyMode, playerCount: number): TeamId[] {
  if (mode === "ffa") {
    return Array.from({ length: playerCount }, () => "");
  }

  const teamSize = getTeamSize(mode, playerCount);
  const teamCount = getGeneratedTeamCount(mode, playerCount);
  return Array.from({ length: playerCount }, (_, index) => `team_${Math.min(teamCount, Math.floor(index / teamSize) + 1)}`);
}

export function getTeamModeValidation(
  mode: LobbyMode,
  teams: TeamId[],
  playerCount: number
): { isValid: true; message?: undefined } | { isValid: false; message: string } {
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    return { isValid: false, message: `Outdrawn requires ${MIN_PLAYERS} to ${MAX_PLAYERS} players.` };
  }

  if (mode === "ffa") {
    return { isValid: true };
  }

  if (mode === "custom") {
    const activeTeamIds = getActiveTeamIds(teams, playerCount);
    return activeTeamIds.length >= 2 ? { isValid: true } : { isValid: false, message: "Custom teams require at least two teams." };
  }

  const divisor = getTeamSize(mode, playerCount);
  if (playerCount % divisor !== 0) {
    return { isValid: false, message: `${labelLobbyMode(mode)} requires a player count divisible by ${divisor}.` };
  }

  const expectedTeamIds = getTeamOptionsForMode(mode, playerCount);
  const activeTeams = teams.slice(0, playerCount);
  const expectedSize = mode === "twoTeams" ? playerCount / 2 : divisor;
  const hasExpectedTeams = expectedTeamIds.every((teamId) => activeTeams.filter((team) => team === teamId).length === expectedSize);
  const hasNoExtraTeams = activeTeams.every((teamId) => expectedTeamIds.includes(teamId));

  if (hasExpectedTeams && hasNoExtraTeams) {
    return { isValid: true };
  }

  return {
    isValid: false,
    message: `${labelLobbyMode(mode)} requires ${expectedSize} players each on ${formatList(expectedTeamIds.map(labelGeneratedTeam))}.`
  };
}

export function labelLobbyMode(mode: LobbyMode): string {
  const labels: Record<LobbyMode, string> = {
    ffa: "Free-for-all",
    duos: "Duos",
    trios: "Trios",
    squads: "Squads",
    twoTeams: "Two Teams",
    custom: "Custom Teams"
  };

  return labels[mode];
}

function getGeneratedTeamCount(mode: LobbyMode, playerCount: number): number {
  if (mode === "twoTeams") {
    return 2;
  }

  return Math.max(1, Math.ceil(playerCount / getTeamSize(mode, playerCount)));
}

function getTeamSize(mode: LobbyMode, playerCount: number): number {
  const sizes: Partial<Record<LobbyMode, number>> = {
    duos: 2,
    trios: 3,
    squads: 4,
    twoTeams: Math.max(1, playerCount / 2)
  };

  return sizes[mode] ?? 1;
}

function createTeamIds(count: number): TeamId[] {
  return Array.from({ length: count }, (_, index) => `team_${index + 1}`);
}

function getActiveTeamIds(teams: TeamId[], playerCount: number): TeamId[] {
  return [...new Set(teams.slice(0, playerCount).filter(Boolean))];
}

function formatList(values: string[]): string {
  if (values.length <= 2) {
    return values.join(" and ");
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}
