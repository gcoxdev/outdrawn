import { useEffect, useReducer, useRef, useState } from "react";
import { GameTable } from "./components/GameTable";
import { SetupScreen } from "./components/SetupScreen";
import { defaultGameSettings } from "./data/constants";
import { loadGame, saveGame } from "./game/persistence";
import { gameReducer } from "./game/reducer";
import { chooseAutomatedAction, getDecisionPlayerId } from "./game/simulator";
import type { GameState, PlayerSetup } from "./game/types";

const initialState: GameState = {
  phase: "setup",
  settings: defaultGameSettings,
  round: 0,
  players: [],
  currentPlayerIndex: 0,
  firstPlayerIndex: 0,
  mainDeck: [],
  eventDeck: [],
  discardPile: [],
  eventDiscardPile: [],
  activeEvent: null,
  pendingEventDialog: null,
  pendingReaction: null,
  pendingRedirect: null,
  pendingAttackCost: null,
  pendingMultiHitAttack: null,
  pendingDiscard: null,
  pendingSearch: null,
  pendingSupplyDrop: null,
  pendingMarketSearch: null,
  pendingBlackMarket: null,
  pendingSteal: null,
  pendingSecondaryDamage: null,
  selectedCardId: null,
  attackBonuses: {},
  reloadPlayerIds: [],
  markedTargets: {},
  smokeProtectedPlayerIds: [],
  intimidations: {},
  log: [],
  winnerId: null,
  winnerTeamId: null
};

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState, fallback => {
    try { return loadGame(fallback, window.localStorage); } catch { return fallback; }
  });
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => {
    try { setSaveFailed(!saveGame(state, window.localStorage)); } catch { setSaveFailed(true); }
  }, [state]);
  const aiRandom = useRef(createRng(Date.now()));

  useEffect(() => {
    if (state.phase !== "action" || state.pendingEventDialog) {
      return;
    }

    const decisionPlayer = state.players.find((player) => player.id === getDecisionPlayerId(state));
    if (!decisionPlayer || decisionPlayer.controller.type !== "computer") {
      return;
    }

    const strategy = decisionPlayer.controller.strategy;
    const timeoutId = window.setTimeout(() => {
      dispatch(chooseAutomatedAction(state, strategy, aiRandom.current));
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [state]);

  if (state.phase === "setup") {
    return (
      <SetupScreen
        settings={state.settings}
        dispatch={dispatch}
        onStart={(playerSetups: PlayerSetup[]) => {
          const humanCount = playerSetups.filter((player) => player.controller.type === "human").length;
          dispatch({
            type: "START_GAME",
            playerNames: playerSetups.map((player) => player.name),
            playerSetups,
            settings: {
              ...state.settings,
              passDeviceMode: humanCount >= 2 ? true : state.settings.passDeviceMode
            }
          });
        }}
      />
    );
  }

  return <GameTable state={state} dispatch={dispatch} saveFailed={saveFailed} />;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
