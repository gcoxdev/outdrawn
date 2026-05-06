import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
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
import { PlayerPanel } from "./PlayerPanel";
import { WinnerModal } from "./WinnerModal";

function definitionFor(card: CardInstance | null) {
  return card ? allCards.find((definition) => definition.id === card.definitionId) : undefined;
}

type GameTableProps = {
  state: GameState;
  dispatch: (action: GameAction) => void;
};

type MobileTab = "hand" | "actions" | "players" | "log";

export function GameTable({ state, dispatch }: GameTableProps) {
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("hand");
  const [lastRevealedHumanId, setLastRevealedHumanId] = useState<PlayerId | null>(null);
  const currentPlayer = getCurrentPlayer(state);
  const decisionPlayerId = getDecisionPlayerId(state);
  const passDeviceContext = getPassDeviceContext(state, lastRevealedHumanId);
  const displayPlayer =
    state.players.find((player) => player.id === state.pendingReaction?.defenderId) ??
    state.players.find((player) => player.id === state.pendingRedirect?.defenderId) ??
    state.players.find((player) => player.id === state.pendingAttackCost?.attackerId) ??
    state.players.find((player) => player.id === state.pendingDiscard?.playerId) ??
    state.players.find((player) => player.id === state.pendingSearch?.playerId) ??
    state.players.find((player) => player.id === state.pendingSupplyDrop?.playerOrder[state.pendingSupplyDrop.currentIndex]) ??
    state.players.find((player) => player.id === state.pendingMarketSearch?.playerId) ??
    currentPlayer;
  const selectedCard = displayPlayer.hand.find((card) => card.instanceId === state.selectedCardId) ?? null;
  const isComputerDecision = displayPlayer.controller.type === "computer" && displayPlayer.id === decisionPlayerId;
  const onlyComputersRemain = state.players.every((player) => player.eliminated || player.controller.type === "computer");
  const privacyGateActive = Boolean(passDeviceContext);
  const shouldRevealDisplayHand = (displayPlayer.controller.type === "human" && !privacyGateActive) || onlyComputersRemain;
  const canSelectDisplayHand = displayPlayer.controller.type === "human" && !isComputerDecision && !privacyGateActive && state.phase !== "gameOver";
  const selectedDefinition = canSelectDisplayHand ? definitionFor(selectedCard) : undefined;
  const activeEventDefinition = definitionFor(state.activeEvent?.card ?? null);
  const winner = state.players.find((player) => player.id === state.winnerId);

  useEffect(() => {
    setActiveMobileTab("hand");
  }, [decisionPlayerId]);

  return (
    <main className={`game-table mobile-tab-${activeMobileTab}`}>
      {state.phase === "gameOver" && <WinnerModal winner={winner} dispatch={dispatch} />}
      <header className="status-bar">
        <div>
          <p className="eyebrow">Round {state.round}</p>
          <h1>
            {state.phase === "gameOver"
              ? `${winner?.name ?? "Nobody"} wins`
              : state.pendingReaction
                ? `${displayPlayer.name}'s reaction`
                : state.pendingRedirect
                  ? `${displayPlayer.name}'s redirect`
                  : state.pendingAttackCost
                    ? `${displayPlayer.name}'s attack cost`
                    : state.pendingDiscard
                      ? `${displayPlayer.name}'s discard`
                      : state.pendingSupplyDrop
                        ? `${displayPlayer.name}'s supply pick`
                        : state.pendingMarketSearch
                          ? `${displayPlayer.name}'s market pick`
                          : `${currentPlayer.name}'s turn`}
          </h1>
        </div>
        <div className="status-bar__meta">
          <span>{state.mainDeck.length} deck</span>
          <span>{state.discardPile.length} discard</span>
          <span>{activeEventDefinition ? activeEventDefinition.name : "No event"}</span>
          <span>{state.eventDeck.length} events</span>
        </div>
      </header>

      <nav className="mobile-board-tabs" aria-label="Board sections">
        {(["hand", "actions", "players", "log"] as MobileTab[]).map((tab) => (
          <button className={activeMobileTab === tab ? "is-active" : ""} key={tab} type="button" onClick={() => setActiveMobileTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>

      <section className="player-strip board-panel board-panel-players">
        {state.players.map((player) => (
          <PlayerPanel key={player.id} player={player} isCurrent={player.id === currentPlayer.id} />
        ))}
      </section>

      <section className="board-grid">
        <section className="current-board board-panel board-panel-hand">
          <div className="board-heading">
            <div>
              <p className="eyebrow">
                {state.pendingReaction
                  ? "Defender Hand"
                  : state.pendingRedirect
                    ? "Redirecting Hand"
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

        <div className="board-panel board-panel-actions">
          <ActionPanel
            state={state}
            currentPlayer={currentPlayer}
            selectedCard={selectedDefinition ? selectedCard : null}
            isComputerDecision={isComputerDecision || privacyGateActive}
            dispatch={dispatch}
          />
        </div>
        <div className="board-panel board-panel-log">
          <GameMenu settings={state.settings} dispatch={dispatch} placement="inline" />
          <GameLog entries={state.log} />
        </div>
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
