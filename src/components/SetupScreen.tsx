import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import {
  blackMarketPresets,
  defaultGameSettings,
  type BlackMarketConfig,
  type BlackMarketPreset,
  type GameSettings,
  type TurnOrderMode
} from "../data/constants";
import type { GameAction } from "../game/actions";
import type { PlayerSetup, StrategyLevel, TeamId } from "../game/types";
import { GameMenu } from "./GameMenu";

type SetupScreenProps = {
  settings: GameSettings;
  dispatch: (action: GameAction) => void;
  onStart: (players: PlayerSetup[]) => void;
};

const strategyLevels: StrategyLevel[] = ["beginner", "novice", "competent", "expert", "master"];
type ControlChoice = "human" | `computer:${StrategyLevel}`;
type LobbyMode = "ffa" | "2v2" | "3v3";
type NumericSettingKey = {
  [Key in keyof GameSettings]: GameSettings[Key] extends number ? Key : never;
}[keyof GameSettings];

const settingFields: Array<{
  key: NumericSettingKey;
  label: string;
  min: number;
  max: number;
}> = [
  { key: "startingHealth", label: "Starting health", min: 1, max: 100 },
  { key: "maxHealth", label: "Max health", min: 1, max: 100 },
  { key: "startingHandSize", label: "Starting hand size", min: 1, max: 15 },
  { key: "maxHandSize", label: "Max cards in hand", min: 1, max: 20 },
  { key: "actionsPerTurn", label: "Actions per turn", min: 1, max: 6 },
  { key: "eliminationHealthReward", label: "Health reward on elimination", min: 0, max: 20 }
];

export function SetupScreen({ settings, dispatch, onStart }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState(4);
  const [lobbyMode, setLobbyMode] = useState<LobbyMode>("ffa");
  const [names, setNames] = useState(["Ari", "Blake", "Casey", "Devon", "Eli", "Finn"]);
  const [controls, setControls] = useState<ControlChoice[]>([
    "human",
    "computer:competent",
    "computer:competent",
    "computer:competent",
    "computer:competent",
    "computer:competent"
  ]);
  const [teams, setTeams] = useState<TeamId[]>(["team_a", "team_b", "team_a", "team_b", "team_a", "team_b"]);
  const activeNames = useMemo(() => names.slice(0, playerCount), [names, playerCount]);
  const activePlayers = useMemo<PlayerSetup[]>(
    () =>
      activeNames.map((name, index) => ({
        name,
        controller: controlToController(controls[index]),
        teamId: lobbyMode === "ffa" ? undefined : teams[index]
      })),
    [activeNames, controls, lobbyMode, teams]
  );
  const blackMarketConfig = settings.blackMarketPreset === "custom" ? settings.blackMarketCustom : blackMarketPresets[settings.blackMarketPreset];

  function updateSetting(key: NumericSettingKey, value: number) {
    const field = settingFields.find((candidate) => candidate.key === key);
    const boundedValue = field ? Math.min(field.max, Math.max(field.min, value)) : value;
    const nextSettings = {
      ...settings,
      [key]: boundedValue
    };
    const normalized = {
      ...nextSettings,
      maxHealth: Math.max(nextSettings.maxHealth, nextSettings.startingHealth),
      maxHandSize: Math.max(nextSettings.maxHandSize, nextSettings.startingHandSize)
    };

    dispatch({ type: "UPDATE_SETTINGS", settings: normalized });
  }

  function updateTurnOrder(value: TurnOrderMode) {
    dispatch({ type: "UPDATE_SETTINGS", settings: { ...settings, turnOrder: value } });
  }

  function updateBooleanSetting(key: "allowSecondaryDefense" | "allowTeamHealing" | "allowTeamCardTransfer", value: boolean) {
    dispatch({ type: "UPDATE_SETTINGS", settings: { ...settings, [key]: value } });
  }

  function updateBlackMarketPreset(value: BlackMarketPreset) {
    dispatch({ type: "UPDATE_SETTINGS", settings: { ...settings, blackMarketPreset: value } });
  }

  function updateBlackMarketCustom(key: keyof BlackMarketConfig, value: number) {
    dispatch({
      type: "UPDATE_SETTINGS",
      settings: {
        ...settings,
        blackMarketPreset: "custom",
        blackMarketCustom: {
          ...settings.blackMarketCustom,
          [key]: value
        }
      }
    });
  }

  function updateLobbyMode(value: LobbyMode) {
    setLobbyMode(value);
    if (value === "2v2") {
      setPlayerCount(4);
    } else if (value === "3v3") {
      setPlayerCount(6);
    }
  }

  return (
    <main className="setup-screen">
      <GameMenu settings={settings} dispatch={dispatch} />
      <section className="setup-screen__panel">
        <h1>Outdrawn</h1>

        <div className="lobby-grid">
          <section className="lobby-section lobby-section--players">
            <div className="lobby-section__header">
              <p className="eyebrow">Player Configuration</p>
              <div className="lobby-player-controls">
                <label className="field">
                  <span>Mode</span>
                  <select value={lobbyMode} onChange={(event) => updateLobbyMode(event.target.value as LobbyMode)}>
                    <option value="ffa">Free-for-all</option>
                    <option value="2v2">2v2 Teams</option>
                    <option value="3v3">3v3 Teams</option>
                  </select>
                </label>
                <label className="field lobby-player-count">
                  <span>Players</span>
                  <select
                    value={playerCount}
                    onChange={(event) => setPlayerCount(Number(event.target.value))}
                    disabled={lobbyMode !== "ffa"}
                  >
                    {(lobbyMode === "3v3" ? [6] : lobbyMode === "2v2" ? [4] : [3, 4, 5, 6]).map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="setup-screen__names">
              {activeNames.map((name, index) => (
                <div className={lobbyMode === "ffa" ? "setup-player" : "setup-player setup-player--team"} key={index}>
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
                      value={controls[index]}
                      onChange={(event) =>
                        setControls((current) =>
                          current.map((control, controlIndex) => (controlIndex === index ? (event.target.value as ControlChoice) : control))
                        )
                      }
                    >
                      <option value="human">Human</option>
                      {strategyLevels.map((level) => (
                        <option key={level} value={`computer:${level}`}>
                          Computer - {labelStrategy(level)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {lobbyMode !== "ffa" && (
                    <label className="field">
                      <span>Team</span>
                      <select
                        value={teams[index]}
                        onChange={(event) =>
                          setTeams((current) => current.map((team, teamIndex) => (teamIndex === index ? (event.target.value as TeamId) : team)))
                        }
                      >
                        <option value="team_a">Team A</option>
                        <option value="team_b">Team B</option>
                      </select>
                    </label>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="lobby-settings-column">
            <section className="lobby-section">
              <div className="lobby-section__header">
                <p className="eyebrow">Game Settings</p>
                <button className="secondary-command lobby-reset-command" type="button" onClick={() => dispatch({ type: "UPDATE_SETTINGS", settings: defaultGameSettings })}>
                  <RotateCcw size={16} />
                  Reset Settings
                </button>
              </div>
              <div className="settings-grid lobby-settings-grid">
                {settingFields.map((field) => (
                  <label className="setting-control" key={field.key}>
                    <span>{field.label}</span>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      value={settings[field.key]}
                      onChange={(event) => updateSetting(field.key, Number(event.target.value))}
                    />
                  </label>
                ))}
                <label className="setting-control">
                  <span>Turn order</span>
                  <select value={settings.turnOrder} onChange={(event) => updateTurnOrder(event.target.value as TurnOrderMode)}>
                    <option value="standard">Standard</option>
                    <option value="roundRobin">Round robin</option>
                  </select>
                </label>
                <label className="setting-control setting-toggle">
                  <span>Defense on secondary attacks</span>
                  <input
                    type="checkbox"
                    checked={settings.allowSecondaryDefense}
                    onChange={(event) => updateBooleanSetting("allowSecondaryDefense", event.target.checked)}
                  />
                </label>
                {lobbyMode !== "ffa" && (
                  <>
                    <label className="setting-control setting-toggle">
                      <span>Teammate healing</span>
                      <input
                        type="checkbox"
                        checked={settings.allowTeamHealing}
                        onChange={(event) => updateBooleanSetting("allowTeamHealing", event.target.checked)}
                      />
                    </label>
                    <label className="setting-control setting-toggle">
                      <span>Card transfer</span>
                      <input
                        type="checkbox"
                        checked={settings.allowTeamCardTransfer}
                        onChange={(event) => updateBooleanSetting("allowTeamCardTransfer", event.target.checked)}
                      />
                    </label>
                  </>
                )}
                <div className="setting-control setting-control--wide market-control">
                  <label>
                    <span>Black Market</span>
                    <select value={settings.blackMarketPreset} onChange={(event) => updateBlackMarketPreset(event.target.value as BlackMarketPreset)}>
                      {Object.keys(blackMarketPresets).map((preset) => (
                        <option key={preset} value={preset}>
                          {labelBlackMarketPreset(preset as BlackMarketPreset)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="market-summary">
                    <p>{summarizeBlackMarket(blackMarketConfig)}</p>
                  </div>
                </div>
                {settings.blackMarketPreset === "custom" && (
                  <div className="setting-control setting-control--wide">
                    <span>Custom Black Market</span>
                    <div className="market-custom-grid">
                      <label>
                        <span>Actions</span>
                        <input
                          type="number"
                          min={0}
                          max={4}
                          value={settings.blackMarketCustom.actionCost}
                          onChange={(event) => updateBlackMarketCustom("actionCost", Number(event.target.value))}
                        />
                      </label>
                      <label>
                        <span>Discard</span>
                        <input
                          type="number"
                          min={0}
                          max={6}
                          value={settings.blackMarketCustom.discardCost}
                          onChange={(event) => updateBlackMarketCustom("discardCost", Number(event.target.value))}
                        />
                      </label>
                      <label>
                        <span>Health</span>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={settings.blackMarketCustom.healthCost}
                          onChange={(event) => updateBlackMarketCustom("healthCost", Number(event.target.value))}
                        />
                      </label>
                      <label>
                        <span>Reveal</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={settings.blackMarketCustom.revealCount}
                          onChange={(event) => updateBlackMarketCustom("revealCount", Number(event.target.value))}
                        />
                      </label>
                      <label>
                        <span>Keep</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={settings.blackMarketCustom.keepCount}
                          onChange={(event) => updateBlackMarketCustom("keepCount", Number(event.target.value))}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <button className="primary-command" type="button" onClick={() => onStart(activePlayers)}>
          Start Game
        </button>
      </section>
    </main>
  );
}

function controlToController(control: ControlChoice): PlayerSetup["controller"] {
  if (control === "human") {
    return { type: "human" };
  }

  return {
    type: "computer",
    strategy: control.replace("computer:", "") as StrategyLevel
  };
}

function labelStrategy(strategy: StrategyLevel): string {
  return strategy[0].toUpperCase() + strategy.slice(1);
}

function labelBlackMarketPreset(preset: BlackMarketPreset): string {
  const labels: Record<BlackMarketPreset, string> = {
    standard: "Standard",
    discount: "Discount Market",
    noAction: "No-Action Market",
    bigger: "Bigger Market",
    healthPay: "Health-Pay Market",
    custom: "Custom"
  };

  return labels[preset];
}

function summarizeBlackMarket(config: BlackMarketConfig): string {
  const risks = [
    config.actionCost > 0 ? `${config.actionCost} action${config.actionCost === 1 ? "" : "s"}` : null,
    config.discardCost > 0 ? `discard ${config.discardCost} card${config.discardCost === 1 ? "" : "s"}` : null,
    config.healthCost > 0 ? `pay ${config.healthCost} health` : null
  ].filter(Boolean);
  const riskText = risks.length > 0 ? risks.join(", ") : "none";

  return `Risk: ${riskText}. Reward: reveal ${config.revealCount}, keep ${config.keepCount}.`;
}
