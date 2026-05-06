import { allCards } from "../data/cards";
import type { GameAction } from "../game/actions";
import { getCardDefinitionById } from "../game/rules";
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
  const equippedWeapon = currentPlayer.equippedWeapon;
  const livingTargets = state.players.filter((player) => !player.eliminated && player.id !== currentPlayer.id);
  const canAct = state.phase === "action" && currentPlayer.actionsRemaining > 0;

  return (
    <section className="action-panel">
      <div className="action-panel__commands">
        <button disabled={!canAct || state.mainDeck.length === 0} onClick={() => dispatch({ type: "DRAW_CARD", playerId: currentPlayer.id })}>
          Draw
        </button>
        <button disabled={!canAct} onClick={() => dispatch({ type: "PASS_ACTION", playerId: currentPlayer.id })}>
          Pass
        </button>
        <button onClick={() => dispatch({ type: "END_TURN", playerId: currentPlayer.id })}>End Turn</button>
      </div>

      {selectedDefinition && selectedCard ? (
        <div className="selected-card">
          <CardView card={selectedDefinition} mode="detail" />
          <div className="selected-card__commands">
            {(selectedDefinition.type === "weapon" || selectedDefinition.isEquip) && (
              <button
                disabled={!canAct}
                onClick={() =>
                  dispatch({
                    type: "EQUIP_CARD",
                    playerId: currentPlayer.id,
                    cardInstanceId: selectedCard.instanceId
                  })
                }
              >
                Equip
              </button>
            )}
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
          </div>
        </div>
      ) : (
        <div className="empty-selection">
          <h2>Select a card</h2>
          <p>Equip weapons and armor, play simple healing, or attack with your equipped weapon.</p>
        </div>
      )}

      <div className="attack-box">
        <h2>Attack</h2>
        <p>{equippedWeapon ? allCards.find((card) => card.id === equippedWeapon.definitionId)?.name : "Equip a weapon first"}</p>
        <div className="target-list">
          {livingTargets.map((target) => (
            <button
              disabled={!canAct || !equippedWeapon || Boolean(currentPlayer.weaponCooldowns[equippedWeapon.instanceId])}
              key={target.id}
              onClick={() =>
                equippedWeapon &&
                dispatch({
                  type: "ATTACK",
                  attackerId: currentPlayer.id,
                  targetPlayerId: target.id,
                  weaponInstanceId: equippedWeapon.instanceId
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
