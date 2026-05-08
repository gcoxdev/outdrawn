import { useState } from "react";
import type { GameAction } from "../game/actions";
import { getCardDefinitionById, getPlayer } from "../game/rules";
import type { CardInstance, GameState, PlayerState } from "../game/types";
import { CardBack, CardView } from "./CardView";

type ActionPanelProps = {
  state: GameState;
  currentPlayer: PlayerState;
  selectedCard: CardInstance | null;
  isComputerDecision: boolean;
  dispatch: (action: GameAction) => void;
};

export function ActionPanel({ state, currentPlayer, selectedCard, isComputerDecision, dispatch }: ActionPanelProps) {
  const [discardSelection, setDiscardSelection] = useState<string[]>([]);
  const [marketSelection, setMarketSelection] = useState<string[]>([]);
  const selectedDefinition = selectedCard ? getCardDefinitionById(selectedCard.definitionId) : undefined;
  const selectedIsWeapon = selectedDefinition?.type === "weapon";
  const selectedIsTargetedAbility = selectedDefinition?.type === "ability" && selectedDefinition.target === "onePlayer";
  const selectedWeaponHitsEveryone = selectedDefinition?.type === "weapon" && selectedDefinition.target === "allPlayers";
  const livingTargets = state.players.filter(
    (player) => !player.eliminated && player.id !== currentPlayer.id && !state.smokeProtectedPlayerIds.includes(player.id)
  );
  const canAct =
    state.phase === "action" &&
    !state.pendingReaction &&
    !state.pendingRedirect &&
    !state.pendingAttackCost &&
    !state.pendingMultiHitAttack &&
    !state.pendingDiscard &&
    !state.pendingSearch &&
    !state.pendingSupplyDrop &&
    !state.pendingMarketSearch &&
    !state.pendingSteal &&
    currentPlayer.actionsRemaining > 0;
  const canEndTurn =
    state.phase === "action" &&
    !state.pendingReaction &&
    !state.pendingRedirect &&
    !state.pendingAttackCost &&
    !state.pendingMultiHitAttack &&
    !state.pendingDiscard &&
    !state.pendingSearch &&
    !state.pendingSupplyDrop &&
    !state.pendingMarketSearch &&
    !state.pendingSteal;
  const pendingDefender = state.pendingReaction ? getPlayer(state, state.pendingReaction.defenderId) : undefined;
  const pendingAttacker = state.pendingReaction ? getPlayer(state, state.pendingReaction.attackerId) : undefined;
  const pendingRedirectDefender = state.pendingRedirect ? getPlayer(state, state.pendingRedirect.defenderId) : undefined;
  const pendingRedirectAttacker = state.pendingRedirect ? getPlayer(state, state.pendingRedirect.attackerId) : undefined;
  const pendingAttackCostPlayer = state.pendingAttackCost ? getPlayer(state, state.pendingAttackCost.attackerId) : undefined;
  const pendingAttackCostTarget = state.pendingAttackCost ? getPlayer(state, state.pendingAttackCost.targetPlayerId) : undefined;
  const pendingDiscardPlayer = state.pendingDiscard ? getPlayer(state, state.pendingDiscard.playerId) : undefined;
  const pendingSupplyDropPlayer = state.pendingSupplyDrop
    ? getPlayer(state, state.pendingSupplyDrop.playerOrder[state.pendingSupplyDrop.currentIndex])
    : undefined;
  const pendingMarketPlayer = state.pendingMarketSearch ? getPlayer(state, state.pendingMarketSearch.playerId) : undefined;
  const pendingStealPlayer = state.pendingSteal ? getPlayer(state, state.pendingSteal.playerId) : undefined;
  const pendingStealTarget = state.pendingSteal ? getPlayer(state, state.pendingSteal.targetPlayerId) : undefined;
  const reactionCards =
    pendingDefender?.hand.filter((card) => {
      const definition = getCardDefinitionById(card.definitionId);
      if (definition?.type !== "defense" && !definition?.isLethalDefense) {
        return false;
      }

      if (definition.isLethalDefense) {
        return Boolean(state.pendingReaction && state.pendingReaction.baseDamage >= pendingDefender.health);
      }

      if (definition.id === "defense_decoy") {
        return state.players.some((player) => !player.eliminated && player.id !== state.pendingReaction?.attackerId && player.id !== pendingDefender.id);
      }

      return true;
    }) ?? [];

  if (isComputerDecision) {
    const decisionPlayer =
      pendingDefender ??
      pendingRedirectDefender ??
      pendingAttackCostPlayer ??
      pendingDiscardPlayer ??
      getPlayer(state, state.pendingSearch?.playerId ?? "") ??
      pendingSupplyDropPlayer ??
      pendingMarketPlayer ??
      pendingStealPlayer ??
      currentPlayer;

    return (
      <section className="action-panel ai-thinking-panel">
        <p className="eyebrow">Computer</p>
        <h2>{decisionPlayer.name} is choosing</h2>
        <p>The computer is resolving this decision. Hidden cards stay face down.</p>
      </section>
    );
  }

  if (state.pendingReaction && pendingDefender && pendingAttacker) {
    const weaponDefinition = getCardDefinitionById(state.pendingReaction.weapon.definitionId);
    const smgHitNumber =
      state.pendingMultiHitAttack?.weapon.instanceId === state.pendingReaction.weapon.instanceId
        ? 3 - state.pendingMultiHitAttack.hitsRemaining
        : null;

    return (
      <section className="action-panel reaction-panel">
        <div>
          <p className="eyebrow">Reaction</p>
          <h2>{pendingDefender.name} is under attack</h2>
          <p>
            {pendingAttacker.name} played {weaponDefinition?.name ?? "a weapon"} for {state.pendingReaction.baseDamage} base damage.
            {smgHitNumber ? ` Hit ${smgHitNumber} of 2.` : ""}
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

  if (state.pendingRedirect && pendingRedirectDefender && pendingRedirectAttacker) {
    const weaponDefinition = getCardDefinitionById(state.pendingRedirect.weapon.definitionId);
    const redirectTargets = state.players.filter(
      (player) => !player.eliminated && player.id !== pendingRedirectAttacker.id && player.id !== pendingRedirectDefender.id
    );

    return (
      <section className="action-panel reaction-panel">
        <div>
          <p className="eyebrow">Ricochet</p>
          <h2>{pendingRedirectDefender.name}, redirect the attack</h2>
          <p>
            Choose a new target for {pendingRedirectAttacker.name}'s {weaponDefinition?.name ?? "attack"}.
          </p>
        </div>
        <div className="target-list">
          {redirectTargets.map((target) => (
            <button
              key={target.id}
              onClick={() =>
                dispatch({
                  type: "RESOLVE_PENDING_REDIRECT",
                  defenderId: pendingRedirectDefender.id,
                  targetPlayerId: target.id
                })
              }
            >
              {target.name}
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (state.pendingAttackCost && pendingAttackCostPlayer && pendingAttackCostTarget) {
    return (
      <section className="action-panel reaction-panel">
        <div>
          <p className="eyebrow">Intimidate</p>
          <h2>{pendingAttackCostPlayer.name}, discard 1 card</h2>
          <p>Choose a card to discard before attacking {pendingAttackCostTarget.name}. The weapon being played cannot pay this cost.</p>
        </div>
        <div className="pending-discard-list">
          {pendingAttackCostPlayer.hand.map((card) => {
            const definition = getCardDefinitionById(card.definitionId);
            const isAttackWeapon = card.instanceId === state.pendingAttackCost!.weaponInstanceId;
            return definition ? (
              <button
                className="reaction-card-button"
                disabled={isAttackWeapon}
                key={card.instanceId}
                onClick={() =>
                  dispatch({
                    type: "RESOLVE_PENDING_ATTACK_COST",
                    attackerId: pendingAttackCostPlayer.id,
                    cardInstanceId: card.instanceId
                  })
                }
              >
                <CardView card={definition} mode="board" />
              </button>
            ) : null;
          })}
        </div>
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

  if (state.pendingSearch) {
    const searchingPlayer = getPlayer(state, state.pendingSearch.playerId);
    return (
      <section className="action-panel reaction-panel">
        <div>
          <p className="eyebrow">Search</p>
          <h2>{searchingPlayer?.name ?? "Player"}, keep 1 card</h2>
          <p>Choose one revealed card to add to your hand. The rest go to discard.</p>
        </div>
        <div className="pending-discard-list">
          {state.pendingSearch.cards.map((card) => {
            const definition = getCardDefinitionById(card.definitionId);
            return definition ? (
              <button
                className="reaction-card-button"
                key={card.instanceId}
                onClick={() =>
                  dispatch({
                    type: "RESOLVE_PENDING_SEARCH",
                    playerId: state.pendingSearch!.playerId,
                    keepCardInstanceId: card.instanceId
                  })
                }
              >
                <CardView card={definition} mode="board" />
              </button>
            ) : null;
          })}
        </div>
      </section>
    );
  }

  if (state.pendingSupplyDrop && pendingSupplyDropPlayer) {
    return (
      <section className="action-panel reaction-panel">
        <div>
          <p className="eyebrow">Supply Drop</p>
          <h2>{pendingSupplyDropPlayer.name}, claim 1 card or pass</h2>
          <p>Choose one revealed card to add to your hand. Unclaimed cards are discarded after everyone has had a choice.</p>
        </div>
        <div className="pending-discard-list">
          {state.pendingSupplyDrop.revealedCards.map((card) => {
            const definition = getCardDefinitionById(card.definitionId);
            return definition ? (
              <button
                className="reaction-card-button"
                key={card.instanceId}
                onClick={() =>
                  dispatch({
                    type: "RESOLVE_SUPPLY_DROP_PICK",
                    playerId: pendingSupplyDropPlayer.id,
                    cardInstanceId: card.instanceId
                  })
                }
              >
                <CardView card={definition} mode="board" />
              </button>
            ) : null;
          })}
        </div>
        <button
          onClick={() =>
            dispatch({
              type: "RESOLVE_SUPPLY_DROP_PICK",
              playerId: pendingSupplyDropPlayer.id,
              cardInstanceId: null
            })
          }
        >
          Pass
        </button>
      </section>
    );
  }

  if (state.pendingMarketSearch && pendingMarketPlayer) {
    return (
      <section className="action-panel reaction-panel">
        <div>
          <p className="eyebrow">Black Market</p>
          <h2>{pendingMarketPlayer.name}, keep 1 card</h2>
          <p>Choose one revealed card to add to your hand. The rest go to discard.</p>
        </div>
        <div className="pending-discard-list">
          {state.pendingMarketSearch.cards.map((card) => {
            const definition = getCardDefinitionById(card.definitionId);
            return definition ? (
              <button
                className="reaction-card-button"
                key={card.instanceId}
                onClick={() =>
                  dispatch({
                    type: "RESOLVE_MARKET_SEARCH",
                    playerId: pendingMarketPlayer.id,
                    keepCardInstanceId: card.instanceId
                  })
                }
              >
                <CardView card={definition} mode="board" />
              </button>
            ) : null;
          })}
        </div>
      </section>
    );
  }

  if (state.pendingSteal && pendingStealPlayer && pendingStealTarget) {
    return (
      <section className="action-panel reaction-panel">
        <div>
          <p className="eyebrow">Steal</p>
          <h2>{pendingStealPlayer.name}, choose 1 card</h2>
          <p>Pick one face-down card from {pendingStealTarget.name}'s hand.</p>
        </div>
        <div className="pending-discard-list">
          {pendingStealTarget.hand.map((card) => (
            <button
              className="reaction-card-button"
              key={card.instanceId}
              onClick={() =>
                dispatch({
                  type: "RESOLVE_PENDING_STEAL",
                  playerId: pendingStealPlayer.id,
                  targetPlayerId: pendingStealTarget.id,
                  cardInstanceId: card.instanceId
                })
              }
            >
              <CardBack />
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="action-panel">
      <div className="action-panel__commands">
        <button
          disabled={!canAct || (state.mainDeck.length === 0 && state.discardPile.length === 0)}
          onClick={() => dispatch({ type: "DRAW_CARD", playerId: currentPlayer.id })}
        >
          Draw
        </button>
        <button disabled={!canAct} onClick={() => dispatch({ type: "PASS_ACTION", playerId: currentPlayer.id })}>
          Pass
        </button>
        <button
          disabled={!canEndTurn || currentPlayer.hand.length > state.settings.maxHandSize}
          onClick={() => dispatch({ type: "END_TURN", playerId: currentPlayer.id })}
        >
          End Turn
        </button>
      </div>

      <div className="action-panel__decision-grid">
        {selectedDefinition && selectedCard ? (
          <div className="selected-card">
            <CardView card={selectedDefinition} mode="detail" />
            <div className="selected-card__commands">
              {selectedDefinition.type === "healing" && (
                <button
                  disabled={!canAct || currentPlayer.actionsRemaining < (selectedDefinition.actionsCost ?? 1)}
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
                  disabled={!canAct || !["ability_ambush", "ability_adrenaline", "ability_search", "ability_reload"].includes(selectedDefinition.id)}
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
            <p>Play weapons, healing, and abilities from hand, or discard down to {state.settings.maxHandSize} cards.</p>
          </div>
        )}

        <div className="action-panel__event-actions">
          {selectedIsWeapon && (
            <div className="attack-box">
              <h2>Attack</h2>
              <p>{selectedWeaponHitsEveryone ? `${selectedDefinition.name} hits every other valid player.` : `Choose a target for ${selectedDefinition.name}.`}</p>
              {selectedWeaponHitsEveryone ? (
                <button
                  disabled={!canAct || !selectedCard}
                  onClick={() =>
                    selectedCard &&
                    dispatch({
                      type: "ATTACK",
                      attackerId: currentPlayer.id,
                      weaponInstanceId: selectedCard.instanceId
                    })
                  }
                >
                  Fire at Everyone
                </button>
              ) : (
                <div className="target-list">
                  {livingTargets.map((target) => (
                    <button
                      disabled={!canAct || !selectedCard}
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
              )}
            </div>
          )}
          {selectedIsTargetedAbility && (
            <div className="attack-box">
              <h2>Ability Target</h2>
              <p>
                {["ability_disarm", "ability_steal", "ability_sabotage", "ability_mark_target", "ability_intimidate"].includes(selectedDefinition.id)
                  ? `Choose a target for ${selectedDefinition.name}.`
                  : "This ability is not implemented yet."}
              </p>
              <div className="target-list">
                {livingTargets.map((target) => (
                  <button
                    disabled={
                      !canAct ||
                      !selectedCard ||
                      !["ability_disarm", "ability_steal", "ability_sabotage", "ability_mark_target", "ability_intimidate"].includes(
                        selectedDefinition.id
                      )
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
          {state.activeEvent?.card.definitionId === "event_black_market" && (
            <div className="attack-box">
              <h2>Black Market</h2>
              <p>Select 2 cards from your hand, spend 1 action, and keep 1 of 3 revealed cards.</p>
              <div className="pending-discard-list">
                {currentPlayer.hand.map((card) => {
                  const definition = getCardDefinitionById(card.definitionId);
                  const isSelected = marketSelection.includes(card.instanceId);
                  return definition ? (
                    <button
                      className={`reaction-card-button${isSelected ? " is-selected" : ""}`}
                      disabled={!canAct}
                      key={card.instanceId}
                      onClick={() =>
                        setMarketSelection((current) => {
                          if (current.includes(card.instanceId)) {
                            return current.filter((id) => id !== card.instanceId);
                          }

                          if (current.length >= 2) {
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
              <button
                disabled={!canAct || marketSelection.length !== 2 || state.mainDeck.length + state.discardPile.length === 0}
                onClick={() => {
                  dispatch({
                    type: "START_BLACK_MARKET",
                    playerId: currentPlayer.id,
                    cardInstanceIds: marketSelection
                  });
                  setMarketSelection([]);
                }}
              >
                Search Market
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
