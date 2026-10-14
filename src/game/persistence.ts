import { validateSavedGame } from "./validateSave";
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
      const payload = JSON.stringify({ ...state, resolvedEffects: undefined, log: state.log.slice(-250).map(entry => ({ ...entry, debugHandSnapshots: [], handSnapshots: [] })) });
      storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, payload, checksum: checksum(payload) }));
    }
    return true;
  } catch { return false; }
}

export type LoadedMatch = { state: GameState; rejected?: string; reason?: string };
export function readSavedMatch(fallback: GameState, storage: Pick<Storage, "getItem">): LoadedMatch {
  let raw: string | null = null;
  try {
    raw = storage.getItem(SAVE_KEY);
    if (!raw) return { state: fallback };
    if (raw.length > 2_000_000) throw new Error("The saved match is too large to restore.");
    const saved = JSON.parse(raw);
    if (saved.version !== SAVE_VERSION) throw new Error("This saved match uses an unsupported version.");
    if (typeof saved.payload !== "string" || checksum(saved.payload) !== saved.checksum) throw new Error("The saved match is incomplete or damaged.");
    const state = JSON.parse(saved.payload);
    state.selectedCardId = null;
    validateSavedGame(state);
    if (state.players.some((player: GameState["players"][number]) => player.damageDealt === undefined)) {
      state.damageTrackingStartedMidMatch = true;
      state.players = state.players.map((player: GameState["players"][number]) => ({ ...player, damageDealt: player.damageDealt ?? 0 }));
    }
    const deckRandomState = state.deckRandomState ?? (Math.floor(Math.random() * 0x100000000) >>> 0);
    return { state: { ...state, deckRandomState } };
  } catch (error) {
    return raw ? { state: fallback, rejected: raw, reason: error instanceof Error ? error.message : "Could not restore this match." } : { state: fallback };
  }
}

export function loadGame(fallback: GameState, storage: Pick<Storage, "getItem">): GameState {
  return readSavedMatch(fallback, storage).state;
}
