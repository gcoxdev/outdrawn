import { BookOpen, ChevronDown, Home, Layers, Maximize2, Menu, Plus, RotateCcw, Search, Settings2, Shield, X } from "lucide-react";
import { useId, useMemo, useState, useEffect, type KeyboardEvent } from "react";
import { allCards, deckSummary, type Card, type CardType } from "../data/cards";
import { blackMarketPresets, type GameSettings } from "../data/constants";
import type { GameAction } from "../game/actions";
import { getCardImplementationNote, getCardImplementationStatus } from "../game/cardStatus";
import type { GamePhase } from "../game/types";
import { PwaControls } from "./PwaControls";
import { Dialog } from "./Dialog";
import { CardPreview } from "./CardPreview";
import { CardView } from "./CardView";
import { cardBackOptions, useCardBack } from "./CardBackPreference";
import rulesText from "../../docs/current-rules.md?raw";
import "./GameMenu.css";

type MenuTab = "settings" | "rules" | "cards";
const menuTabs = [
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "rules", label: "Rules", icon: BookOpen },
  { id: "cards", label: "Cards", icon: Layers }
] as const;
const cardTypes: Array<{ id: CardType; label: string }> = [
  { id: "weapon", label: "Weapons" }, { id: "defense", label: "Defense" },
  { id: "ability", label: "Abilities" }, { id: "healing", label: "Healing" }, { id: "event", label: "Events" }
];
// Keep the full written rules as the source; card reference belongs in the Cards tab.
const ruleSections = rulesText.split(/^## /m).slice(1).map(section => {
  const [title, ...lines] = section.trim().split("\n");
  return { title, lines };
}).filter(section => !cardTypes.some(type => type.label === section.title));

type GameMenuProps = {
  settings: GameSettings;
  dispatch: (action: GameAction) => void;
  phase?: GamePhase;
  onOpenChange?: (open: boolean) => void;
  variant?: "floating" | "mobileIcon";
};

export function GameMenu({ settings, dispatch, phase = "setup", variant = "floating", onOpenChange }: GameMenuProps) {
  const menuId = useId();
  const { cardBack, selectCardBack } = useCardBack();
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => { onOpenChange?.(isOpen); return () => onOpenChange?.(false); }, [isOpen, onOpenChange]);
  const [activeTab, setActiveTab] = useState<MenuTab>("settings");
  const [cardSearch, setCardSearch] = useState("");
  const [cardType, setCardType] = useState<CardType | "all">("all");
  const [previewCard, setPreviewCard] = useState<Card | null>(null);
  const [confirmation, setConfirmation] = useState<"lobby" | "restart" | null>(null);
  const filteredCards = useMemo(() => {
    const query = cardSearch.trim().toLowerCase();
    return allCards.filter(card => (cardType === "all" || card.type === cardType)
      && `${card.name} ${card.rulesText}`.toLowerCase().includes(query));
  }, [cardSearch, cardType]);

  function updateBooleanSetting(key: "debugHandSnapshots" | "passDeviceMode", value: boolean) {
    dispatch({ type: "UPDATE_SETTINGS", settings: { ...settings, [key]: value } });
  }

  function closeMenu() {
    setPreviewCard(null);
    setConfirmation(null);
    setIsOpen(false);
  }

  function performMatchAction(action: "lobby" | "restart") {
    dispatch({ type: action === "lobby" ? "RESET_GAME" : "RESTART_GAME" });
    closeMenu();
  }

  function requestMatchAction(action: "lobby" | "restart") {
    if (phase === "action") setConfirmation(action);
    else performMatchAction(action);
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % menuTabs.length;
    else if (event.key === "ArrowLeft") next = (index + menuTabs.length - 1) % menuTabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = menuTabs.length - 1;
    else return;
    event.preventDefault();
    setActiveTab(menuTabs[next].id);
    document.getElementById(`${menuId}-${menuTabs[next].id}`)?.focus();
  }

  return (
    <>
      <button className={`menu-trigger ${variant === "mobileIcon" ? "menu-trigger--mobile-icon" : ""}`}
        type="button" onClick={() => setIsOpen(true)} aria-label="Open menu" aria-haspopup="dialog" aria-expanded={isOpen}>
        <Menu size={18} />
        {variant === "floating" && <span className="menu-trigger__label">Menu</span>}
      </button>
      {isOpen && (
        <Dialog className="menu-overlay" label="Game menu" onClose={closeMenu}>
          <button className="menu-backdrop" type="button" tabIndex={-1} aria-hidden="true" onClick={closeMenu} />
          <section className="menu-panel">
            <header className="menu-panel__header">
              <div className="menu-panel__title"><img src="/icons/outdrawn-app-192.png" alt="" width="30" height="30" /><h2>Game menu</h2></div>{phase === "action" && <small className="menu-pause-note">Computers paused</small>}
              <button className="menu-close" type="button" onClick={closeMenu} aria-label="Close menu"><X size={19} /></button>
            </header>

            <nav className="menu-tabs" role="tablist" aria-label="Menu sections">
              {menuTabs.map(({ id, label, icon: Icon }, index) => (
                <button className={activeTab === id ? "is-active" : ""} key={id} type="button" role="tab"
                  id={`${menuId}-${id}`} aria-selected={activeTab === id} aria-controls={`${menuId}-panel`}
                  tabIndex={activeTab === id ? 0 : -1} onClick={() => setActiveTab(id)} onKeyDown={event => navigateTabs(event, index)}>
                  <Icon size={16} />{label}
                </button>
              ))}
            </nav>

            <div className={`menu-section menu-section--${activeTab}`} key={activeTab} role="tabpanel"
              id={`${menuId}-panel`} aria-labelledby={`${menuId}-${activeTab}`} tabIndex={0}>
              {activeTab === "settings" && <>
                <section className="menu-preferences" aria-label="Preferences">
                  <label className="menu-toggle">
                    <span className="menu-toggle__copy"><span><Shield size={16} />Pass device mode</span><small id={`${menuId}-privacy-note`}>Hide hands when passing the device.</small></span>
                    <input type="checkbox" aria-label="Pass device mode" aria-describedby={`${menuId}-privacy-note`} checked={settings.passDeviceMode}
                      onChange={event => updateBooleanSetting("passDeviceMode", event.target.checked)} />
                    <span className="menu-switch" aria-hidden="true" />
                  </label>
                  {import.meta.env.DEV && <label className="menu-toggle">
                    <span className="menu-toggle__copy"><span>Debug hand snapshots</span></span>
                    <input type="checkbox" aria-label="Debug hand snapshots" checked={settings.debugHandSnapshots}
                      onChange={event => updateBooleanSetting("debugHandSnapshots", event.target.checked)} />
                    <span className="menu-switch" aria-hidden="true" />
                  </label>}
                </section>
                <fieldset className="menu-card-backs">
                  <legend>Card back</legend>
                  <div className="menu-card-backs__options">
                    {cardBackOptions.map(back => <label className="menu-card-back" key={back.id}>
                      <input type="radio" name={`${menuId}-card-back`} value={back.id} checked={cardBack.id === back.id}
                        onChange={() => selectCardBack(back.id)} />
                      <img src={back.image} alt="" width="750" height="1050" draggable={false} />
                      <span>{back.name}</span>
                    </label>)}
                  </div>
                </fieldset>
                <PwaControls allowUpdate={phase !== "action"} />
                <details className="current-game-rules" open>
                  <summary>Match rules<ChevronDown size={16} /></summary>
                  <p className="menu-settings-note">Configured in the lobby.</p>
                  <dl>{getCurrentGameRules(settings).map(rule => <div key={rule.label}><dt>{rule.label}</dt><dd>{rule.value}</dd></div>)}</dl>
                </details>
              </>}

              {activeTab === "rules" && <div className="rules-document">
                <p className="menu-section-intro">Lobby settings override the defaults below.</p>
                {ruleSections.map((section, index) => <details className="menu-rule-section" key={section.title} open={index === 0}>
                  <summary>{section.title}<ChevronDown size={16} /></summary>
                  <div className="menu-rule-section__body">{section.lines.map((line, lineIndex) => {
                    const text = line.trim();
                    if (!text) return null;
                    return <p key={lineIndex} className={`${text.startsWith("- ") ? "rule-bullet" : ""}${line.startsWith("   ") ? " rule-indented" : ""}`}>
                      {text.replace(/^- /, "").split(/(`[^`]+`)/g).map((part, partIndex) => part.startsWith("`")
                        ? <code key={partIndex}>{part.slice(1, -1)}</code> : part)}
                    </p>;
                  })}</div>
                </details>)}
              </div>}

              {activeTab === "cards" && <>
                <div className="menu-card-tools">
                  <label className="menu-search"><Search size={17} /><input id={`${menuId}-search`} type="search" aria-label="Search cards" placeholder="Search cards…" value={cardSearch} onChange={event => setCardSearch(event.target.value)} />
                    {cardSearch && <button type="button" aria-label="Clear card search" onClick={() => { setCardSearch(""); document.getElementById(`${menuId}-search`)?.focus(); }}><X size={15} /></button>}
                  </label>
                  <select aria-label="Card type" value={cardType} onChange={event => setCardType(event.target.value as CardType | "all")}>
                    <option value="all">All types</option>{cardTypes.map(type => <option value={type.id} key={type.id}>{type.label}</option>)}
                  </select>
                </div>
                <div className="deck-summary"><span role="status">{filteredCards.length} of {allCards.length} cards</span><span>{deckSummary.mainDeckTotal + deckSummary.eventDeckTotal} in deck</span></div>
                <div className="card-catalog">
                  {cardTypes.map(type => {
                    const cards = filteredCards.filter(card => card.type === type.id);
                    if (!cards.length) return null;
                    return <section className={`catalog-group card-${type.id}`} key={type.id} aria-label={type.label}>
                      <h3><span />{type.label}<small>{cards.length}</small></h3>
                      <div className="catalog-list">{cards.map(card => {
                        const status = getCardImplementationStatus(card);
                        const note = getCardImplementationNote(card);
                        return <article className="catalog-card" key={card.id}>
                          <div className="catalog-card__art" aria-hidden="true"><CardView card={card} mode="board" /></div>
                          <div className="catalog-card__copy">
                            <strong>{card.name}</strong>
                            <p>{card.rulesText}</p>
                            {status !== "implemented" && <small>{note}</small>}
                          </div>
                          <div className="catalog-card__actions">
                            <span aria-label={`${card.count} copies`}>×{card.count}</span>
                            <button className="catalog-card__view" type="button" aria-label={`View ${card.name} card`} aria-haspopup="dialog"
                              onClick={event => { event.currentTarget.focus(); setPreviewCard(card); }}><Maximize2 size={13} />View card</button>
                          </div>
                        </article>;
                      })}</div>
                    </section>;
                  })}
                  {filteredCards.length === 0 && <div className="menu-empty"><Search size={24} /><p>No matching cards.</p><button type="button" onClick={() => { setCardSearch(""); setCardType("all"); document.getElementById(`${menuId}-search`)?.focus(); }}>Clear filters</button></div>}
                </div>
              </>}
            </div>

            {phase !== "setup" && <footer className="menu-match-actions">
              <button type="button" onClick={event => { event.currentTarget.focus(); requestMatchAction("lobby"); }}><Home size={16} />Return to Lobby</button>
              <button type="button" onClick={event => { event.currentTarget.focus(); requestMatchAction("restart"); }}>{phase === "action" ? <RotateCcw size={16} /> : <Plus size={16} />}{phase === "action" ? "Restart Game" : "New Game"}</button>
            </footer>}
          </section>
        </Dialog>
      )}
      {isOpen && previewCard && (
        <CardPreview card={previewCard} onClose={() => setPreviewCard(null)} />
      )}
      {isOpen && confirmation && <Dialog className="match-dialog" label={confirmation === "restart" ? "Restart match?" : "Return to lobby?"} onClose={() => setConfirmation(null)}>
        <section className="match-dialog__panel match-confirmation">
          <header className="match-dialog__header"><div>
            {confirmation === "restart" ? <RotateCcw size={18} aria-hidden="true" /> : <Home size={18} aria-hidden="true" />}
            <h2>{confirmation === "restart" ? "Restart match?" : "Return to lobby?"}</h2>
          </div></header>
          <div className="match-dialog__body match-confirmation__body">
            <p>{confirmation === "restart" ? "End this match and deal a new game with the same players and rules." : "End this match and return to setup."}</p>
            <p>Your current match progress will be lost.</p>
          </div>
          <footer className="match-dialog__footer">
            <button type="button" onClick={() => setConfirmation(null)}>Keep playing</button>
            <button className="match-dialog__primary" type="button" onClick={() => performMatchAction(confirmation)}>{confirmation === "restart" ? "Restart Game" : "Return to Lobby"}</button>
          </footer>
        </section>
      </Dialog>}
    </>
  );
}

function getCurrentGameRules(settings: GameSettings): Array<{ label: string; value: string }> {
  return [
    { label: "Starting health", value: `${settings.startingHealth}` },
    { label: "Max health", value: `${settings.maxHealth}` },
    { label: "Starting hand", value: `${settings.startingHandSize} cards` },
    { label: "Max hand", value: `${settings.maxHandSize} cards` },
    { label: "Actions", value: `${settings.actionsPerTurn} per turn` },
    { label: "Free draws", value: `${settings.freeDrawsPerTurn} per turn` },
    { label: "Turn order", value: settings.turnOrder === "roundRobin" ? "Round robin" : "Rotating start" },
    { label: "Secondary defense", value: settings.allowSecondaryDefense ? "Allowed" : "Not allowed" },
    { label: "Team healing", value: settings.allowTeamHealing ? "Allowed" : "Off" },
    { label: "Team transfer", value: settings.allowTeamCardTransfer ? "Allowed" : "Off" },
    { label: "Elimination reward", value: settings.eliminationHealthReward > 0 ? `Heal ${settings.eliminationHealthReward}` : "None" },
    {
      label: "Black Market",
      value: getBlackMarketRuleSummary(settings)
    }
  ];
}

function getBlackMarketRuleSummary(settings: GameSettings): string {
  const config = settings.blackMarketPreset === "custom" ? settings.blackMarketCustom : blackMarketPresets[settings.blackMarketPreset];
  const label = settings.blackMarketPreset === "custom" ? "Custom" : toTitleCase(settings.blackMarketPreset);
  const risk = [
    config.discardCost > 0 ? `discard ${config.discardCost}` : null,
    config.healthCost > 0 ? `${config.healthCost} health` : null
  ].filter(Boolean);

  return `${label}: Risk ${risk.length > 0 ? risk.join(", ") : "none"}; reward reveal ${config.revealCount}, keep ${config.keepCount}.`;
}

function toTitleCase(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}
