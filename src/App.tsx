import { useReducer } from "react";
import { GameTable } from "./components/GameTable";
import { SetupScreen } from "./components/SetupScreen";
import { gameReducer } from "./game/reducer";
import type { GameState } from "./game/types";

const initialState: GameState = {
  phase: "setup",
  round: 0,
  players: [],
  currentPlayerIndex: 0,
  firstPlayerIndex: 0,
  mainDeck: [],
  eventDeck: [],
  discardPile: [],
  eventDiscardPile: [],
  activeEvent: null,
  selectedCardId: null,
  log: [],
  winnerId: null
};

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  if (state.phase === "setup") {
    return <SetupScreen onStart={(playerNames) => dispatch({ type: "START_GAME", playerNames })} />;
  }

  return <GameTable state={state} dispatch={dispatch} />;
}
