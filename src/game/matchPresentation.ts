import type { GameAction } from "./actions";
import { gameReducer } from "./reducer";
import type { GameState, PlayerId } from "./types";

export type MatchPresentation = {
  game: GameState;
  eliminatedPlayerIds: PlayerId[];
};

type PresentationAction = GameAction | { type: "ACKNOWLEDGE_ELIMINATIONS" };

/** Notifications belong to the live view, not saved history or bot simulations. */
export function createMatchPresentation(game: GameState): MatchPresentation {
  return { game, eliminatedPlayerIds: [] };
}

export function matchPresentationReducer(state: MatchPresentation, action: PresentationAction): MatchPresentation {
  if (action.type === "ACKNOWLEDGE_ELIMINATIONS") {
    return { ...state, eliminatedPlayerIds: [] };
  }
  const resetsMatch = action.type === "START_GAME" || action.type === "RESTART_GAME" || action.type === "RESET_GAME";
  // Event explanations take priority; their continuations can eliminate more players.
  if (state.eliminatedPlayerIds.length && !resetsMatch && action.type !== "ACKNOWLEDGE_EVENT_DIALOG") return state;
  const game = gameReducer(state.game, action);
  if (game === state.game) return state;
  if (resetsMatch) return createMatchPresentation(game);
  const previouslyLiving = new Set(state.game.players.filter(player => !player.eliminated).map(player => player.id));
  const eliminated = game.players.filter(player => player.eliminated && previouslyLiving.has(player.id));
  return { game, eliminatedPlayerIds: [...state.eliminatedPlayerIds, ...eliminated.map(player => player.id)] };
}
