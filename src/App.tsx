import { useEffect, useReducer, useRef, useState } from "react";
import { GameTable } from "./components/GameTable";
import { MatchRecovery, preserveRejectedMatch } from "./components/MatchRecovery";
import { SetupScreen } from "./components/SetupScreen";
import { defaultGameSettings } from "./data/constants";
import { readSavedMatch, saveGame } from "./game/persistence";
import { createMatchPresentation, matchPresentationReducer } from "./game/matchPresentation";
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
  const [boot] = useState(() => { try { return readSavedMatch(initialState, window.localStorage); } catch { return { state: initialState }; } });
  const [rejected, setRejected] = useState(boot.rejected);
  const [{ game: state, eliminatedPlayerIds }, dispatch] = useReducer(matchPresentationReducer, boot.state, createMatchPresentation);
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => {
    if (rejected) return;
    try { setSaveFailed(!saveGame(state, window.localStorage)); } catch { setSaveFailed(true); }
  }, [state, rejected]);
  const [paused, setPaused] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [computerDelay, setComputerDelay] = useState(500);
  const aiRandom = useRef(createRng(Date.now()));

  useEffect(() => {
    if (state.phase !== "action" || state.pendingEventDialog || eliminatedPlayerIds.length || paused || referenceOpen || rejected) {
      return;
    }

    const decisionPlayer = state.players.find((player) => player.id === getDecisionPlayerId(state));
    if (!decisionPlayer || decisionPlayer.controller.type !== "computer") {
      return;
    }

    const strategy = decisionPlayer.controller.strategy;
    const timeoutId = window.setTimeout(() => {
      dispatch(chooseAutomatedAction(state, strategy, aiRandom.current));
    }, computerDelay);

    return () => window.clearTimeout(timeoutId);
  }, [state, eliminatedPlayerIds, paused, referenceOpen, computerDelay, rejected]);

  if (rejected) return <MatchRecovery raw={rejected} onReset={() => { preserveRejectedMatch(rejected); setRejected(undefined); }} />;

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

  return <GameTable state={state} dispatch={dispatch} eliminatedPlayerIds={eliminatedPlayerIds} onEliminationsAcknowledged={() => dispatch({ type: "ACKNOWLEDGE_ELIMINATIONS" })} saveFailed={saveFailed} paused={paused} onPausedChange={setPaused} computerDelay={computerDelay} onComputerDelayChange={setComputerDelay} onReferenceOpenChange={setReferenceOpen} />;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
