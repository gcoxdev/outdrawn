import { Eye } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { allCards } from "../data/cards";
import type { GameAction } from "../game/actions";
import { getPassDeviceContext } from "../game/privacy";
import { getCurrentPlayer } from "../game/rules";
import { getDecisionPlayerId } from "../game/simulator";
import type { CardInstance, GameState, PlayerId } from "../game/types";
import { ActionPanel } from "./ActionPanel";
import { CardBack, CardView } from "./CardView";
import { GameLog } from "./GameLog";
import { GameMenu } from "./GameMenu";
import { PlayerRoster } from "./PlayerRoster";
import { WinnerModal } from "./WinnerModal";

function definitionFor(card: CardInstance | null) {
  return card ? allCards.find((definition) => definition.id === card.definitionId) : undefined;
}

function definitionById(definitionId: string) {
  return allCards.find((definition) => definition.id === definitionId);
}

type GameTableProps = {
  state: GameState;
  dispatch: (action: GameAction) => void;
};

type MobileTab = "play" | "players" | "log";

export function GameTable({ state, dispatch }: GameTableProps) {
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("play");
  const [lastRevealedHumanId, setLastRevealedHumanId] = useState<PlayerId | null>(null);
  const [sidebarPlayerPercent, setSidebarPlayerPercent] = useState(62);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const lastToastedLogId = useRef(state.log[state.log.length - 1]?.id ?? null);
  const currentPlayer = getCurrentPlayer(state);
  const decisionPlayerId = getDecisionPlayerId(state);
  const passDeviceContext = getPassDeviceContext(state, lastRevealedHumanId);
  const displayPlayer =
    state.players.find((player) => player.id === state.pendingReaction?.defenderId) ??
    state.players.find((player) => player.id === state.pendingRedirect?.defenderId) ??
    state.players.find((player) => player.id === state.pendingSecondaryDamage?.defenderId) ??
    state.players.find((player) => player.id === state.pendingAttackCost?.attackerId) ??
    state.players.find((player) => player.id === state.pendingDiscard?.playerId) ??
    state.players.find((player) => player.id === state.pendingSearch?.playerId) ??
    state.players.find((player) => player.id === state.pendingSupplyDrop?.playerOrder[state.pendingSupplyDrop.currentIndex]) ??
    state.players.find((player) => player.id === state.pendingMarketSearch?.playerId) ??
    state.players.find((player) => player.id === state.pendingSteal?.playerId) ??
    currentPlayer;
  const selectedCard = displayPlayer.hand.find((card) => card.instanceId === state.selectedCardId) ?? null;
  const isComputerDecision = displayPlayer.controller.type === "computer" && displayPlayer.id === decisionPlayerId;
  const onlyComputersRemain = state.players.every((player) => player.eliminated || player.controller.type === "computer");
  const privacyGateActive = Boolean(passDeviceContext);
  const shouldRevealDisplayHand = (displayPlayer.controller.type === "human" && !privacyGateActive) || onlyComputersRemain;
  const canSelectDisplayHand = displayPlayer.controller.type === "human" && !isComputerDecision && !privacyGateActive && state.phase !== "gameOver";
  const selectedDefinition = canSelectDisplayHand ? definitionFor(selectedCard) : undefined;
  const activeEventDefinition = definitionFor(state.activeEvent?.card ?? null);
  const visibleEventDefinition = activeEventDefinition ?? (state.pendingSupplyDrop ? definitionById("event_supply_drop") : undefined);
  const winner = state.players.find((player) => player.id === state.winnerId);
  const decisionText = getDecisionText(state, currentPlayer.name, displayPlayer.name, winner?.name);

  useEffect(() => {
    setActiveMobileTab("play");
  }, [decisionPlayerId]);

  useEffect(() => {
    const latest = state.log[state.log.length - 1];
    if (!latest || latest.id === lastToastedLogId.current) {
      return;
    }

    lastToastedLogId.current = latest.id;
    if (!isNegativeLogMessage(latest.message)) {
      return;
    }

    setAlertMessage(latest.message);
    const timeoutId = window.setTimeout(() => setAlertMessage(null), 4200);
    return () => window.clearTimeout(timeoutId);
  }, [state.log]);

  function startSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    const sidebar = event.currentTarget.closest(".operations-sidebar");
    if (!sidebar) {
      return;
    }

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
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <main className={`game-table mobile-tab-${activeMobileTab}`}>
      {state.phase === "gameOver" && <WinnerModal winner={winner} dispatch={dispatch} />}
      {alertMessage && <div className="negative-action-toast">{alertMessage}</div>}
      <GameMenu settings={state.settings} dispatch={dispatch} />

      <nav className="mobile-board-tabs" aria-label="Board sections">
        {(["play", "players", "log"] as MobileTab[]).map((tab) => (
          <button className={activeMobileTab === tab ? "is-active" : ""} key={tab} type="button" onClick={() => setActiveMobileTab(tab)}>
            {tab}
          </button>
        ))}
        <GameMenu settings={state.settings} dispatch={dispatch} variant="mobileIcon" />
      </nav>

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
          </div>
          <div
            className="sidebar-resize-handle"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize player roster and log"
            onPointerDown={startSidebarResize}
          />
          <div className="sidebar-pane sidebar-pane--log board-panel-log">
            <div className="log-panel__meta">
              <span>{state.mainDeck.length} deck</span>
              <span>{state.discardPile.length} discard</span>
              <span>{state.eventDeck.length} events</span>
              <span className="log-panel__event">{visibleEventDefinition ? visibleEventDefinition.name : "No event"}</span>
            </div>
            {visibleEventDefinition && (
              <div className="current-event-summary">
                <strong>{visibleEventDefinition.name}</strong>
                <p>{visibleEventDefinition.rulesText}</p>
              </div>
            )}
            <GameLog entries={state.log} />
          </div>
        </aside>

        <section className="decision-workspace board-panel board-panel-play">
          <header className="decision-strip">
            <div>
              <p className="eyebrow">Round {state.round}</p>
              <h1>{decisionText}</h1>
            </div>
          </header>

          <section className="current-board">
            <div className="board-heading">
              <div>
                <p className="eyebrow">
                  {state.pendingReaction
                    ? "Defender Hand"
                    : state.pendingRedirect
                      ? "Redirecting Hand"
                      : state.pendingSecondaryDamage
                        ? "Secondary Defense"
                        : state.pendingAttackCost
                        ? "Attack Cost"
                        : state.pendingDiscard
                          ? "Discarding Hand"
                          : state.pendingSearch
                            ? "Searching Hand"
                            : state.pendingSupplyDrop
                              ? "Supply Drop"
                              : state.pendingMarketSearch
                                ? "Black Market"
                                : state.pendingSteal
                                  ? "Stealing"
                                  : "Current Player"}
                </p>
                <h2>{displayPlayer.name}</h2>
              </div>
              <strong>{displayPlayer.health} HP</strong>
            </div>
            <div className="hand-rail">
              {shouldRevealDisplayHand ? (
                displayPlayer.hand.map((card) => {
                  const definition = definitionFor(card);
                  return definition ? (
                    <CardView
                      card={definition}
                      isSelected={state.selectedCardId === card.instanceId}
                      key={card.instanceId}
                      onClick={
                        canSelectDisplayHand
                          ? () =>
                              dispatch({
                                type: "SELECT_CARD",
                                cardInstanceId: state.selectedCardId === card.instanceId ? null : card.instanceId
                              })
                          : undefined
                      }
                    />
                  ) : null;
                })
              ) : (
                displayPlayer.hand.map((card) => <CardBack key={card.instanceId} />)
              )}
            </div>
          </section>

          <ActionPanel
            state={state}
            currentPlayer={currentPlayer}
            selectedCard={selectedDefinition ? selectedCard : null}
            isComputerDecision={isComputerDecision || privacyGateActive}
            dispatch={dispatch}
          />
        </section>
      </section>

      {privacyGateActive && (
        <section className="pass-device-gate" role="dialog" aria-modal="true" aria-label={`Pass device to ${passDeviceContext!.playerName}`}>
          <div className="pass-device-gate__panel">
            <p className="eyebrow">Private turn</p>
            <h2>Pass to {passDeviceContext!.playerName}</h2>
            <p>{passDeviceContext!.reason}</p>
            <p>Cards and actions are hidden until this player is ready.</p>
            <button type="button" onClick={() => setLastRevealedHumanId(passDeviceContext!.playerId)}>
              <Eye size={18} />
              Reveal Hand
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function isNegativeLogMessage(message: string): boolean {
  return /\b(took|eliminated|stole|stolen|discarded|disarmed|sabotaged|damaged|hit by)\b/i.test(message);
}

function getDecisionText(state: GameState, currentPlayerName: string, displayPlayerName: string, winnerName?: string): string {
  if (state.phase === "gameOver") {
    return `${winnerName ?? "Nobody"} wins`;
  }

  if (state.pendingReaction) {
    return `${displayPlayerName} is defending`;
  }

  if (state.pendingRedirect) {
    return `${displayPlayerName} is redirecting`;
  }

  if (state.pendingSecondaryDamage) {
    return `${displayPlayerName} is defending`;
  }

  if (state.pendingAttackCost) {
    return `${displayPlayerName} must discard to attack`;
  }

  if (state.pendingDiscard) {
    return `${displayPlayerName} must discard`;
  }

  if (state.pendingSupplyDrop) {
    return `${displayPlayerName} is choosing supply`;
  }

  if (state.pendingMarketSearch) {
    return `${displayPlayerName} is choosing market loot`;
  }

  if (state.pendingSteal) {
    return `${displayPlayerName} is stealing`;
  }

  if (state.pendingSearch) {
    return `${displayPlayerName} is searching`;
  }

  return `${currentPlayerName}'s turn`;
}
