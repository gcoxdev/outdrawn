import { getPlayerDecision, type PendingDecision } from "../game/decisions";
import { Eye, EyeOff, Heart, Layers, ScrollText, Users, Swords, Zap, ArrowRight, LayoutGrid, List, ChevronRight, Check } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { allCards } from "../data/cards";
import { blackMarketPresets } from "../data/constants";
import type { GameAction } from "../game/actions";
import { getPassDeviceContext } from "../game/privacy";
import { getCurrentPlayer, getTeamMembers, hasPendingDecision as hasDecision, isHostileTarget, labelTeam } from "../game/rules";
import { getDecisionPlayerId } from "../game/rules";
import type { CardInstance, GameState, PlayerId } from "../game/types";
import { ActionPanel } from "./ActionPanel";
import { CardBack, CardView } from "./CardView";
import { GameLog } from "./GameLog";
import { GameMenu } from "./GameMenu";
import { PlayerRoster } from "./PlayerRoster";
import { Dialog } from "./Dialog";
import { WinnerModal } from "./WinnerModal";
import { DiscardPiles } from "./DiscardPiles";
import { CardActionDialog } from "./CardActionDialog";
import { GameNotice } from "./GameNotice";
import { EliminationDialog } from "./EliminationDialog";

const handLabels: Record<Exclude<PendingDecision["kind"], "event">, string> = {
  reaction: "Defender Hand", redirect: "Redirecting Hand", secondary: "Secondary Defense",
  attackCost: "Attack Cost", discard: "Discarding Hand", search: "Searching Hand",
  supplyDrop: "Supply Drop", marketSearch: "Black Market", blackMarket: "Black Market", steal: "Stealing"
};

function definitionFor(card: CardInstance | null) {
  return card ? allCards.find((definition) => definition.id === card.definitionId) : undefined;
}

type GameTableProps = {
  state: GameState;
  dispatch: (action: GameAction) => void;
  eliminatedPlayerIds?: PlayerId[];
  onEliminationsAcknowledged?: () => void;
  saveFailed?: boolean;
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  computerDelay?: number;
  onComputerDelayChange?: (delay: number) => void;
  onReferenceOpenChange?: (open: boolean) => void;
};

type MobileTab = "play" | "players" | "log";

export function GameTable({ state, dispatch, eliminatedPlayerIds, onEliminationsAcknowledged, saveFailed = false, paused = false, onPausedChange, computerDelay = 500, onComputerDelayChange, onReferenceOpenChange }: GameTableProps) {
  const hasEliminationNotice = !!eliminatedPlayerIds?.length;
  const [handLayout, setHandLayout] = useState<"tiles" | "list">("tiles");
  const handRef = useRef<HTMLDivElement>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resultDismissed, setResultDismissed] = useState(false);
  useEffect(() => { if (state.phase !== "gameOver") setResultDismissed(false); }, [state.phase]);
  const [showDiscards, setShowDiscards] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("play");
  const [lastRevealedHumanId, setLastRevealedHumanId] = useState<PlayerId | null>(null);
  const [sidebarPlayerPercent, setSidebarPlayerPercent] = useState(62);
  const [handViewerId, setHandViewerId] = useState<PlayerId | null>(null);
  const [hiddenHandPlayerIds, setHiddenHandPlayerIds] = useState<Set<PlayerId>>(() => new Set());
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<string[]>([]);
  const currentPlayer = getCurrentPlayer(state);
  const decisionPlayerId = getDecisionPlayerId(state);
  const decision = getPlayerDecision(state);
  const passDeviceContext = getPassDeviceContext(state, lastRevealedHumanId);
  const logPlayers = useMemo(() => state.players.map((player) => ({ id: player.id, name: player.name })), [state.players]);
  const displayPlayer = state.players.find(player => player.id === decisionPlayerId) ?? currentPlayer;
  const hasPendingDecision = hasDecision(state);
  const teamHandViewers =
    displayPlayer.teamId && !hasPendingDecision
      ? getTeamMembers(state, displayPlayer.teamId).filter((player) => !player.eliminated)
      : [];
  const handDisplayPlayer =
    teamHandViewers.find((player) => player.id === handViewerId) ?? displayPlayer;
  const isComputerDecision = displayPlayer.controller.type === "computer" && displayPlayer.id === decisionPlayerId;
  const privacyGateActive = Boolean(passDeviceContext);
  const shouldRevealDisplayHand = canRevealTableHand(state, displayPlayer, handDisplayPlayer, privacyGateActive);
  const canToggleDisplayHandPrivacy = canToggleHandPrivacy(state, displayPlayer, handDisplayPlayer, privacyGateActive);
  const canUseTeamHandControls = teamHandViewers.length > 1 && shouldRevealDisplayHand;
  const isHandManuallyHidden = hiddenHandPlayerIds.has(handDisplayPlayer.id);
  const shouldShowDisplayHand = shouldRevealDisplayHand && !isHandManuallyHidden;
  const canSelectDisplayHand =
    shouldShowDisplayHand &&
    handDisplayPlayer.id === displayPlayer.id &&
    displayPlayer.controller.type === "human" &&
    !displayPlayer.eliminated &&
    !handDisplayPlayer.eliminated &&
    !isComputerDecision &&
    !privacyGateActive &&
    state.phase !== "gameOver";
  const handDiscardRequirement = getHandDiscardRequirement(state, currentPlayer, handDisplayPlayer);
  const playableReactionCardIds = getPlayableReactionCardIds(state, handDisplayPlayer);
  const allowedHandCardIds = handDiscardRequirement ? handDiscardRequirement.allowedCardInstanceIds : playableReactionCardIds;
  const previewCard = shouldShowDisplayHand && !state.pendingEventDialog && !hasEliminationNotice && !handDiscardRequirement
    ? handDisplayPlayer.hand.find(card => card.instanceId === previewId && (!allowedHandCardIds || allowedHandCardIds.includes(card.instanceId)))
    : undefined;
  useEffect(() => { onReferenceOpenChange?.(menuOpen || showDiscards || !!previewCard || activeMobileTab === "log"); return () => onReferenceOpenChange?.(false); }, [menuOpen, showDiscards, previewCard, activeMobileTab, onReferenceOpenChange]);
  const selectedDiscardCards = handDisplayPlayer.hand.filter((card) => selectedDiscardIds.includes(card.instanceId) && (!allowedHandCardIds || allowedHandCardIds.includes(card.instanceId)));
  const winner = state.players.find((player) => player.id === state.winnerId);
  const decisionText = getDecisionText(state, currentPlayer.name, displayPlayer.name, winner?.name);

  useEffect(() => {
    setActiveMobileTab("play");
  }, [decisionPlayerId]);

  useEffect(() => {
    setHandViewerId(null);
  }, [decisionPlayerId, hasPendingDecision]);

  useEffect(() => {
    setSelectedDiscardIds((current) => current.filter((id) => handDisplayPlayer.hand.some((card) => card.instanceId === id)));
  }, [handDisplayPlayer.id, handDisplayPlayer.hand.length]);

  const resizeCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => resizeCleanup.current?.(), []);

  function startSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    const sidebar = event.currentTarget.closest(".operations-sidebar");
    if (!sidebar) {
      return;
    }

    resizeCleanup.current?.();
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = sidebar.getBoundingClientRect();
    const update = (clientY: number) => {
      const nextPercent = ((clientY - bounds.top) / bounds.height) * 100;
      setSidebarPlayerPercent(Math.min(82, Math.max(28, nextPercent)));
    };

    update(event.clientY);
    const handleMove = (moveEvent: PointerEvent) => update(moveEvent.clientY);
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    resizeCleanup.current = handleUp;
  }

  return (
    <main className={`game-table mobile-tab-${activeMobileTab}`}>
      {saveFailed && <GameNotice className="save-warning">This browser could not save the match. Keep this tab open to continue playing.</GameNotice>}
      {state.pendingEventDialog ? (
        <EventDialog state={state} dispatch={dispatch} />
      ) : hasEliminationNotice ? (
        <EliminationDialog state={state} playerIds={eliminatedPlayerIds!} onContinue={() => onEliminationsAcknowledged?.()} />
      ) : state.phase === "gameOver" && !resultDismissed ? (
        <WinnerModal
          onClose={() => setResultDismissed(true)}
          outcome={state.outcome}
          winner={winner}
          winnerTeamId={state.winnerTeamId}
          winnerTeamMembers={state.winnerTeamId ? getTeamMembers(state, state.winnerTeamId) : []}
          round={state.round}
          playerCount={state.players.length}
          partialDamageHistory={state.damageTrackingStartedMidMatch}
          dispatch={dispatch}
        />
      ) : null}
      <header className="match-header">
        <img src="/optimized/branding/logos/outdrawn-logo-dark-01.webp" alt="Outdrawn" width="260" height="84" />
        <nav className="mobile-board-tabs" aria-label="Board sections">
          {(["play", "players", "log"] as MobileTab[]).map((tab) => (
            <button className={activeMobileTab === tab ? "is-active" : ""} key={tab} type="button" aria-pressed={activeMobileTab === tab} onClick={() => setActiveMobileTab(tab)}>
              {tab === "play" ? <Swords size={16} /> : tab === "players" ? <Users size={16} /> : <ScrollText size={16} />}
              {tab === "play" ? "Table" : tab === "players" ? "Players" : "Log"}
            </button>
          ))}
        </nav>
        <div className="match-header__status"><span>Round <strong>{state.round}</strong></span><span>Alive <strong>{state.players.filter(player => !player.eliminated).length}</strong></span></div>
        <GameMenu settings={state.settings} dispatch={dispatch} phase={state.phase} onOpenChange={setMenuOpen} />
      </header>

      <section className="game-shell">
        <aside
          className="operations-sidebar board-panel board-panel-players"
          style={{ gridTemplateRows: `${sidebarPlayerPercent}fr 8px ${100 - sidebarPlayerPercent}fr` }}
        >
          <div className="sidebar-pane sidebar-pane--players">
            <PlayerRoster
              state={state}
              currentPlayerId={currentPlayer.id}
              decisionPlayerId={decisionPlayerId}
              displayPlayerId={displayPlayer.id}
            />
            {state.phase === "action" && state.players.some(player => player.controller.type === "computer" && !player.eliminated) && (
              <div className="computer-controls" role="group" aria-label="Computer controls">
                <button type="button" aria-pressed={paused} onClick={() => onPausedChange?.(!paused)}>{paused ? "Resume computers" : "Pause computers"}</button>
                <select aria-label="Computer speed" value={computerDelay} onChange={event => onComputerDelayChange?.(Number(event.target.value))}><option value={1000}>Slow</option><option value={500}>Normal</option><option value={150}>Fast</option></select>
              </div>
            )}
          </div>
          <div
            className="sidebar-resize-handle"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize player roster and log"
            tabIndex={0}
            aria-valuemin={28}
            aria-valuemax={82}
            aria-valuenow={sidebarPlayerPercent}
            onKeyDown={event => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                setSidebarPlayerPercent(value => Math.min(82, Math.max(28, value + (event.key === "ArrowDown" ? 2 : -2))));
              }
            }}
            onPointerDown={startSidebarResize}
          />
          <div className="sidebar-pane sidebar-pane--log board-panel-log">
            <GameLog entries={state.log} players={logPlayers} />
          </div>
        </aside>

        <section className="decision-workspace board-panel board-panel-play">
          <header className="decision-strip">
            <h1>{decisionText}</h1>
            <div className="log-panel__meta">
              <span><Layers size={14} aria-hidden="true" /> <strong className="pile-count">{state.mainDeck.length}</strong> in deck</span>
              <button type="button" onClick={() => setShowDiscards(true)}>Discards <strong className="pile-count">{state.discardPile.length}</strong></button>
            </div>
          </header>

          <section className="current-board">
            <div className="board-heading">
              <div>
                <p className="eyebrow">
                  {decision ? handLabels[decision.kind] : "Hand"} · {handDisplayPlayer.hand.length} cards
                </p>
                <h2>{handDisplayPlayer.name}</h2>
              </div>
              <div className="board-heading__health" aria-label={`${handDisplayPlayer.name} has ${handDisplayPlayer.health} health`}>
                <Heart size={16} aria-hidden="true" />
                <strong>{handDisplayPlayer.health}</strong>
                <span>HP</span>
              </div>
              <div className="board-heading__meta">
                {canUseTeamHandControls && (
                  <label>
                    <span className="sr-only">View team hand</span>
                    <select value={handDisplayPlayer.id} onChange={(event) => setHandViewerId(event.target.value)}>
                      {teamHandViewers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="hand-layout-toggle" role="group" aria-label="Hand display">
                  <button type="button" aria-label="Tile view" title="Tile view" aria-pressed={handLayout === "tiles"} onClick={() => setHandLayout("tiles")}><LayoutGrid size={17} aria-hidden="true" /></button>
                  <button type="button" aria-label="List view" title="List view" aria-pressed={handLayout === "list"} onClick={() => setHandLayout("list")}><List size={18} aria-hidden="true" /></button>
                </div>
                {canToggleDisplayHandPrivacy && (
                  <button
                    aria-label={isHandManuallyHidden ? `Show ${handDisplayPlayer.name}'s hand` : `Hide ${handDisplayPlayer.name}'s hand`}
                    aria-pressed={isHandManuallyHidden}
                    className="hand-privacy-button"
                    title={isHandManuallyHidden ? "Show hand" : "Hide hand"}
                    type="button"
                    onClick={() => {
                      setHiddenHandPlayerIds((current) => {
                        const next = new Set(current);
                        if (next.has(handDisplayPlayer.id)) {
                          next.delete(handDisplayPlayer.id);
                        } else {
                          next.add(handDisplayPlayer.id);
                        }
                        return next;
                      });
                      if (!isHandManuallyHidden && state.selectedCardId) {
                        dispatch({ type: "SELECT_CARD", cardInstanceId: null });
                      }
                    }}
                  >
                    {isHandManuallyHidden ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                )}
              </div>
            </div>
            <div ref={handRef} className={`hand-rail${handLayout === "list" ? " hand-rail--list" : ""}`} role="region" aria-label={`${handDisplayPlayer.name}'s cards`} tabIndex={0}>
              {handDisplayPlayer.hand.length === 0 && <p className="hand-empty">No cards in hand.</p>}
              {shouldShowDisplayHand ? (
                handDisplayPlayer.hand.map((card) => {
                  const definition = definitionFor(card);
                  const isDisabled = !!allowedHandCardIds && !allowedHandCardIds.includes(card.instanceId);
                  const selectingDiscard = !!(handDiscardRequirement && canSelectDisplayHand);
                  const isSelected = handDiscardRequirement ? selectedDiscardIds.includes(card.instanceId) : previewId === card.instanceId;
                  const openCard = () => {
                    if (isDisabled) return;
                    if (selectingDiscard) {
                      setSelectedDiscardIds(current => current.includes(card.instanceId)
                        ? current.filter(id => id !== card.instanceId)
                        : current.length >= handDiscardRequirement!.count ? [...current.slice(1), card.instanceId] : [...current, card.instanceId]);
                      return;
                    }
                    if (!handDiscardRequirement) setSelectedDiscardIds([]);
                    setPreviewId(card.instanceId);
                  };
                  return definition ? (
                    <div className="hand-card-slot" key={card.instanceId}>
                      {handLayout === "tiles" ? <CardView card={definition} opensDialog={!selectingDiscard} isSelected={isSelected} isDisabled={isDisabled} onClick={openCard} /> :
                        <button type="button" disabled={isDisabled} className={`hand-list-card${isSelected ? " is-selected" : ""}`}
                          aria-label={`${selectingDiscard ? "Select" : "Open"} ${definition.name} card`} aria-haspopup={selectingDiscard ? undefined : "dialog"}
                          aria-pressed={selectingDiscard ? isSelected : undefined} onClick={event => { event.currentTarget.focus(); openCard(); }}>
                          <span className="hand-list-card__art" aria-hidden="true"><CardView card={definition} mode="board" /></span>
                          <span className="hand-list-card__copy"><strong>{definition.name}</strong><small>{definition.type}</small><span>{definition.shortText}</span></span>
                          {isSelected ? <Check size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
                        </button>}
                    </div>
                  ) : null;
                })
              ) : (
                handDisplayPlayer.hand.map((card) => (
                  <div className="hand-card-slot" key={card.instanceId}>
                    {handLayout === "list" ? <div className="hand-list-card hand-list-card--hidden"><span className="hand-list-card__art"><CardBack /></span><span>Hidden card</span></div> : <CardBack />}
                  </div>
                ))
              )}
            </div>
          </section>

          {state.phase === "gameOver" ? <section className="action-panel finished-match">
            <h2>Match complete</h2><p>{state.outcome?.description ?? "Review the result or start a new match."}</p>
            <div className="action-row"><button type="button" onClick={() => setResultDismissed(false)}>View result</button><button className="review-log-button" type="button" onClick={() => { setActiveMobileTab("log"); document.querySelector(".game-log")?.scrollIntoView({ block: "nearest" }); }}>Review log</button><button type="button" onClick={() => setShowDiscards(true)}>Discards</button><button type="button" onClick={() => dispatch({ type: "RESTART_GAME" })}>New Game</button></div>
          </section> : <ActionPanel
            state={state}
            currentPlayer={currentPlayer}
            selectedDiscardCards={selectedDiscardCards}
            discardRequirement={handDiscardRequirement}
            isComputerDecision={isComputerDecision || privacyGateActive}
            isComputerPaused={paused}
            dispatch={dispatch}
          />}
        </section>
      </section>

      <span className="sr-only" role="status" aria-live="polite">{state.phase === "gameOver" ? "Match complete" : `${displayPlayer.name}: ${decision ? handLabels[decision.kind] : "turn"}`}</span>
      {previewCard && <CardActionDialog key={`${handDisplayPlayer.id}:${previewCard.instanceId}:${decision?.kind ?? "turn"}`}
        state={state} player={handDisplayPlayer} card={previewCard}
        canPlay={canSelectDisplayHand && !hasPendingDecision && !handDiscardRequirement}
        canReact={canSelectDisplayHand && !!playableReactionCardIds?.includes(previewCard.instanceId)}
        dispatch={action => {
          setPreviewId(null);
          dispatch(action);
          requestAnimationFrame(() => { if (!document.querySelector("dialog[open]")) handRef.current?.focus({ preventScroll: true }); });
        }} onClose={() => setPreviewId(null)} />}

      {showDiscards && !privacyGateActive && !state.pendingEventDialog && !hasEliminationNotice && (
        <DiscardPiles main={state.discardPile} events={state.eventDiscardPile} onClose={() => setShowDiscards(false)} />
      )}
      {privacyGateActive && !state.pendingEventDialog && !hasEliminationNotice && (
        <Dialog className="match-dialog pass-device-gate" label={`Pass device to ${passDeviceContext!.playerName}`}>
          <div className="match-dialog__panel pass-device-gate__panel">
            <header className="match-dialog__header">
              <div><EyeOff size={18} aria-hidden="true" /><h2>Pass device</h2></div>
            </header>
            <div className="match-dialog__body pass-device-gate__body">
              <p className="match-dialog__kicker">Pass to</p>
              <h3>{passDeviceContext!.playerName}</h3>
              <p className="pass-device-gate__reason">{passDeviceContext!.reason}</p>
              <p className="pass-device-gate__privacy">Their hand stays hidden until they’re ready.</p>
            </div>
            <footer className="match-dialog__footer pass-device-gate__actions">
              <button className="match-dialog__primary" type="button" onClick={() => setLastRevealedHumanId(passDeviceContext!.playerId)}>
                <Eye size={16} aria-hidden="true" />
                Reveal Hand
              </button>
            </footer>
          </div>
        </Dialog>
      )}
    </main>
  );
}

export function canRevealTableHand(
  state: GameState,
  displayPlayer: GameState["players"][number],
  handDisplayPlayer: GameState["players"][number],
  privacyGateActive: boolean
): boolean {
  if (state.players.every((player) => player.eliminated || player.controller.type === "computer")) {
    return true;
  }

  if (privacyGateActive) {
    return false;
  }

  if (handDisplayPlayer.controller.type === "human") {
    return true;
  }

  const livingHumans = state.players.filter((player) => !player.eliminated && player.controller.type === "human");
  const singleHumanTeamId = livingHumans.length === 1 ? livingHumans[0].teamId : undefined;
  const activeHumanTeamId = displayPlayer.controller.type === "human" ? displayPlayer.teamId : undefined;
  const visibleTeamId = singleHumanTeamId ?? activeHumanTeamId;

  return Boolean(visibleTeamId && handDisplayPlayer.teamId === visibleTeamId);
}

export function canToggleHandPrivacy(
  state: GameState,
  displayPlayer: GameState["players"][number],
  handDisplayPlayer: GameState["players"][number],
  privacyGateActive: boolean
): boolean {
  const hasLivingHuman = state.players.some((player) => !player.eliminated && player.controller.type === "human");
  return hasLivingHuman && !privacyGateActive && canRevealTableHand(state, displayPlayer, handDisplayPlayer, privacyGateActive);
}

export type HandDiscardRequirement = {
  type: "handLimit" | "pendingDiscard" | "blackMarket" | "attackCost";
  playerId: PlayerId;
  count: number;
  reason: string;
  allowedCardInstanceIds?: string[];
};

export function getHandDiscardRequirement(
  state: GameState,
  currentPlayer: GameState["players"][number],
  handDisplayPlayer: GameState["players"][number]
): HandDiscardRequirement | null {
  const decision = getPlayerDecision(state);
  if (decision?.kind === "discard" && decision.playerId === handDisplayPlayer.id) {
    const allowedCardInstanceIds = decision.pending.allowedCardInstanceIds;
    const discardableCount = allowedCardInstanceIds
      ? handDisplayPlayer.hand.filter((card) => allowedCardInstanceIds.includes(card.instanceId)).length
      : handDisplayPlayer.hand.length;
    return {
      type: "pendingDiscard",
      playerId: handDisplayPlayer.id,
      count: Math.min(decision.pending.count, discardableCount),
      reason: decision.pending.reason,
      allowedCardInstanceIds
    };
  }

  if (decision?.kind === "attackCost" && decision.playerId === handDisplayPlayer.id) {
    const allowedCardInstanceIds = handDisplayPlayer.hand
      .filter((card) => card.instanceId !== decision.pending.weaponInstanceId)
      .map((card) => card.instanceId);
    return {
      type: "attackCost",
      playerId: handDisplayPlayer.id,
      count: Math.min(1, allowedCardInstanceIds.length),
      reason: "Intimidate",
      allowedCardInstanceIds
    };
  }

  if (decision?.kind === "blackMarket" && decision.playerId === handDisplayPlayer.id) {
    const config =
      state.settings.blackMarketPreset === "custom" ? state.settings.blackMarketCustom : blackMarketPresets[state.settings.blackMarketPreset];
    if (config.discardCost > 0) {
      return {
        type: "blackMarket",
        playerId: handDisplayPlayer.id,
        count: Math.min(config.discardCost, handDisplayPlayer.hand.length),
        reason: "Black Market"
      };
    }
  }

  if (!hasDecision(state) && currentPlayer.id === handDisplayPlayer.id && currentPlayer.actionsRemaining <= 0 && currentPlayer.hand.length > state.settings.maxHandSize) {
    return {
      type: "handLimit",
      playerId: currentPlayer.id,
      count: currentPlayer.hand.length - state.settings.maxHandSize,
      reason: "hand limit"
    };
  }

  return null;
}

export function getPlayableReactionCardIds(state: GameState, handDisplayPlayer: GameState["players"][number]): string[] | null {
  const activeReaction = state.pendingReaction ?? state.pendingSecondaryDamage;
  if (!activeReaction || activeReaction.defenderId !== handDisplayPlayer.id) {
    return null;
  }

  return handDisplayPlayer.hand
    .filter((card) => {
      const definition = definitionFor(card);
      if (definition?.type !== "defense" && !definition?.isLethalDefense) {
        return false;
      }

      if (state.pendingSecondaryDamage && definition.id === "defense_decoy") {
        return false;
      }

      if (definition.isLethalDefense) {
        return activeReaction.baseDamage >= handDisplayPlayer.health;
      }

      if (definition.id === "defense_decoy") {
        return state.players.some(
          (player) =>
            !player.eliminated &&
            player.id !== activeReaction.attackerId &&
            player.id !== handDisplayPlayer.id &&
            isHostileTarget(handDisplayPlayer, player)
        );
      }

      return true;
    })
    .map((card) => card.instanceId);
}

function getDecisionText(state: GameState, currentPlayerName: string, displayPlayerName: string, winnerName?: string): string {
  const decision = getPlayerDecision(state);
  if (state.phase === "gameOver") {
    return state.winnerTeamId ? `${labelTeam(state.winnerTeamId)} wins` : winnerName ? `${winnerName} wins` : "It's a tie";
  }

  if (decision?.kind === "reaction") {
    return `${displayPlayerName} is defending`;
  }

  if (decision?.kind === "redirect") {
    return `${displayPlayerName} is redirecting`;
  }

  if (decision?.kind === "secondary") {
    return `${displayPlayerName} is defending`;
  }

  if (decision?.kind === "attackCost") {
    return `${displayPlayerName} must discard to attack`;
  }

  if (decision?.kind === "discard") {
    return `${displayPlayerName} must discard`;
  }

  if (decision?.kind === "supplyDrop") {
    return `${displayPlayerName} is choosing supply`;
  }

  if (decision?.kind === "marketSearch") {
    return `${displayPlayerName} is choosing market loot`;
  }

  if (decision?.kind === "blackMarket") {
    return `${displayPlayerName} is deciding on Black Market`;
  }

  if (decision?.kind === "steal") {
    return `${displayPlayerName} is stealing`;
  }

  if (decision?.kind === "search") {
    return `${displayPlayerName} is searching`;
  }

  return `${currentPlayerName}'s turn`;
}

function EventDialog({ state, dispatch }: GameTableProps) {
  const pending = state.pendingEventDialog;
  if (!pending) {
    return null;
  }

  const definition = definitionFor(pending.card);
  const player = state.players.find((candidate) => candidate.id === pending.playerId);
  if (!definition) {
    return null;
  }

  return (
    <Dialog className="match-dialog event-dialog-backdrop" label={`${definition.name} event`}>
      <section className="match-dialog__panel event-dialog-panel">
        <header className="match-dialog__header"><div><Zap size={18} /><span>Event drawn</span></div><span className="match-dialog__meta">Round {state.round}</span></header>
        <div className="match-dialog__body event-dialog-body">
          <div className="event-dialog-card"><CardView card={definition} mode="detail" /></div>
          <div className="event-dialog-copy">
            <p className="match-dialog__kicker">{definition.timing === "thisRound" ? "This round" : definition.timing === "ongoing" ? "Ongoing" : "Immediate"}</p>
            <h2>{definition.name}</h2>
            {player && <p className="event-dialog-player">Drawn by {player.name}</p>}
            <p className="event-dialog-rules">{definition.rulesText}</p>
          </div>
        </div>
        <footer className="match-dialog__footer"><button className="match-dialog__primary" type="button" onClick={() => dispatch({ type: "ACKNOWLEDGE_EVENT_DIALOG" })}>Acknowledge <ArrowRight size={16} /></button></footer>
      </section>
    </Dialog>
  );
}
