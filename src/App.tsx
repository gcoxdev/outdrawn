import { useReducer } from "react";
import { GameTable } from "./components/GameTable";
import { SetupScreen } from "./components/SetupScreen";
import { defaultGameSettings } from "./data/constants";
import { gameReducer } from "./game/reducer";
import type { GameState } from "./game/types";

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
  pendingReaction: null,
  pendingDiscard: null,
  selectedCardId: null,
  attackBonuses: {},
  markedTargets: {},
  smokeProtectedPlayerIds: [],
  log: [],
  winnerId: null
};

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  if (state.phase === "setup") {
    return (
      <SetupScreen
        settings={state.settings}
        dispatch={dispatch}
        onStart={(playerNames) => dispatch({ type: "START_GAME", playerNames, settings: state.settings })}
      />
    );
  }

  return <GameTable state={state} dispatch={dispatch} />;
}
