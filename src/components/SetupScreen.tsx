import { ArrowRight, Bot, Check, ChevronDown, ChevronLeft, ChevronRight, Layers, Minus, Plus, RotateCcw, Settings2, Shield, Users } from "lucide-react";
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
import { useCardBack } from "./CardBackPreference";
import "./SetupScreen.css";

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
  const { cardBack } = useCardBack();
  const [playerCount, setPlayerCount] = useState(4);
  const [playerCountDraft, setPlayerCountDraft] = useState("4");
  const [rosterPage, setRosterPage] = useState(0);
  const [bulkSkill, setBulkSkill] = useState<StrategyLevel>("competent");
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
  const currentPage = Math.min(rosterPage, Math.ceil(playerCount / visibleSetupRows) - 1);
  const pageStart = currentPage * visibleSetupRows;
  const displayedSlots = activeSlots.slice(pageStart, pageStart + visibleSetupRows);
  const humanCount = activePlayers.filter(player => player.controller.type === "human").length;
  const computerCount = playerCount - humanCount;
  const teamCount = new Set(activeTeams.filter(Boolean)).size;
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
    setPlayerCountDraft(String(nextPlayerCount));
    if (nextPlayerCount === playerCount) return;
    setPlayerCount(nextPlayerCount);
    setRosterPage(0);
    setSlots((current) => applyTeamsToSlots(ensureSlotCount(current, nextPlayerCount, bulkSkill), lobbyMode, nextPlayerCount));
  }

  function updateSlot(index: number, patch: Partial<SetupSlot>) {
    setSlots((current) => current.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)));
  }

  function setComputerSkillForAll(strategy: StrategyLevel) {
    setSlots((current) =>
      current.map((slot) => ({
        ...slot,
        control: slot.control === "human" ? slot.control : `computer:${strategy}`
      }))
    );
  }

  function fillComputers() {
    setSlots((current) =>
      current.map((slot, index) => ({
        ...slot,
        control: index === 0 ? "human" : `computer:${bulkSkill}`
      }))
    );
  }

  function numberSetting(key: NumericSettingKey) {
    const field = settingFields.find(field => field.key === key)!;
    return <label className="lobby-rule" key={key}>
      <span>{field.label}</span>
      <input type="number" min={field.min} max={field.max} value={settings[key]}
        onChange={event => updateSetting(key, Number(event.target.value))} />
    </label>;
  }

  return (
    <main className="setup-screen">
      <div className="lobby-shell">
        <header className="lobby-masthead">
          <img className="lobby-logo" src="/optimized/branding/logos/outdrawn-logo-dark-01.webp" alt="Outdrawn" width="260" height="84" />
          <div className="lobby-masthead__actions">
            <GameMenu settings={settings} dispatch={dispatch} phase="setup" />
          </div>
        </header>

        <section className="lobby-intro" aria-labelledby="lobby-title">
          <div>
            <h1 id="lobby-title">Last one standing.</h1>
            <p>Gather your opponents. Make every card count.</p>
          </div>
          <div className="lobby-card-fan" aria-hidden="true">
            <img src="/optimized/cards/fronts/defense/ai-review/final/defense-dodge-dark-01.webp" alt="" />
            <img src="/optimized/cards/fronts/weapons/ai-review/final/weapon-pistol-dark-01.webp" alt="" />
            <img src={cardBack.image} alt="" />
          </div>
        </section>

        <div className="lobby-layout">
          <section className="lobby-table lobby-panel" aria-labelledby="table-title">
            <header className="lobby-panel__heading">
              <div className="lobby-section-title"><Users size={18} /><h2 id="table-title">Set the table</h2></div>
              <span className="lobby-meta">{MIN_PLAYERS}–{MAX_PLAYERS} players</span>
            </header>
            <div className="lobby-table-options">
              <label className="lobby-field">
                <span id="game-mode-label">Game mode</span>
                <select aria-labelledby="game-mode-label" value={lobbyMode} onChange={event => updateLobbyMode(event.target.value as LobbyMode)}>
                  {lobbyModes.map(mode => <option key={mode} value={mode}>{labelLobbyMode(mode)}</option>)}
                </select>
              </label>
              <div className="lobby-field">
                <label htmlFor="player-count">Players</label>
                <div className="lobby-stepper">
                  <button type="button" aria-label="Remove a player" disabled={playerCount <= MIN_PLAYERS} onClick={() => updatePlayerCount(playerCount - 1)}><Minus size={15} /></button>
                  <input id="player-count" type="number" min={MIN_PLAYERS} max={MAX_PLAYERS} value={playerCountDraft}
                    onChange={event => {
                      const draft = event.target.value;
                      const count = Number(draft);
                      setPlayerCountDraft(draft);
                      if (Number.isInteger(count) && count >= MIN_PLAYERS && count <= MAX_PLAYERS) updatePlayerCount(count);
                    }}
                    onBlur={() => updatePlayerCount(Number(playerCountDraft))} />
                  <button type="button" aria-label="Add a player" disabled={playerCount >= MAX_PLAYERS} onClick={() => updatePlayerCount(playerCount + 1)}><Plus size={15} /></button>
                </div>
              </div>
            </div>

            <div className="lobby-roster-heading">
              <div><h3>Players</h3><p>{humanCount} human{humanCount === 1 ? "" : "s"} <span>·</span> {computerCount} computer{computerCount === 1 ? "" : "s"}</p></div>
              <button className="lobby-text-button" type="button" onClick={fillComputers}><Bot size={15} /> Fill with computers</button>
            </div>
            <div className="lobby-roster">
              {displayedSlots.map((slot, offset) => {
                const index = pageStart + offset;
                return <div className={`lobby-player${lobbyMode !== "ffa" ? " lobby-player--team" : ""}`} key={index}>
                  <span className={`lobby-seat${slot.control === "human" ? " lobby-seat--human" : ""}`} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <label className="lobby-field lobby-player__name"><span className="lobby-sr-only">Player {index + 1} name</span>
                    <input value={slot.name} maxLength={40} placeholder={`Player ${index + 1}`} onChange={event => updateSlot(index, { name: event.target.value })} />
                  </label>
                  <label className="lobby-field lobby-player__control"><span className="lobby-sr-only" id={`player-control-${index}-label`}>Player {index + 1} control</span>
                    <select aria-labelledby={`player-control-${index}-label`} value={slot.control} onChange={event => updateSlot(index, { control: event.target.value as ControlChoice })}>
                      <option value="human">Human</option>
                      <optgroup label="Computer">
                        {strategyLevels.map(level => <option key={level} value={`computer:${level}`}>{labelStrategy(level)}</option>)}
                      </optgroup>
                    </select>
                  </label>
                  {lobbyMode !== "ffa" && <label className="lobby-field lobby-player__team"><span className="lobby-sr-only" id={`player-team-${index}-label`}>Player {index + 1} team</span>
                    <select aria-labelledby={`player-team-${index}-label`} value={slot.teamId} onChange={event => updateSlot(index, { teamId: event.target.value })}>
                      {teamOptions.map(teamId => <option key={teamId} value={teamId}>{labelTeam(teamId)}</option>)}
                    </select>
                  </label>}
                </div>;
              })}
            </div>
            {playerCount > visibleSetupRows && <nav className="lobby-pagination" aria-label="Player pages">
              <span>{pageStart + 1}–{Math.min(playerCount, pageStart + visibleSetupRows)} of {playerCount}</span>
              <div><button type="button" aria-label="Previous players" disabled={currentPage === 0} onClick={() => setRosterPage(currentPage - 1)}><ChevronLeft size={18} /></button>
                <button type="button" aria-label="Next players" disabled={pageStart + visibleSetupRows >= playerCount} onClick={() => setRosterPage(currentPage + 1)}><ChevronRight size={18} /></button></div>
            </nav>}
            <div className="lobby-roster-footer">
              <label htmlFor="computer-level"><Bot size={15} /> Computer difficulty</label>
              <select id="computer-level" value={bulkSkill} onChange={event => {
                const skill = event.target.value as StrategyLevel;
                setBulkSkill(skill); setComputerSkillForAll(skill);
              }}>{strategyLevels.map(level => <option key={level} value={level}>{labelStrategy(level)}</option>)}</select>
            </div>
          </section>

          <aside className="lobby-rules lobby-panel" aria-labelledby="rules-title">
            <header className="lobby-panel__heading">
              <div className="lobby-section-title"><Settings2 size={18} /><h2 id="rules-title">Match rules</h2></div>
              <button className="lobby-reset" type="button" aria-label="Reset match rules" title="Reset match rules" onClick={() => dispatch({ type: "UPDATE_SETTINGS", settings: defaultGameSettings })}><RotateCcw size={15} /></button>
            </header>
            <div className="lobby-core-rules">
              {numberSetting("startingHealth")}
              {numberSetting("actionsPerTurn")}
              {numberSetting("startingHandSize")}
              {numberSetting("maxHandSize")}
            </div>
            <details className="lobby-disclosure">
              <summary><span><Settings2 size={15} /> Advanced rules</span><ChevronDown size={16} /></summary>
              <div className="lobby-disclosure__body">
                {numberSetting("maxHealth")}{numberSetting("freeDrawsPerTurn")}{numberSetting("eliminationHealthReward")}
                <label className="lobby-rule"><span id="turn-order-label">Turn order</span><select aria-labelledby="turn-order-label" value={settings.turnOrder} onChange={event => updateTurnOrder(event.target.value as TurnOrderMode)}><option value="roundRobin">Round robin</option><option value="standard">Rotating start</option></select></label>
                <label className="lobby-toggle"><span>Defense on secondary attacks</span><input type="checkbox" checked={settings.allowSecondaryDefense} onChange={event => updateBooleanSetting("allowSecondaryDefense", event.target.checked)} /><span className="lobby-switch" aria-hidden="true" /></label>
              </div>
            </details>
            {lobbyMode !== "ffa" && <div className="lobby-team-rules">
              <label className="lobby-toggle"><span>Teammate healing</span><input type="checkbox" checked={settings.allowTeamHealing} onChange={event => updateBooleanSetting("allowTeamHealing", event.target.checked)} /><span className="lobby-switch" aria-hidden="true" /></label>
              <label className="lobby-toggle"><span>Card transfer</span><input type="checkbox" checked={settings.allowTeamCardTransfer} onChange={event => updateBooleanSetting("allowTeamCardTransfer", event.target.checked)} /><span className="lobby-switch" aria-hidden="true" /></label>
            </div>}
            <details className="lobby-disclosure lobby-disclosure--market">
              <summary><span><Layers size={15} /> Black Market <small>{labelBlackMarketPreset(settings.blackMarketPreset)}</small></span><ChevronDown size={16} /></summary>
              <div className="lobby-disclosure__body">
                <label className="lobby-field"><span id="market-preset-label">Market preset</span><select aria-labelledby="market-preset-label" value={settings.blackMarketPreset} onChange={event => updateBlackMarketPreset(event.target.value as BlackMarketPreset)}>
                  {Object.keys(blackMarketPresets).map(preset => <option key={preset} value={preset}>{labelBlackMarketPreset(preset as BlackMarketPreset)}</option>)}
                </select></label>
                <p className="lobby-market-note">{summarizeBlackMarket(blackMarketConfig)}</p>
                {settings.blackMarketPreset === "custom" && <div className="lobby-market-custom">
                  {([{ key: "discardCost", label: "Discard", min: 0, max: 6 }, { key: "healthCost", label: "Health", min: 0, max: 20 }, { key: "revealCount", label: "Reveal", min: 1, max: 10 }, { key: "keepCount", label: "Keep", min: 1, max: blackMarketConfig.revealCount }] as const).map(field =>
                    <label className="lobby-field" key={field.key}><span>{field.label}</span><input type="number" min={field.min} max={field.max} value={settings.blackMarketCustom[field.key]} onChange={event => updateBlackMarketCustom(field.key, Number(event.target.value))} /></label>
                  )}
                </div>}
              </div>
            </details>
            <div className="lobby-rule-note"><Shield size={16} /><p>{humanCount > 1 ? "Pass-device privacy turns on when your match starts." : "Play against the computer, or add humans to share this device."}</p></div>
          </aside>
        </div>

        <footer className="lobby-launch">
          <div className="lobby-launch__summary">
            {teamModeValidation.isValid ? <><span className="lobby-ready"><Check size={14} /> Ready to play</span><p>{playerCount} players <span>·</span> {labelLobbyMode(lobbyMode)}{lobbyMode !== "ffa" ? ` · ${teamCount} teams` : ""}</p></>
              : <p className="lobby-validation" role="alert">{teamModeValidation.message}</p>}
          </div>
          <button className="lobby-start" type="button" disabled={!teamModeValidation.isValid} onClick={() => onStart(activePlayers)}>Start Game <ArrowRight size={19} /></button>
        </footer>
      </div>
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

function ensureSlotCount(slots: SetupSlot[], count: number, strategy: StrategyLevel = "competent"): SetupSlot[] {
  if (slots.length >= count) {
    return slots;
  }

  return [
    ...slots,
    ...Array.from({ length: count - slots.length }, (_, offset) => {
      const index = slots.length + offset;
      return {
        name: getDefaultPlayerName(index),
        control: `computer:${strategy}` as const
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
