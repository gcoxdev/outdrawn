import { Menu, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { allCards, deckSummary, eventDeckCards, mainDeckCards } from "../data/cards";
import { defaultGameSettings, type GameSettings } from "../data/constants";
import type { GameAction } from "../game/actions";
import { getCardImplementationNote, getCardImplementationStatus } from "../game/cardStatus";
import rulesText from "../../docs/current-rules.md?raw";

type MenuTab = "settings" | "rules" | "cards";
type NumericSettingKey = {
  [Key in keyof GameSettings]: GameSettings[Key] extends number ? Key : never;
}[keyof GameSettings];

type GameMenuProps = {
  settings: GameSettings;
  dispatch: (action: GameAction) => void;
  variant?: "floating" | "mobileIcon";
};

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
  { key: "actionsPerTurn", label: "Actions per turn", min: 1, max: 6 }
];

export function GameMenu({ settings, dispatch, variant = "floating" }: GameMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MenuTab>("settings");
  const cardsByType = useMemo(
    () =>
      allCards.reduce<Record<string, typeof allCards>>((groups, card) => {
        groups[card.type] = [...(groups[card.type] ?? []), card];
        return groups;
      }, {}),
    []
  );

  function updateSetting(key: NumericSettingKey, value: number) {
    const nextSettings = {
      ...settings,
      [key]: value
    };
    const normalized = {
      ...nextSettings,
      maxHealth: Math.max(nextSettings.maxHealth, nextSettings.startingHealth),
      maxHandSize: Math.max(nextSettings.maxHandSize, nextSettings.startingHandSize)
    };

    dispatch({ type: "UPDATE_SETTINGS", settings: normalized });
  }

  function updateBooleanSetting(key: "debugHandSnapshots" | "passDeviceMode", value: boolean) {
    dispatch({ type: "UPDATE_SETTINGS", settings: { ...settings, [key]: value } });
  }

  return (
    <>
      <button
        className={`menu-trigger ${variant === "mobileIcon" ? "menu-trigger--mobile-icon" : ""}`}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={18} />
        {variant === "floating" && "Menu"}
      </button>
      {isOpen && (
        <div className="menu-overlay" role="dialog" aria-modal="true" aria-label="Game menu">
          <button className="menu-backdrop" type="button" onClick={() => setIsOpen(false)} aria-label="Close menu" />
          <section className="menu-panel">
            <header className="menu-panel__header">
              <div>
                <p className="eyebrow">Reference</p>
                <h2>Game Menu</h2>
              </div>
              <button className="icon-command" type="button" onClick={() => setIsOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </header>

            <nav className="menu-tabs" aria-label="Menu sections">
              {(["settings", "rules", "cards"] as MenuTab[]).map((tab) => (
                <button className={activeTab === tab ? "is-active" : ""} key={tab} type="button" onClick={() => setActiveTab(tab)}>
                  {tab}
                </button>
              ))}
            </nav>

            {activeTab === "settings" && (
              <div className="menu-section settings-grid">
                <div className="menu-actions">
                  <button type="button" onClick={() => dispatch({ type: "RESET_GAME" })}>
                    <RotateCcw size={16} />
                    New Game
                  </button>
                  <button type="button" onClick={() => dispatch({ type: "UPDATE_SETTINGS", settings: defaultGameSettings })}>
                    <RotateCcw size={16} />
                    Reset Settings
                  </button>
                </div>
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
                <label className="setting-control setting-toggle">
                  <span>Pass device mode</span>
                  <input
                    type="checkbox"
                    checked={settings.passDeviceMode}
                    onChange={(event) => updateBooleanSetting("passDeviceMode", event.target.checked)}
                  />
                </label>
                {import.meta.env.DEV && (
                  <label className="setting-control setting-toggle">
                    <span>Debug hand snapshots</span>
                    <input
                      type="checkbox"
                      checked={settings.debugHandSnapshots}
                      onChange={(event) => updateBooleanSetting("debugHandSnapshots", event.target.checked)}
                    />
                  </label>
                )}
                <p className="menu-note">Settings are used when starting a new game. Max cards also affects the current discard-down check.</p>
              </div>
            )}

            {activeTab === "rules" && (
              <div className="menu-section rules-document">
                {rulesText.split("\n").map((line, index) => {
                  if (line.startsWith("# ")) {
                    return <h2 key={index}>{line.replace(/^# /, "")}</h2>;
                  }
                  if (line.startsWith("## ")) {
                    return <h3 key={index}>{line.replace(/^## /, "")}</h3>;
                  }
                  if (line.startsWith("- ")) {
                    return <p className="rule-bullet" key={index}>{line.replace(/^- /, "")}</p>;
                  }
                  return line.trim() ? <p key={index}>{line}</p> : null;
                })}
              </div>
            )}

            {activeTab === "cards" && (
              <div className="menu-section card-catalog">
                <div className="deck-summary">
                  <span>Main deck: {deckSummary.mainDeckTotal}</span>
                  <span>Event deck: {deckSummary.eventDeckTotal}</span>
                  <span>Definitions: {mainDeckCards.length + eventDeckCards.length}</span>
                </div>
                {Object.entries(cardsByType).map(([type, cards]) => (
                  <section className="catalog-group" key={type}>
                    <h3>{type}</h3>
                    <div className="catalog-list">
                      {cards.map((card) => {
                        const status = getCardImplementationStatus(card);
                        const implementationNote = getCardImplementationNote(card);
                        return (
                          <article className="catalog-card" key={card.id}>
                            <div>
                              <strong>{card.name}</strong>
                              <p>{card.rulesText}</p>
                              {implementationNote && <small>{implementationNote}</small>}
                            </div>
                            <div className="catalog-card__meta">
                              <span>x{card.count}</span>
                              {status !== "implemented" && <span className={`status-pill status-${status}`}>{status}</span>}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
