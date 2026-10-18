import { useState } from "react";
import { ArrowRightLeft, Trash2 } from "lucide-react";
import type { GameAction } from "../game/actions";
import type { CardInstance, GameState, PlayerState } from "../game/types";
import { canPlayerAct, canPlayerEndTurn, getCardDefinitionById } from "../game/rules";
import { canPlayHealingCard, getCardTargets } from "../game/cardTargets";
import { TargetPicker } from "./TargetPicker";
import { MinigunAllocation } from "./MinigunAllocation";

export function SelectedCardPanel({ state, player, card, dispatch }: {
  state: GameState; player: PlayerState; card: CardInstance; dispatch: (action: GameAction) => void;
}) {
  const definition = getCardDefinitionById(card.definitionId)!;
  const [transfer, setTransfer] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(() => definition.type === "healing" ? player.id : null);
  const options = getCardTargets(state, player, card, transfer);
  const automaticTarget = (transfer || definition.type === "healing") && options.length === 1 ? options[0] : undefined;
  const target = automaticTarget ?? options.find(option => option.player.id === targetId);
  const isMinigun = !transfer && definition.id === "weapon_minigun";
  const isReaction = definition.type === "defense" || definition.isLethalDefense;
  const needsTarget = transfer || definition.type === "weapon" || definition.type === "healing" || definition.target === "onePlayer";
  const cost = transfer ? 1 : definition.actionsCost ?? 1;
  const canAct = canPlayerAct(state, player.id) && player.actionsRemaining >= cost;
  const canTransferNow = canPlayerAct(state, player.id);
  const canTransfer = state.settings.allowTeamCardTransfer && getCardTargets(state, player, card, true).length > 0;
  const canSubmit = canAct && (transfer || !isReaction) && (!needsTarget || !!target && !target.disabledReason)
    && (transfer || definition.type !== "healing" || !!target && canPlayHealingCard(player, definition, target.player, state.settings.maxHealth, canAct));
  const targetName = target?.player.name;
  const primaryLabel = transfer ? targetName ? `Give to ${targetName}` : "Give card"
    : definition.type === "weapon" ? targetName ? `Attack ${targetName}` : "Attack"
    : definition.type === "healing" ? targetName ? `Heal ${targetName}` : "Heal"
    : `Play ${definition.name}${needsTarget && targetName ? ` on ${targetName}` : ""}`;

  function submit() {
    if (!canSubmit) return;
    if (transfer) dispatch({ type: "TRANSFER_CARD", playerId: player.id, cardInstanceId: card.instanceId, targetPlayerId: target!.player.id });
    else if (definition.type === "weapon") dispatch({ type: "ATTACK", attackerId: player.id, weaponInstanceId: card.instanceId, targetPlayerId: target!.player.id });
    else if (definition.type === "healing") dispatch({ type: "PLAY_HEALING", playerId: player.id, cardInstanceId: card.instanceId, targetPlayerId: target!.player.id });
    else dispatch({ type: "PLAY_ABILITY", playerId: player.id, cardInstanceId: card.instanceId, ...(target ? { targetPlayerId: target.player.id } : {}) });
  }

  return <section className="selected-action-box card-action-panel" aria-label={`${definition.name} actions`}>
    <header className="card-action-header"><h2>{definition.name}</h2><span className="card-action-cost">{!transfer && definition.isLethalDefense ? "Automatic" : !transfer && isReaction ? "Reaction" : `${cost} action${cost === 1 ? "" : "s"}`}</span></header>
    <p className="card-action-rules">{isMinigun ? `Allocate up to ${(definition.damage ?? 0) + (state.attackBonuses[player.id] ?? 0)} damage, max ${definition.maxDamagePerTarget ?? 3} per opponent.` : definition.rulesText}</p>
    {transfer ? <p className="card-action-note">Give this card to a teammate.</p> : definition.isLethalDefense ? <p className="card-action-note">Activates automatically when any damage would eliminate you. While recovering, you cannot act or be targeted and ignore all damage until your next turn.</p> : isReaction ? <p className="card-action-note">Play this card when you’re defending against an eligible attack.</p> : null}
    {(!isReaction || transfer) && !canAct && <p className="card-action-note" role="status">{player.actionsRemaining === 0 ? "No actions left. You can still discard cards or end your turn." : player.actionsRemaining < cost ? `You need ${cost} actions to ${transfer ? "transfer" : "play"} this card. You have ${player.actionsRemaining} left.` : "Finish the current decision first."}</p>}
    {canAct && (isMinigun ? <MinigunAllocation targets={options.map(option => option.player)} pool={(definition.damage ?? 0) + (state.attackBonuses[player.id] ?? 0)} perTargetCap={definition.maxDamagePerTarget ?? 3}
      disabledReasons={Object.fromEntries(options.filter(option => option.disabledReason).map(option => [option.player.id, option.disabledReason!]))}
      disabled={!canAct} onFire={damageByTarget => dispatch({ type: "ATTACK", attackerId: player.id, weaponInstanceId: card.instanceId, damageByTarget })} />
      : (!isReaction || transfer) && <div className="card-action-play">
        {needsTarget && !automaticTarget && <TargetPicker key={transfer ? "transfer" : "play"} label={transfer ? "Recipient" : "Target"} options={options} value={targetId} onChange={setTargetId} />}
        {automaticTarget?.disabledReason && <p className="card-action-note" role="status">{automaticTarget.disabledReason}</p>}
        <button className="decision-primary card-action-primary" type="button" disabled={!canSubmit} onClick={submit}>{primaryLabel}</button>
      </div>)}
    <footer className="card-action-secondary">
      <button type="button" className="card-action-link" disabled={!canPlayerEndTurn(state, player.id)} onClick={() => dispatch({ type: "DISCARD_CARD", playerId: player.id, cardInstanceId: card.instanceId })}><Trash2 size={14} aria-hidden="true" />Discard</button>
      {canTransfer && <button type="button" className="card-action-link" aria-pressed={transfer} disabled={!transfer && !canTransferNow} title={!canTransferNow ? "Transferring a card requires 1 action." : undefined} onClick={() => { setTransfer(value => !value); setTargetId(!transfer ? null : definition.type === "healing" ? player.id : null); }}><ArrowRightLeft size={14} aria-hidden="true" />{transfer ? "Cancel transfer" : "Transfer"}</button>}
    </footer>
  </section>;
}
