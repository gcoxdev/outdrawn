import { useState } from "react";
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
  const [discardSelection, setDiscardSelection] = useState<string[]>([]);
  const selectedDefinition = selectedCard ? getCardDefinitionById(selectedCard.definitionId) : undefined;
  const livingTargets = state.players.filter((player) => !player.eliminated && player.id !== currentPlayer.id);
  const canAct = state.phase === "action" && !state.pendingReaction && !state.pendingDiscard && currentPlayer.actionsRemaining > 0;
  const pendingDefender = state.pendingReaction ? getPlayer(state, state.pendingReaction.defenderId) : undefined;
  const pendingAttacker = state.pendingReaction ? getPlayer(state, state.pendingReaction.attackerId) : undefined;
  const pendingDiscardPlayer = state.pendingDiscard ? getPlayer(state, state.pendingDiscard.playerId) : undefined;
  const reactionCards =
    pendingDefender?.hand.filter((card) => {
      const definition = getCardDefinitionById(card.definitionId);
      if (definition?.type !== "defense") {
        return false;
      }

      if (definition.id === "defense_fake_death") {
        return Boolean(state.pendingReaction && state.pendingReaction.baseDamage >= pendingDefender.health);
      }

      return true;
    }) ?? [];

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

  if (state.pendingDiscard && pendingDiscardPlayer) {
    return (
      <section className="action-panel reaction-panel">
        <div>
          <p className="eyebrow">Discard Choice</p>
          <h2>{pendingDiscardPlayer.name}, discard {state.pendingDiscard.count}</h2>
          <p>{state.pendingDiscard.reason} forces you to choose which cards leave your hand.</p>
        </div>
        <div className="pending-discard-list">
          {pendingDiscardPlayer.hand.map((card) => {
            const definition = getCardDefinitionById(card.definitionId);
            const isSelected = discardSelection.includes(card.instanceId);
            return definition ? (
              <button
                className={`reaction-card-button${isSelected ? " is-selected" : ""}`}
                key={card.instanceId}
                onClick={() =>
                  setDiscardSelection((current) => {
                    if (current.includes(card.instanceId)) {
                      return current.filter((id) => id !== card.instanceId);
                    }

                    if (current.length >= state.pendingDiscard!.count) {
                      return [...current.slice(1), card.instanceId];
                    }

                    return [...current, card.instanceId];
                  })
                }
              >
                <CardView card={definition} mode="board" isSelected={isSelected} />
              </button>
            ) : null;
          })}
        </div>
        <p className="menu-note">
          Selected {discardSelection.length} of {state.pendingDiscard.count}.
        </p>
        <button
          disabled={discardSelection.length < Math.min(state.pendingDiscard.count, pendingDiscardPlayer.hand.length)}
          onClick={() => {
            dispatch({
              type: "RESOLVE_PENDING_DISCARD",
              playerId: pendingDiscardPlayer.id,
              cardInstanceIds: discardSelection
            });
            setDiscardSelection([]);
          }}
        >
          Confirm Discard
        </button>
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
          disabled={currentPlayer.hand.length > state.settings.maxHandSize}
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
            {selectedDefinition.type === "ability" && selectedDefinition.target !== "onePlayer" && (
              <button
                disabled={!canAct || !["ability_ambush", "ability_adrenaline"].includes(selectedDefinition.id)}
                onClick={() =>
                  dispatch({
                    type: "PLAY_ABILITY",
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
          <p>Play weapons directly from hand, play simple healing, use implemented abilities, or discard down to {state.settings.maxHandSize} cards.</p>
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
      {selectedDefinition?.type === "ability" && selectedDefinition.target === "onePlayer" && (
        <div className="attack-box">
          <h2>Ability Target</h2>
          <p>
            {["ability_steal", "ability_sabotage", "ability_mark_target"].includes(selectedDefinition.id)
              ? `Choose a target for ${selectedDefinition.name}.`
              : "This ability is not implemented yet."}
          </p>
          <div className="target-list">
            {livingTargets.map((target) => (
              <button
                disabled={
                  !canAct ||
                  !selectedCard ||
                  !["ability_steal", "ability_sabotage", "ability_mark_target"].includes(selectedDefinition.id)
                }
                key={target.id}
                onClick={() =>
                  selectedCard &&
                  dispatch({
                    type: "PLAY_ABILITY",
                    playerId: currentPlayer.id,
                    cardInstanceId: selectedCard.instanceId,
                    targetPlayerId: target.id
                  })
                }
              >
                {target.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
