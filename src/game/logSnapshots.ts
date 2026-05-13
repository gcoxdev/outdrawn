import type { GameState, PlayerState } from "./types";

export const DEBUG_SNAPSHOT_PRECAPTURE_PLAYER_LIMIT = 24;

export function shouldCaptureHandSnapshots(playerCount: number, debugSnapshotsVisible: boolean): boolean {
  return import.meta.env.DEV && (debugSnapshotsVisible || playerCount <= DEBUG_SNAPSHOT_PRECAPTURE_PLAYER_LIMIT);
}

export function getHandSnapshots(players: PlayerState[]): GameState["log"][number]["debugHandSnapshots"] {
  return players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    health: player.health,
    cards: player.hand.map((card) => ({ ...card }))
  }));
}
