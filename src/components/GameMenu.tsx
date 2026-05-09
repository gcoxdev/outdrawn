import { Home, Menu, X } from "lucide-react";
import { useMemo, useState } from "react";
import { allCards, deckSummary, eventDeckCards, mainDeckCards } from "../data/cards";
import type { GameSettings } from "../data/constants";
import type { GameAction } from "../game/actions";
import { getCardImplementationNote, getCardImplementationStatus } from "../game/cardStatus";
import rulesText from "../../docs/current-rules.md?raw";

type MenuTab = "settings" | "rules" | "cards";

type GameMenuProps = {
  settings: GameSettings;
  dispatch: (action: GameAction) => void;
  variant?: "floating" | "mobileIcon";
};

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

  function updateBooleanSetting(key: "debugHandSnapshots" | "passDeviceMode", value: boolean) {
    dispatch({ type: "UPDATE_SETTINGS", settings: { ...settings, [key]: value } });
  }

  function returnToLobby() {
    dispatch({ type: "RESET_GAME" });
    setIsOpen(false);
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

            <div className="menu-primary-action">
              <button type="button" onClick={returnToLobby}>
                <Home size={16} />
                Return to Lobby
              </button>
            </div>

            <nav className="menu-tabs" aria-label="Menu sections">
              {(["settings", "rules", "cards"] as MenuTab[]).map((tab) => (
                <button className={activeTab === tab ? "is-active" : ""} key={tab} type="button" onClick={() => setActiveTab(tab)}>
                  {tab}
                </button>
              ))}
            </nav>

            {activeTab === "settings" && (
              <div className="menu-section settings-grid">
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
                <p className="menu-note">Game setup is configured in the lobby before a match starts.</p>
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
                  <span>Main deck: {deckSummary.mainDeckTotal + deckSummary.eventDeckTotal}</span>
                  <span>Events: {deckSummary.eventDeckTotal}</span>
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
                          <article className={`catalog-card card-${card.type}`} key={card.id}>
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
