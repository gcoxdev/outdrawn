import type { GameState, PlayerId } from "./types";

/** Move each eliminated hand once, after cards used in the effect have left it. */
export function finalizeEliminations(state: GameState, creditedPlayers: Record<PlayerId, PlayerId> = {}): GameState {
  const eliminated = state.players.filter((player) => player.eliminated && player.hand.length > 0);
  if (eliminated.length === 0) return state;
  const hands = new Map(state.players.map((player) => [player.id, [...player.hand]]));
  const discarded = [...state.discardPile];
  for (const player of eliminated) {
    const recipient = state.players.find((candidate) => candidate.id === creditedPlayers[player.id] && !candidate.eliminated);
    const interruptedWeaponId = state.pendingMultiHitAttack?.attackerId === player.id ? state.pendingMultiHitAttack.weapon.instanceId : null;
    const loot = player.hand.filter(card => card.instanceId !== interruptedWeaponId);
    discarded.push(...player.hand.filter(card => card.instanceId === interruptedWeaponId));
    if (recipient) hands.get(recipient.id)!.push(...loot);
    else discarded.push(...loot);
    hands.set(player.id, []);
  }
  return { ...state, discardPile: discarded, players: state.players.map((player) => ({ ...player, hand: hands.get(player.id)! })) };
}
