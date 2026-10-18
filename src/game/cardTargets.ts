import type { Card } from "../data/cards";
import type { CardInstance, GameState, PlayerState } from "./types";
import { areTeammates, getCardDefinitionById, isHostileTarget } from "./rules";

export type CardTarget = { player: PlayerState; seat: number; disabledReason?: string; note?: string };

export function getCardTargets(state: GameState, player: PlayerState, card: CardInstance, transfer = false): CardTarget[] {
  const definition = getCardDefinitionById(card.definitionId);
  return state.players.flatMap((target, index) => {
    if (target.eliminated || target.recovering) return [];
    const option: CardTarget = { player: target, seat: index + 1 };
    if (transfer) return state.settings.allowTeamCardTransfer && target.id !== player.id && areTeammates(player, target) ? [option] : [];
    if (definition?.type === "healing") {
      if (target.id !== player.id && !(state.settings.allowTeamHealing && areTeammates(player, target))) return [];
      if ((definition.heal ?? 0) > 0 && target.health >= state.settings.maxHealth && !definition.draw) option.disabledReason = "Already at full health";
      if (target.id === player.id) option.note = "You";
      return [option];
    }
    if (!definition || !(definition.type === "weapon" || (definition.type === "ability" && definition.target === "onePlayer")) || !isHostileTarget(player, target)) return [];
    if (definition.id === "ability_steal") option.note = `${target.hand.length} card${target.hand.length === 1 ? "" : "s"} in hand`;
    if (state.smokeProtectedPlayerIds.includes(target.id)) option.disabledReason = "Smoke Bomb · protected until their next turn";
    else if (definition.type === "weapon" && definition.id !== "weapon_minigun" && state.intimidations[player.id]?.includes(target.id)) {
      if (player.hand.every(held => held.instanceId === card.instanceId)) option.disabledReason = "Intimidate · another card is needed to pay the discard cost";
      else option.note = "Intimidate · discard 1 other card before attacking";
    }
    return [option];
  });
}

export function canPlayHealingCard(player: PlayerState, definition: Card, target: PlayerState, maxHealth: number, canAct: boolean): boolean {
  return canAct && !target.recovering && definition.type === "healing" && player.actionsRemaining >= (definition.actionsCost ?? 1)
    && !((definition.heal ?? 0) > 0 && target.health >= maxHealth && !definition.draw);
}
