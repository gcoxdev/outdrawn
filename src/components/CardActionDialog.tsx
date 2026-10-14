import { X } from "lucide-react";
import type { GameAction } from "../game/actions";
import { getCardDefinitionById } from "../game/rules";
import type { CardInstance, GameState, PlayerState } from "../game/types";
import { CardView } from "./CardView";
import { Dialog } from "./Dialog";
import { SelectedCardPanel } from "./SelectedCardPanel";

export function CardActionDialog({ state, player, card, canPlay, canReact, dispatch, onClose }: {
  state: GameState; player: PlayerState; card: CardInstance; canPlay: boolean; canReact: boolean;
  dispatch: (action: GameAction) => void; onClose: () => void;
}) {
  const definition = getCardDefinitionById(card.definitionId)!;
  const reaction = state.pendingReaction ?? state.pendingSecondaryDamage;
  return <Dialog className="match-dialog card-action-dialog" label={`${definition.name} card`} onClose={onClose}>
    <section className="match-dialog__panel card-action-dialog__panel">
      <header className="match-dialog__header"><h2>{definition.name}</h2><button type="button" className="match-dialog__close" aria-label="Close card" onClick={onClose}><X size={19} /></button></header>
      <div className="match-dialog__body card-action-dialog__body">
        <div className="card-action-dialog__art"><CardView card={definition} mode="detail" /></div>
        <div className="action-panel">
          {canPlay ? <SelectedCardPanel state={state} player={player} card={card} dispatch={dispatch} /> : <section className="reaction-rules">
            <p>{definition.rulesText}</p>
            {canReact && reaction ? <>
              <p className="card-action-note">Incoming damage: {reaction.baseDamage}</p>
              <button type="button" className="decision-primary" onClick={() => dispatch({ type: state.pendingSecondaryDamage ? "PLAY_SECONDARY_REACTION" : "PLAY_REACTION", defenderId: player.id, reactionCardInstanceId: card.instanceId })}>Play {definition.name}</button>
            </> : reaction && <p className="card-action-note">This card cannot defend against the current attack.</p>}
          </section>}
        </div>
      </div>
    </section>
  </Dialog>;
}
