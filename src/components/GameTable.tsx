import { allCards } from "../data/cards";
import type { GameAction } from "../game/actions";
import { getCurrentPlayer } from "../game/rules";
import { getDecisionPlayerId } from "../game/simulator";
import type { CardInstance, GameState } from "../game/types";
import { ActionPanel } from "./ActionPanel";
import { CardBack, CardView } from "./CardView";
import { GameLog } from "./GameLog";
import { GameMenu } from "./GameMenu";
import { PlayerPanel } from "./PlayerPanel";

function definitionFor(card: CardInstance | null) {
  return card ? allCards.find((definition) => definition.id === card.definitionId) : undefined;
}

type GameTableProps = {
  state: GameState;
  dispatch: (action: GameAction) => void;
};

export function GameTable({ state, dispatch }: GameTableProps) {
  const currentPlayer = getCurrentPlayer(state);
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
  const isComputerDecision = displayPlayer.controller.type === "computer" && displayPlayer.id === getDecisionPlayerId(state);
  const shouldRevealDisplayHand = displayPlayer.controller.type === "human" && !isComputerDecision;
  const selectedDefinition = shouldRevealDisplayHand ? definitionFor(selectedCard) : undefined;
  const activeEventDefinition = definitionFor(state.activeEvent?.card ?? null);
  const winner = state.players.find((player) => player.id === state.winnerId);

  return (
    <main className="game-table">
      <GameMenu settings={state.settings} dispatch={dispatch} />
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

      <section className="player-strip">
        {state.players.map((player) => (
          <PlayerPanel key={player.id} player={player} isCurrent={player.id === currentPlayer.id} />
        ))}
      </section>

      <section className="board-grid">
        <section className="current-board">
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
                    onClick={() =>
                      dispatch({
                        type: "SELECT_CARD",
                        cardInstanceId: state.selectedCardId === card.instanceId ? null : card.instanceId
                      })
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
          isComputerDecision={isComputerDecision}
          dispatch={dispatch}
        />
        <GameLog entries={state.log} />
      </section>
    </main>
  );
}
