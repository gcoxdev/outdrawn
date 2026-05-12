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
import { labelTeam } from "../game/rules";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  assignTeamsForMode,
  clampPlayerCount,
  getDefaultPlayerName,
  getTeamModeValidation as getScalableTeamModeValidation,
  getTeamOptionsForMode,
  labelLobbyMode,
  type LobbyMode
} from "../game/setupOptions";
import type { PlayerSetup, StrategyLevel, TeamId } from "../game/types";
import { GameMenu } from "./GameMenu";

type SetupScreenProps = {
  settings: GameSettings;
  dispatch: (action: GameAction) => void;
  onStart: (players: PlayerSetup[]) => void;
};

const strategyLevels: StrategyLevel[] = ["beginner", "novice", "competent", "expert", "master"];
type ControlChoice = "human" | `computer:${StrategyLevel}`;
type LegacyLobbyMode = "2v2" | "2v2v2" | "3v3";
type SetupSlot = {
  name: string;
  control: ControlChoice;
  teamId?: TeamId;
};
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
  { key: "freeDrawsPerTurn", label: "Free draws per turn", min: 0, max: 10 },
  { key: "eliminationHealthReward", label: "Health reward on elimination", min: 0, max: 20 }
];
const lobbyModes: LobbyMode[] = ["ffa", "duos", "trios", "squads", "twoTeams", "custom"];
const visibleSetupRows = 20;

export function SetupScreen({ settings, dispatch, onStart }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState(4);
  const [lobbyMode, setLobbyMode] = useState<LobbyMode>("ffa");
  const [slots, setSlots] = useState<SetupSlot[]>(() => createSlots(4, "ffa"));
  const activeSlots = useMemo(() => slots.slice(0, playerCount), [playerCount, slots]);
  const activePlayers = useMemo<PlayerSetup[]>(
    () =>
      activeSlots.map((slot) => ({
        name: slot.name,
        controller: controlToController(slot.control),
        teamId: lobbyMode === "ffa" ? undefined : slot.teamId
      })),
    [activeSlots, lobbyMode]
  );
  const activeTeams = useMemo(() => activeSlots.map((slot) => slot.teamId ?? ""), [activeSlots]);
  const teamOptions = useMemo(() => getTeamOptionsForMode(lobbyMode, playerCount), [lobbyMode, playerCount]);
  const teamModeValidation = getTeamModeValidation(lobbyMode, activeTeams, playerCount);
  const displayedSlots = activeSlots.slice(0, visibleSetupRows);
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
    setSlots((current) => applyTeamsToSlots(ensureSlotCount(current, playerCount), value, playerCount));
  }

  function updatePlayerCount(value: number) {
    const nextPlayerCount = clampPlayerCount(value);
    setPlayerCount(nextPlayerCount);
    setSlots((current) => applyTeamsToSlots(ensureSlotCount(current, nextPlayerCount), lobbyMode, nextPlayerCount));
  }

  function updateSlot(index: number, patch: Partial<SetupSlot>) {
    setSlots((current) => current.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)));
  }

  function setComputerSkillForAll(strategy: StrategyLevel) {
    setSlots((current) =>
      current.map((slot, index) => ({
        ...slot,
        control: index === 0 && slot.control === "human" ? slot.control : `computer:${strategy}`
      }))
    );
  }

  function fillComputers() {
    setSlots((current) =>
      current.map((slot, index) => ({
        ...slot,
        control: index === 0 ? "human" : "computer:competent"
      }))
    );
  }

  return (
    <main className="setup-screen">
      <GameMenu settings={settings} dispatch={dispatch} phase="setup" />
      <section className="setup-screen__panel">
        <h1 className="setup-screen__logo-title">
          <img src="/branding/logos/outdrawn-logo-dark-01.png" alt="Outdrawn" />
        </h1>

        <div className="lobby-grid">
          <section className="lobby-section lobby-section--players">
            <div className="lobby-section__header">
              <p className="eyebrow">Player Configuration</p>
              <div className="lobby-player-controls">
                <label className="field">
                  <span>Mode</span>
                  <select value={lobbyMode} onChange={(event) => updateLobbyMode(event.target.value as LobbyMode)}>
                    {lobbyModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {labelLobbyMode(mode)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field lobby-player-count">
                  <span>Players</span>
                  <input
                    type="number"
                    min={MIN_PLAYERS}
                    max={MAX_PLAYERS}
                    value={playerCount}
                    onChange={(event) => updatePlayerCount(Number(event.target.value))}
                  />
                </label>
              </div>
            </div>
            <div className="lobby-bulk-actions">
              <button type="button" onClick={fillComputers}>Fill Computers</button>
              <button type="button" onClick={() => setComputerSkillForAll("competent")}>All Competent</button>
              <button type="button" onClick={() => setComputerSkillForAll("master")}>All Master</button>
            </div>
            {activeSlots.length > visibleSetupRows && (
              <p className="setup-list-note">
                Showing first {visibleSetupRows} players. Remaining slots use generated names, controls, and teams.
              </p>
            )}
            <div className="setup-screen__names">
              {displayedSlots.map((slot, index) => (
                <div className={lobbyMode === "ffa" ? "setup-player" : "setup-player setup-player--team"} key={index}>
                  <label className="field">
                    <span>Player {index + 1}</span>
                    <input
                      value={slot.name}
                      onChange={(event) => updateSlot(index, { name: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Control</span>
                    <select
                      value={slot.control}
                      onChange={(event) => updateSlot(index, { control: event.target.value as ControlChoice })}
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
                        value={slot.teamId}
                        onChange={(event) => updateSlot(index, { teamId: event.target.value })}
                      >
                        {teamOptions.map((teamId) => (
                          <option key={teamId} value={teamId}>
                            {labelTeam(teamId)}
                          </option>
                        ))}
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

        {!teamModeValidation.isValid && <p className="setup-validation-message">{teamModeValidation.message}</p>}
        <button className="primary-command" type="button" disabled={!teamModeValidation.isValid} onClick={() => onStart(activePlayers)}>
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

export function getTeamModeValidation(
  lobbyMode: LobbyMode | LegacyLobbyMode,
  teams: TeamId[],
  playerCount: number
): { isValid: true; message?: undefined } | { isValid: false; message: string } {
  if (lobbyMode === "duos" || lobbyMode === "trios" || lobbyMode === "squads" || lobbyMode === "twoTeams" || lobbyMode === "custom") {
    return getScalableTeamModeValidation(lobbyMode, teams, playerCount);
  }

  if (lobbyMode === "ffa") {
    return { isValid: true };
  }

  const requiredCounts: Record<LegacyLobbyMode, Partial<Record<TeamId, number>>> = {
    "2v2": { team_a: 2, team_b: 2 },
    "2v2v2": { team_a: 2, team_b: 2, team_c: 2 },
    "3v3": { team_a: 3, team_b: 3 }
  };
  const expectedCounts = requiredCounts[lobbyMode];
  const activeTeams = teams.slice(0, playerCount);
  const hasExactTeams = Object.entries(expectedCounts).every(
    ([teamId, expectedCount]) => activeTeams.filter((team) => team === teamId).length === expectedCount
  );
  const hasNoExtraTeams = activeTeams.every((team) => team in expectedCounts);

  if (hasExactTeams && hasNoExtraTeams) {
    return { isValid: true };
  }

  const countValues = Object.values(expectedCounts).filter((count): count is number => typeof count === "number");
  const teamsText = formatList(Object.keys(expectedCounts).map((teamId) => labelTeam(teamId as TeamId)));
  const requirementText =
    countValues.length > 0 && countValues.every((count) => count === countValues[0])
      ? `${countValues[0]} players each on ${teamsText}`
      : formatList(
          Object.entries(expectedCounts)
            .filter((entry): entry is [string, number] => typeof entry[1] === "number")
            .map(([teamId, expectedCount]) => `${expectedCount} player${expectedCount === 1 ? "" : "s"} on ${labelTeam(teamId as TeamId)}`)
        );

  return {
    isValid: false,
    message: `${lobbyMode} requires ${requirementText}.`
  };
}

function createSlots(count: number, lobbyMode: LobbyMode): SetupSlot[] {
  return applyTeamsToSlots(
    Array.from({ length: count }, (_, index) => ({
      name: getDefaultPlayerName(index),
      control: index === 0 ? "human" : "computer:competent"
    })),
    lobbyMode,
    count
  );
}

function ensureSlotCount(slots: SetupSlot[], count: number): SetupSlot[] {
  if (slots.length >= count) {
    return slots;
  }

  return [
    ...slots,
    ...Array.from({ length: count - slots.length }, (_, offset) => {
      const index = slots.length + offset;
      return {
        name: getDefaultPlayerName(index),
        control: "computer:competent" as const
      };
    })
  ];
}

function applyTeamsToSlots(slots: SetupSlot[], lobbyMode: LobbyMode, playerCount: number): SetupSlot[] {
  const assignedTeams = assignTeamsForMode(lobbyMode, playerCount);
  return slots.map((slot, index) => ({
    ...slot,
    teamId: lobbyMode === "ffa" ? undefined : (assignedTeams[index] ?? slot.teamId)
  }));
}

function formatList(values: string[]): string {
  if (values.length <= 2) {
    return values.join(" and ");
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function labelStrategy(strategy: StrategyLevel): string {
  return strategy[0].toUpperCase() + strategy.slice(1);
}

function labelBlackMarketPreset(preset: BlackMarketPreset): string {
  const labels: Record<BlackMarketPreset, string> = {
    standard: "Standard",
    discount: "Discount Market",
    bigger: "Bigger Market",
    healthPay: "Health-Pay Market",
    custom: "Custom"
  };

  return labels[preset];
}

function summarizeBlackMarket(config: BlackMarketConfig): string {
  const risks = [
    config.discardCost > 0 ? `discard ${config.discardCost} card${config.discardCost === 1 ? "" : "s"}` : null,
    config.healthCost > 0 ? `pay ${config.healthCost} health` : null
  ].filter(Boolean);
  const riskText = risks.length > 0 ? risks.join(", ") : "none";

  return `Risk: ${riskText}. Reward: reveal ${config.revealCount}, keep ${config.keepCount}.`;
}
