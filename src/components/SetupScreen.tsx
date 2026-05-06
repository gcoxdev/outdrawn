import { useMemo, useState } from "react";
import type { GameSettings } from "../data/constants";
import type { GameAction } from "../game/actions";
import { GameMenu } from "./GameMenu";

type SetupScreenProps = {
  settings: GameSettings;
  dispatch: (action: GameAction) => void;
  onStart: (names: string[]) => void;
};

export function SetupScreen({ settings, dispatch, onStart }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState(3);
  const [names, setNames] = useState(["Ari", "Blake", "Casey", "Devon", "Eli", "Finn"]);
  const activeNames = useMemo(() => names.slice(0, playerCount), [names, playerCount]);

  return (
    <main className="setup-screen">
      <GameMenu settings={settings} dispatch={dispatch} />
      <section className="setup-screen__panel">
        <p className="eyebrow">Hot-seat prototype</p>
        <h1>Last Hand Standing</h1>
        <p className="setup-screen__copy">
          Start a local battle royale card match for 3-6 players. Only the active player&apos;s hand is shown.
        </p>
        <label className="field">
          <span>Players</span>
          <select value={playerCount} onChange={(event) => setPlayerCount(Number(event.target.value))}>
            {[3, 4, 5, 6].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        <div className="setup-screen__names">
          {activeNames.map((name, index) => (
            <label className="field" key={index}>
              <span>Player {index + 1}</span>
              <input
                value={name}
                onChange={(event) =>
                  setNames((current) => current.map((candidate, nameIndex) => (nameIndex === index ? event.target.value : candidate)))
                }
              />
            </label>
          ))}
        </div>
        <button className="primary-command" type="button" onClick={() => onStart(activeNames)}>
          Start Game
        </button>
      </section>
    </main>
  );
}
