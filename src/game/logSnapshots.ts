import type { GameState, PlayerState } from "./types";

export const DEBUG_SNAPSHOT_LOG_LIMIT = 50;

export function shouldCaptureHandSnapshots(debugSnapshotsVisible: boolean): boolean {
  return import.meta.env.DEV && debugSnapshotsVisible;
}

export function getHandSnapshots(players: PlayerState[]): GameState["log"][number]["debugHandSnapshots"] {
  return players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    health: player.health,
    cards: player.hand.map((card) => ({ ...card }))
  }));
}
