import { allCards } from "../data/cards";
import type { PlayerState } from "./types";

/** Resolve lethal protection before elimination, loot, rewards, or victory checks. */
export function damagePlayer(player: PlayerState, amount: number) {
  const noDamage = player.eliminated || player.recovering || amount <= 0;
  const revive = !noDamage && amount >= player.health && player.hand.some(card => card.definitionId === "defense_revive");
  const discarded = revive ? player.hand.filter(card => allCards.find(definition => definition.id === card.definitionId)?.type !== "healing") : [];
  const health = noDamage ? player.health : revive ? 1 : Math.max(0, player.health - amount);
  return {
    player: noDamage ? player : {
      ...player, health, eliminated: health === 0,
      ...(revive ? { recovering: true, hand: player.hand.filter(card => !discarded.includes(card)), actionsRemaining: 0, freeDrawsRemaining: 0 } : {})
    },
    discarded,
    revived: Boolean(revive),
    damage: player.health - health
  };
}

export function recoveryMessage(player: PlayerState): string {
  return `${player.name}'s Revive activated. They are recovering at 1 health until their next turn, keeping only healing cards.`;
}
