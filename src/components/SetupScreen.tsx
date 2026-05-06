import { useMemo, useState } from "react";
import type { GameSettings } from "../data/constants";
import type { GameAction } from "../game/actions";
import type { PlayerSetup, StrategyLevel } from "../game/types";
import { GameMenu } from "./GameMenu";

type SetupScreenProps = {
  settings: GameSettings;
  dispatch: (action: GameAction) => void;
  onStart: (players: PlayerSetup[]) => void;
};

const strategyLevels: StrategyLevel[] = ["beginner", "novice", "competent", "expert", "master"];

export function SetupScreen({ settings, dispatch, onStart }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState(3);
  const [names, setNames] = useState(["Ari", "Blake", "Casey", "Devon", "Eli", "Finn"]);
  const [controllers, setControllers] = useState<Array<"human" | "computer">>(["human", "computer", "computer", "computer", "computer", "computer"]);
  const [strategies, setStrategies] = useState<StrategyLevel[]>(["competent", "competent", "competent", "competent", "competent", "competent"]);
  const activeNames = useMemo(() => names.slice(0, playerCount), [names, playerCount]);
  const activePlayers = useMemo<PlayerSetup[]>(
    () =>
      activeNames.map((name, index) => ({
        name,
        controller:
          controllers[index] === "computer"
            ? {
                type: "computer",
                strategy: strategies[index]
              }
            : { type: "human" }
      })),
    [activeNames, controllers, strategies]
  );

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
            <div className="setup-player" key={index}>
              <label className="field">
                <span>Player {index + 1}</span>
                <input
                  value={name}
                  onChange={(event) =>
                    setNames((current) => current.map((candidate, nameIndex) => (nameIndex === index ? event.target.value : candidate)))
                  }
                />
              </label>
              <label className="field">
                <span>Control</span>
                <select
                  value={controllers[index]}
                  onChange={(event) =>
                    setControllers((current) =>
                      current.map((controller, controllerIndex) =>
                        controllerIndex === index ? (event.target.value as "human" | "computer") : controller
                      )
                    )
                  }
                >
                  <option value="human">Human</option>
                  <option value="computer">Computer</option>
                </select>
              </label>
              <label className="field">
                <span>Level</span>
                <select
                  disabled={controllers[index] !== "computer"}
                  value={strategies[index]}
                  onChange={(event) =>
                    setStrategies((current) =>
                      current.map((strategy, strategyIndex) => (strategyIndex === index ? (event.target.value as StrategyLevel) : strategy))
                    )
                  }
                >
                  {strategyLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>
        <button className="primary-command" type="button" onClick={() => onStart(activePlayers)}>
          Start Game
        </button>
      </section>
    </main>
  );
}
