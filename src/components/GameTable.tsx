import { allCards } from "../data/cards";
import type { GameAction } from "../game/actions";
import { getCurrentPlayer } from "../game/rules";
import type { CardInstance, GameState } from "../game/types";
import { ActionPanel } from "./ActionPanel";
import { CardView } from "./CardView";
import { GameLog } from "./GameLog";
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
  const selectedCard = currentPlayer.hand.find((card) => card.instanceId === state.selectedCardId) ?? null;
  const selectedDefinition = definitionFor(selectedCard);
  const weaponDefinition = definitionFor(currentPlayer.equippedWeapon);
  const defenseDefinition = definitionFor(currentPlayer.equippedDefense);
  const winner = state.players.find((player) => player.id === state.winnerId);

  return (
    <main className="game-table">
      <header className="status-bar">
        <div>
          <p className="eyebrow">Round {state.round}</p>
          <h1>{state.phase === "gameOver" ? `${winner?.name ?? "Nobody"} wins` : `${currentPlayer.name}'s turn`}</h1>
        </div>
        <div className="status-bar__meta">
          <span>{state.mainDeck.length} deck</span>
          <span>{state.discardPile.length} discard</span>
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
              <p className="eyebrow">Current Player</p>
              <h2>{currentPlayer.name}</h2>
            </div>
            <strong>{currentPlayer.health} HP</strong>
          </div>
          <div className="equipment-row">
            <div>
              <h3>Weapon</h3>
              {weaponDefinition ? <CardView card={weaponDefinition} mode="board" /> : <div className="empty-slot">No weapon</div>}
            </div>
            <div>
              <h3>Defense</h3>
              {defenseDefinition ? <CardView card={defenseDefinition} mode="board" /> : <div className="empty-slot">No defense</div>}
            </div>
          </div>
          <div className="hand-rail">
            {currentPlayer.hand.map((card) => {
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
            })}
          </div>
        </section>

        <ActionPanel state={state} currentPlayer={currentPlayer} selectedCard={selectedDefinition ? selectedCard : null} dispatch={dispatch} />
        <GameLog entries={state.log} />
      </section>
    </main>
  );
}
