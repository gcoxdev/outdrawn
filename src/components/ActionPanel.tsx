import { useState } from "react";
import type { Card } from "../data/cards";
import { blackMarketPresets, type BlackMarketConfig } from "../data/constants";
import type { GameAction } from "../game/actions";
import { getCardDefinitionById, getPlayer, isHostileTarget } from "../game/rules";
import type { CardInstance, GameState, PlayerState } from "../game/types";
import { CardBack, CardView } from "./CardView";
import type { HandDiscardRequirement } from "./GameTable";

type ActionPanelProps = {
  state: GameState;
  currentPlayer: PlayerState;
  selectedCard: CardInstance | null;
  selectedDiscardCards: CardInstance[];
  discardRequirement: HandDiscardRequirement | null;
  isComputerDecision: boolean;
  dispatch: (action: GameAction) => void;
};

export function ActionPanel({ state, currentPlayer, selectedCard, selectedDiscardCards, discardRequirement, isComputerDecision, dispatch }: ActionPanelProps) {
  const [marketSelection, setMarketSelection] = useState<string[]>([]);
  const selectedDefinition = selectedCard ? getCardDefinitionById(selectedCard.definitionId) : undefined;
  const selectedIsWeapon = selectedDefinition?.type === "weapon";
  const selectedIsTargetedAbility = selectedDefinition?.type === "ability" && selectedDefinition.target === "onePlayer";
  const selectedWeaponHitsEveryone = selectedDefinition?.type === "weapon" && selectedDefinition.target === "allPlayers";
  const overHandLimit = discardRequirement?.type === "handLimit";
  const blackMarketConfig =
    state.settings.blackMarketPreset === "custom" ? state.settings.blackMarketCustom : blackMarketPresets[state.settings.blackMarketPreset];
  const livingTargets = state.players.filter(
    (player) => !player.eliminated && isHostileTarget(currentPlayer, player) && !state.smokeProtectedPlayerIds.includes(player.id)
  );
  const teammateTargets = state.players.filter(
    (player) => !player.eliminated && player.id !== currentPlayer.id && currentPlayer.teamId && player.teamId === currentPlayer.teamId
  );
  const canAct =
    state.phase === "action" &&
    !state.pendingReaction &&
    !state.pendingRedirect &&
    !state.pendingSecondaryDamage &&
    !state.pendingAttackCost &&
    !state.pendingMultiHitAttack &&
    !state.pendingDiscard &&
    !state.pendingSearch &&
    !state.pendingSupplyDrop &&
    !state.pendingMarketSearch &&
    !state.pendingBlackMarket &&
    !state.pendingSteal &&
    currentPlayer.actionsRemaining > 0;
  const canEndTurn =
    state.phase === "action" &&
    !state.pendingReaction &&
    !state.pendingRedirect &&
    !state.pendingSecondaryDamage &&
    !state.pendingAttackCost &&
    !state.pendingMultiHitAttack &&
    !state.pendingDiscard &&
    !state.pendingSearch &&
    !state.pendingSupplyDrop &&
    !state.pendingMarketSearch &&
    !state.pendingBlackMarket &&
    !state.pendingSteal;
  const activeReaction = state.pendingReaction ?? state.pendingSecondaryDamage;
  const pendingDefender = activeReaction ? getPlayer(state, activeReaction.defenderId) : undefined;
  const pendingAttacker = activeReaction ? getPlayer(state, activeReaction.attackerId) : undefined;
  const pendingRedirectDefender = state.pendingRedirect ? getPlayer(state, state.pendingRedirect.defenderId) : undefined;
  const pendingRedirectAttacker = state.pendingRedirect ? getPlayer(state, state.pendingRedirect.attackerId) : undefined;
  const pendingAttackCostPlayer = state.pendingAttackCost ? getPlayer(state, state.pendingAttackCost.attackerId) : undefined;
  const pendingAttackCostTarget = state.pendingAttackCost ? getPlayer(state, state.pendingAttackCost.targetPlayerId) : undefined;
  const pendingDiscardPlayer = state.pendingDiscard ? getPlayer(state, state.pendingDiscard.playerId) : undefined;
  const pendingSupplyDropPlayer = state.pendingSupplyDrop
    ? getPlayer(state, state.pendingSupplyDrop.playerOrder[state.pendingSupplyDrop.currentIndex])
    : undefined;
  const pendingMarketPlayer = state.pendingMarketSearch ? getPlayer(state, state.pendingMarketSearch.playerId) : undefined;
  const pendingBlackMarketPlayer = state.pendingBlackMarket ? getPlayer(state, state.pendingBlackMarket.playerId) : undefined;
  const pendingStealPlayer = state.pendingSteal ? getPlayer(state, state.pendingSteal.playerId) : undefined;
  const pendingStealTarget = state.pendingSteal ? getPlayer(state, state.pendingSteal.targetPlayerId) : undefined;
  const reactionCards =
    pendingDefender?.hand.filter((card) => {
      const definition = getCardDefinitionById(card.definitionId);
      if (definition?.type !== "defense" && !definition?.isLethalDefense) {
        return false;
      }

      if (state.pendingSecondaryDamage && definition.id === "defense_decoy") {
        return false;
      }

      if (definition.isLethalDefense) {
        return Boolean(activeReaction && activeReaction.baseDamage >= pendingDefender.health);
      }

      if (definition.id === "defense_decoy") {
        return state.players.some(
          (player) =>
            activeReaction &&
            !player.eliminated &&
            player.id !== activeReaction.attackerId &&
            player.id !== pendingDefender.id &&
            isHostileTarget(pendingDefender, player)
        );
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

  if (activeReaction && pendingDefender && pendingAttacker) {
    const weaponDefinition = getCardDefinitionById(activeReaction.weapon.definitionId);
    const smgHitNumber =
      state.pendingReaction && state.pendingMultiHitAttack?.weapon.instanceId === state.pendingReaction.weapon.instanceId
        ? 3 - state.pendingMultiHitAttack.hitsRemaining
        : null;
    const isSecondary = Boolean(state.pendingSecondaryDamage);
    const selectedReactionCard = selectedCard && reactionCards.some((card) => card.instanceId === selectedCard.instanceId) ? selectedCard : null;
    const selectedReactionDefinition = selectedReactionCard ? getCardDefinitionById(selectedReactionCard.definitionId) : undefined;

    return (
      <section className="action-panel reaction-panel">
        <div>
          <p className="eyebrow">{isSecondary ? "Secondary Defense" : "Reaction"}</p>
          <h2>{pendingDefender.name} is under attack</h2>
          <p>
            {isSecondary
              ? `${pendingDefender.name} can defend against ${getSecondarySourceLabel(state.pendingSecondaryDamage?.source)} for ${activeReaction.baseDamage} base damage.`
              : `${pendingAttacker.name} played ${weaponDefinition?.name ?? "a weapon"} for ${activeReaction.baseDamage} base damage.`}
            {smgHitNumber ? ` Hit ${smgHitNumber} of 2.` : ""}
          </p>
          <p>Select a defense card from your hand above, or take the hit.</p>
        </div>
        <div className="action-row">
          <button
            disabled={!selectedReactionCard}
            onClick={() =>
              selectedReactionCard &&
              dispatch({
                type: isSecondary ? "PLAY_SECONDARY_REACTION" : "PLAY_REACTION",
                defenderId: pendingDefender.id,
                reactionCardInstanceId: selectedReactionCard.instanceId
              })
            }
          >
            {selectedReactionDefinition ? `Play ${selectedReactionDefinition.name}` : "Play Defense"}
          </button>
          <button onClick={() => dispatch({ type: isSecondary ? "SKIP_SECONDARY_REACTION" : "SKIP_REACTION", defenderId: pendingDefender.id })}>
            Take Hit
          </button>
        </div>
      </section>
    );
  }

  if (state.pendingRedirect && pendingRedirectDefender && pendingRedirectAttacker) {
    const weaponDefinition = getCardDefinitionById(state.pendingRedirect.weapon.definitionId);
    const redirectTargets = state.players.filter(
      (player) => !player.eliminated && player.id !== pendingRedirectAttacker.id && player.id !== pendingRedirectDefender.id && isHostileTarget(pendingRedirectDefender, player)
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
    const selectedCount = selectedDiscardCards.length;
    const neededCount = discardRequirement?.type === "attackCost" ? discardRequirement.count : 0;
    return (
      <section className="action-panel reaction-panel">
        <div>
          <p className="eyebrow">Intimidate</p>
          <h2>{pendingAttackCostPlayer.name}, discard 1 card</h2>
          <p>Select a card from your hand above before attacking {pendingAttackCostTarget.name}. The weapon being played cannot pay this cost.</p>
        </div>
        <p className="menu-note">Selected {selectedCount} of {neededCount}.</p>
        <button
          disabled={selectedCount < neededCount}
          onClick={() =>
            selectedDiscardCards[0] &&
            dispatch({
              type: "RESOLVE_PENDING_ATTACK_COST",
              attackerId: pendingAttackCostPlayer.id,
              cardInstanceId: selectedDiscardCards[0].instanceId
            })
          }
        >
          Confirm Discard
        </button>
      </section>
    );
  }

  if (state.pendingDiscard && pendingDiscardPlayer) {
    const selectedCount = selectedDiscardCards.length;
    const neededCount = discardRequirement?.type === "pendingDiscard" ? discardRequirement.count : 0;
    return (
      <section className="action-panel reaction-panel">
        <div>
          <p className="eyebrow">Discard Choice</p>
          <h2>{pendingDiscardPlayer.name}, discard {state.pendingDiscard.count}</h2>
          <p>{state.pendingDiscard.reason} forces you to choose which cards leave your hand. Select cards from your hand above.</p>
        </div>
        <p className="menu-note">
          Selected {selectedCount} of {neededCount}.
        </p>
        <button
          disabled={selectedCount < neededCount}
          onClick={() =>
            dispatch({
              type: "RESOLVE_PENDING_DISCARD",
              playerId: pendingDiscardPlayer.id,
              cardInstanceIds: selectedDiscardCards.map((card) => card.instanceId).slice(0, neededCount)
            })
          }
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
          <h2>{pendingMarketPlayer.name}, keep {state.pendingMarketSearch.keepCount}</h2>
          <p>
            Choose {state.pendingMarketSearch.keepCount} revealed card{state.pendingMarketSearch.keepCount === 1 ? "" : "s"} to add to your hand. The rest go to discard.
          </p>
        </div>
        <div className="pending-discard-list">
          {state.pendingMarketSearch.cards.map((card) => {
            const definition = getCardDefinitionById(card.definitionId);
            const isSelected = marketSelection.includes(card.instanceId);
            return definition ? (
              <button
                className={`reaction-card-button${isSelected ? " is-selected" : ""}`}
                key={card.instanceId}
                onClick={() =>
                  setMarketSelection((current) => {
                    if (current.includes(card.instanceId)) {
                      return current.filter((id) => id !== card.instanceId);
                    }

                    if (current.length >= state.pendingMarketSearch!.keepCount) {
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
          Selected {marketSelection.length} of {state.pendingMarketSearch.keepCount}.
        </p>
        <button
          disabled={marketSelection.length !== state.pendingMarketSearch.keepCount}
          onClick={() => {
            dispatch({
              type: "RESOLVE_MARKET_SEARCH",
              playerId: pendingMarketPlayer.id,
              keepCardInstanceIds: marketSelection
            });
            setMarketSelection([]);
          }}
        >
          Confirm Market Pick
        </button>
      </section>
    );
  }

  if (state.pendingBlackMarket && pendingBlackMarketPlayer) {
    const selectedIds = selectedDiscardCards.map((card) => card.instanceId).slice(0, blackMarketConfig.discardCost);
    const selectedCount = selectedDiscardCards.length;
    const canUseMarket =
      state.phase === "action" &&
      pendingBlackMarketPlayer.health > blackMarketConfig.healthCost &&
      selectedCount === blackMarketConfig.discardCost &&
      new Set(selectedIds).size === blackMarketConfig.discardCost;

    return (
      <section className="action-panel reaction-panel">
        <div>
          <p className="eyebrow">Black Market</p>
          <h2>{pendingBlackMarketPlayer.name}, trade or pass</h2>
          <p>{getBlackMarketSummary(blackMarketConfig)} Select discard payment from your hand above.</p>
        </div>
        {blackMarketConfig.discardCost > 0 && <p className="menu-note">Selected {selectedCount} of {blackMarketConfig.discardCost}.</p>}
        <div className="action-row">
          <button
            disabled={!canUseMarket}
            onClick={() => {
              dispatch({
                type: "START_BLACK_MARKET",
                playerId: pendingBlackMarketPlayer.id,
                cardInstanceIds: selectedIds
              });
            }}
          >
            Trade
          </button>
          <button
            onClick={() => {
              dispatch({ type: "PASS_BLACK_MARKET", playerId: pendingBlackMarketPlayer.id });
            }}
          >
            Pass
          </button>
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
          <p>Pick one card from {pendingStealTarget.name}'s hand.</p>
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
          disabled={!canEndTurn || overHandLimit}
          onClick={() => dispatch({ type: "END_TURN", playerId: currentPlayer.id })}
        >
          End Turn
        </button>
      </div>
      {overHandLimit && (
        <p className="hand-limit-warning" role="status">
          {currentPlayer.name} has {currentPlayer.hand.length} cards. Discard down to {state.settings.maxHandSize} before ending turn.
        </p>
      )}

      <div className="action-panel__decision-grid">
        {overHandLimit ? (
          <div className="discard-action-box">
            <div>
              <h2>Select discards</h2>
              <p>
                Choose {discardRequirement?.count ?? 0} card{(discardRequirement?.count ?? 0) === 1 ? "" : "s"} from your hand above.
              </p>
              <p className="menu-note">
                Selected {selectedDiscardCards.length} of {discardRequirement?.count ?? 0}.
              </p>
            </div>
            <button
              disabled={selectedDiscardCards.length < (discardRequirement?.count ?? 0)}
              onClick={() =>
                dispatch({
                  type: "DISCARD_CARDS",
                  playerId: currentPlayer.id,
                  cardInstanceIds: selectedDiscardCards.map((card) => card.instanceId).slice(0, discardRequirement?.count ?? 0)
                })
              }
            >
              Discard Selected
            </button>
          </div>
        ) : selectedDefinition && selectedCard ? (
          <div className="selected-action-box">
            <div>
              <h2>{selectedDefinition.name}</h2>
              <p>{selectedDefinition.rulesText}</p>
            </div>
            <div className="selected-action-box__commands">
              {selectedDefinition.type === "healing" && (
                <button
                  disabled={!canPlayHealingCard(currentPlayer, selectedDefinition, currentPlayer, state.settings.maxHealth, canAct)}
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
          {selectedDefinition?.type === "healing" && teammateTargets.length > 0 && state.settings.allowTeamHealing && (
            <div className="attack-box">
              <h2>Heal Teammate</h2>
              <p>Choose a teammate to receive {selectedDefinition.name}.</p>
              <div className="target-list">
                {teammateTargets.map((target) => (
                  <button
                    disabled={!selectedCard || !canPlayHealingCard(currentPlayer, selectedDefinition, target, state.settings.maxHealth, canAct)}
                    key={target.id}
                    onClick={() =>
                      selectedCard &&
                      dispatch({
                        type: "PLAY_HEALING",
                        playerId: currentPlayer.id,
                        targetPlayerId: target.id,
                        cardInstanceId: selectedCard.instanceId
                      })
                    }
                  >
                    {target.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedCard && teammateTargets.length > 0 && state.settings.allowTeamCardTransfer && (
            <div className="attack-box">
              <h2>Transfer</h2>
              <p>Give this card to a teammate as 1 action.</p>
              <div className="target-list">
                {teammateTargets.map((target) => (
                  <button
                    disabled={!canAct || currentPlayer.actionsRemaining < 1}
                    key={target.id}
                    onClick={() =>
                      dispatch({
                        type: "TRANSFER_CARD",
                        playerId: currentPlayer.id,
                        targetPlayerId: target.id,
                        cardInstanceId: selectedCard.instanceId
                      })
                    }
                  >
                    {target.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function getSecondarySourceLabel(source: string | undefined): string {
  if (source === "splash") {
    return "splash damage";
  }

  if (source === "ricochet") {
    return "Ricochet";
  }

  if (source === "minigun") {
    return "Minigun damage";
  }

  return source === "backfire" ? "Backfire damage" : "Counterattack damage";
}

export function canPlayHealingCard(
  player: PlayerState,
  definition: Card,
  target: PlayerState,
  maxHealth: number,
  canAct: boolean
): boolean {
  if (!canAct || definition.type !== "healing" || player.actionsRemaining < (definition.actionsCost ?? 1)) {
    return false;
  }

  return !((definition.heal ?? 0) > 0 && target.health >= maxHealth && !definition.draw);
}

function getBlackMarketSummary(config: BlackMarketConfig) {
  const costs = [
    config.discardCost > 0 ? `discard ${config.discardCost} card${config.discardCost === 1 ? "" : "s"}` : null,
    config.healthCost > 0 ? `pay ${config.healthCost} health` : null
  ].filter(Boolean);
  const costText = costs.length > 0 ? costs.join(", ") : "pay no extra cost";
  return `${costText}; reveal ${config.revealCount}, keep ${config.keepCount}, discard the rest.`;
}
