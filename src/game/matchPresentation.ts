import type { GameAction } from "./actions";
import { gameReducer } from "./reducer";
import { chooseAutomatedAction, getDecisionPlayerId } from "./simulator";
import type { GameState, PlayerId } from "./types";

export type ComputerRecap = {
  decisions: number;
  eliminatedPlayerIds: PlayerId[];
  damageTaken: Record<PlayerId, number>;
  eventIds: string[];
};

export type MatchPresentation = {
  game: GameState;
  eliminatedPlayerIds: PlayerId[];
  fastForward?: boolean;
  computerRecap?: ComputerRecap;
};

type PresentationAction = GameAction | { type: "ACKNOWLEDGE_ELIMINATIONS" } | { type: "START_FAST_FORWARD" } | { type: "STOP_FAST_FORWARD" } | { type: "DISMISS_COMPUTER_RECAP" } | { type: "ADVANCE_COMPUTERS"; seed: number };

/** Notifications and computer pacing belong to the live view, never saved history. */
export function createMatchPresentation(game: GameState): MatchPresentation {
  return { game, eliminatedPlayerIds: [] };
}

export function canFastForward(state: MatchPresentation): boolean {
  const game = state.game;
  return game.phase === "action" && !game.pendingEventDialog && !state.eliminatedPlayerIds.length
    && game.players.some(player => !player.eliminated && player.controller.type === "human")
    && game.players.some(player => player.id === getDecisionPlayerId(game) && !player.eliminated && player.controller.type === "computer");
}

export function matchPresentationReducer(state: MatchPresentation, action: PresentationAction): MatchPresentation {
  if (action.type === "START_FAST_FORWARD") {
    if (!canFastForward(state) || state.computerRecap) return state;
    return { ...state, fastForward: true, computerRecap: { decisions: 0, eliminatedPlayerIds: [], damageTaken: {}, eventIds: [] } };
  }
  if (action.type === "STOP_FAST_FORWARD") return state.fastForward ? { ...state, fastForward: false } : state;
  if (action.type === "DISMISS_COMPUTER_RECAP") return { ...state, fastForward: false, computerRecap: undefined };
  if (action.type === "ADVANCE_COMPUTERS") {
    if (!state.fastForward || !state.computerRecap) return state;
    let next = state;
    let seed = action.seed >>> 0;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
    // Yield to rendering and input between bounded batches. Never automate acknowledgments.
    for (let i = 0; i < 20 && canFastForward(next); i++) {
      const player = next.game.players.find(player => player.id === getDecisionPlayerId(next.game))!;
      if (player.controller.type !== "computer") break;
      const result = applyGameAction(next, chooseAutomatedAction(next.game, player.controller.strategy, random));
      if (result.game === next.game) return { ...next, fastForward: false };
      const recap: ComputerRecap = { ...next.computerRecap!, decisions: next.computerRecap!.decisions + 1, damageTaken: { ...next.computerRecap!.damageTaken } };
      for (const effect of result.game.resolvedEffects ?? []) {
        if (effect.kind === "damage" && result.game.players.some(player => player.id === effect.playerId && player.controller.type === "human")) {
          recap.damageTaken[effect.playerId] = (recap.damageTaken[effect.playerId] ?? 0) + effect.amount;
        }
      }
      recap.eliminatedPlayerIds = [...new Set([...recap.eliminatedPlayerIds, ...result.eliminatedPlayerIds])];
      // Finishing the match clears its pending popup; retain that final event in the recap.
      // Black Market may discard events without resolving them, so check the resolved count.
      const resolvedEvents = (result.game.resolvedEventCount ?? 0) - (next.game.resolvedEventCount ?? 0);
      const events = result.game.pendingEventDialog ? [result.game.pendingEventDialog.card]
        : result.game.eventDiscardPile.slice(next.game.eventDiscardPile.length, next.game.eventDiscardPile.length + resolvedEvents);
      recap.eventIds = [...recap.eventIds, ...events.map(card => card.definitionId)];
      next = { ...result, computerRecap: recap };
      if (recap.decisions >= 1000) return { ...next, fastForward: false };
    }
    return { ...next, fastForward: canFastForward(next) };
  }
  if (action.type === "ACKNOWLEDGE_ELIMINATIONS") return { ...state, eliminatedPlayerIds: [] };
  return applyGameAction(state, action);
}

function applyGameAction(state: MatchPresentation, action: GameAction): MatchPresentation {
  const resetsMatch = action.type === "START_GAME" || action.type === "RESTART_GAME" || action.type === "RESET_GAME";
  // Event explanations take priority; their continuations can eliminate more players.
  if (state.eliminatedPlayerIds.length && !resetsMatch && action.type !== "ACKNOWLEDGE_EVENT_DIALOG") return state;
  const game = gameReducer(state.game, action);
  if (game === state.game) return state;
  if (resetsMatch) return createMatchPresentation(game);
  const previouslyLiving = new Set(state.game.players.filter(player => !player.eliminated).map(player => player.id));
  const eliminated = game.players.filter(player => player.eliminated && previouslyLiving.has(player.id));
  return { ...state, game, eliminatedPlayerIds: [...state.eliminatedPlayerIds, ...eliminated.map(player => player.id)] };
}
