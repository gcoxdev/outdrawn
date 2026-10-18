import { useEffect, useReducer, useRef, useState } from "react";
import { GameTable } from "./components/GameTable";
import { MatchRecovery, preserveRejectedMatch } from "./components/MatchRecovery";
import { SetupScreen } from "./components/SetupScreen";
import { createSetupState } from "./game/setup";
import { readSavedMatch, saveGame } from "./game/persistence";
import { canFastForward, createMatchPresentation, matchPresentationReducer } from "./game/matchPresentation";
import { chooseAutomatedAction, getDecisionPlayerId } from "./game/simulator";
import type { PlayerSetup } from "./game/types";

const initialState = createSetupState();

export default function App() {
  const [boot] = useState(() => { try { return readSavedMatch(initialState, window.localStorage); } catch { return { state: initialState }; } });
  const [rejected, setRejected] = useState(boot.rejected);
  const [presentation, dispatch] = useReducer(matchPresentationReducer, boot.state, createMatchPresentation);
  const { game: state, eliminatedPlayerIds, fastForward, computerRecap } = presentation;
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
    if (!fastForward) return;
    if (paused || referenceOpen || rejected) {
      dispatch({ type: "STOP_FAST_FORWARD" });
      return;
    }
    const timeoutId = window.setTimeout(() => dispatch({ type: "ADVANCE_COMPUTERS", seed: Math.floor(aiRandom.current() * 0x100000000) }), 0);
    return () => window.clearTimeout(timeoutId);
  }, [presentation, fastForward, paused, referenceOpen, rejected]);

  useEffect(() => {
    if (fastForward || computerRecap) return;
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
  }, [state, eliminatedPlayerIds, paused, referenceOpen, computerDelay, rejected, fastForward, computerRecap]);

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

  return <GameTable
    state={state}
    dispatch={dispatch}
    fastForward={fastForward}
    computerRecap={computerRecap}
    canSkipComputers={!paused && !referenceOpen && !computerRecap && canFastForward(presentation)}
    onSkipComputers={() => dispatch({ type: fastForward ? "STOP_FAST_FORWARD" : "START_FAST_FORWARD" })}
    onDismissRecap={() => dispatch({ type: "DISMISS_COMPUTER_RECAP" })}
    eliminatedPlayerIds={eliminatedPlayerIds}
    onEliminationsAcknowledged={() => dispatch({ type: "ACKNOWLEDGE_ELIMINATIONS" })}
    saveFailed={saveFailed}
    paused={paused}
    onPausedChange={setPaused}
    computerDelay={computerDelay}
    onComputerDelayChange={setComputerDelay}
    onReferenceOpenChange={setReferenceOpen}
  />;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
