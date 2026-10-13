import type { GameState } from "./types";

export const SAVE_KEY = "outdrawn-match-v1";
const SAVE_VERSION = 1;

// Detect accidental truncation/corruption; this is not an authentication mechanism.
function checksum(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16);
}

export function saveGame(state: GameState, storage: Pick<Storage, "setItem" | "removeItem">): boolean {
  try {
    if (state.phase === "setup") storage.removeItem(SAVE_KEY);
    else {
      const payload = JSON.stringify({ ...state, log: state.log.slice(-250).map(entry => ({ ...entry, debugHandSnapshots: [], handSnapshots: [] })) });
      storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, payload, checksum: checksum(payload) }));
    }
    return true;
  } catch { return false; }
}

export function loadGame(fallback: GameState, storage: Pick<Storage, "getItem">): GameState {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw || raw.length > 2_000_000) return fallback;
    const saved = JSON.parse(raw);
    if (saved.version !== SAVE_VERSION || typeof saved.payload !== "string" || checksum(saved.payload) !== saved.checksum) return fallback;
    const state: GameState = JSON.parse(saved.payload);
    if (!["action", "gameOver"].includes(state.phase) || state.players.length < 3 || state.players.length > 100 || !state.players[state.currentPlayerIndex]) return fallback;
    // Always gate restored human hands again, even if a hand was visible before reload.
    return { ...state, selectedCardId: null };
  } catch { return fallback; }
}
