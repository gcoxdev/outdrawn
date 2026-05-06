import { MAX_HAND_SIZE } from "../data/constants";
import type { GameAction } from "../game/actions";
import { getCardDefinitionById, getPlayer } from "../game/rules";
import type { CardInstance, GameState, PlayerState } from "../game/types";
import { CardView } from "./CardView";

type ActionPanelProps = {
  state: GameState;
  currentPlayer: PlayerState;
  selectedCard: CardInstance | null;
  dispatch: (action: GameAction) => void;
};

export function ActionPanel({ state, currentPlayer, selectedCard, dispatch }: ActionPanelProps) {
  const selectedDefinition = selectedCard ? getCardDefinitionById(selectedCard.definitionId) : undefined;
  const livingTargets = state.players.filter((player) => !player.eliminated && player.id !== currentPlayer.id);
  const canAct = state.phase === "action" && !state.pendingReaction && currentPlayer.actionsRemaining > 0;
  const pendingDefender = state.pendingReaction ? getPlayer(state, state.pendingReaction.defenderId) : undefined;
  const pendingAttacker = state.pendingReaction ? getPlayer(state, state.pendingReaction.attackerId) : undefined;
  const reactionCards = pendingDefender?.hand.filter((card) => getCardDefinitionById(card.definitionId)?.type === "defense") ?? [];

  if (state.pendingReaction && pendingDefender && pendingAttacker) {
    const weaponDefinition = getCardDefinitionById(state.pendingReaction.weapon.definitionId);

    return (
      <section className="action-panel reaction-panel">
        <div>
          <p className="eyebrow">Reaction</p>
          <h2>{pendingDefender.name} is under attack</h2>
          <p>
            {pendingAttacker.name} played {weaponDefinition?.name ?? "a weapon"} for {state.pendingReaction.baseDamage} base damage.
          </p>
        </div>
        <div className="reaction-card-list">
          {reactionCards.map((card) => {
            const definition = getCardDefinitionById(card.definitionId);
            return definition ? (
              <button
                className="reaction-card-button"
                key={card.instanceId}
                onClick={() =>
                  dispatch({
                    type: "PLAY_REACTION",
                    defenderId: pendingDefender.id,
                    reactionCardInstanceId: card.instanceId
                  })
                }
              >
                <CardView card={definition} mode="board" />
              </button>
            ) : null;
          })}
        </div>
        <button onClick={() => dispatch({ type: "SKIP_REACTION", defenderId: pendingDefender.id })}>Take Hit</button>
      </section>
    );
  }

  return (
    <section className="action-panel">
      <div className="action-panel__commands">
        <button disabled={!canAct || state.mainDeck.length === 0} onClick={() => dispatch({ type: "DRAW_CARD", playerId: currentPlayer.id })}>
          Draw
        </button>
        <button disabled={!canAct} onClick={() => dispatch({ type: "PASS_ACTION", playerId: currentPlayer.id })}>
          Pass
        </button>
        <button
          disabled={currentPlayer.hand.length > MAX_HAND_SIZE}
          onClick={() => dispatch({ type: "END_TURN", playerId: currentPlayer.id })}
        >
          End Turn
        </button>
      </div>

      {selectedDefinition && selectedCard ? (
        <div className="selected-card">
          <CardView card={selectedDefinition} mode="detail" />
          <div className="selected-card__commands">
            {selectedDefinition.type === "healing" && (
              <button
                disabled={!canAct}
                onClick={() =>
                  dispatch({
                    type: "PLAY_HEALING",
                    playerId: currentPlayer.id,
                    cardInstanceId: selectedCard.instanceId
                  })
                }
              >
                Play
              </button>
            )}
            <button
              disabled={state.phase !== "action"}
              onClick={() =>
                dispatch({
                  type: "DISCARD_CARD",
                  playerId: currentPlayer.id,
                  cardInstanceId: selectedCard.instanceId
                })
              }
            >
              Discard
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-selection">
          <h2>Select a card</h2>
          <p>Play weapons directly from hand, play simple healing, or discard down to {MAX_HAND_SIZE} cards.</p>
        </div>
      )}

      <div className="attack-box">
        <h2>Attack</h2>
        <p>{selectedDefinition?.type === "weapon" ? `Choose a target for ${selectedDefinition.name}.` : "Select a weapon card first."}</p>
        <div className="target-list">
          {livingTargets.map((target) => (
            <button
              disabled={!canAct || selectedDefinition?.type !== "weapon" || !selectedCard}
              key={target.id}
              onClick={() =>
                selectedCard &&
                dispatch({
                  type: "ATTACK",
                  attackerId: currentPlayer.id,
                  targetPlayerId: target.id,
                  weaponInstanceId: selectedCard.instanceId
                })
              }
            >
              {target.name}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
