import type { GameState, PlayerState, ResolvedEffect } from "./types";

/** Per-action diagnostics, emitted where an effect resolves, before mixed effects can cancel out. */
export function recordEffects(state: GameState, ...effects: ResolvedEffect[]): GameState {
  const applied = effects.filter(effect => effect.amount > 0);
  return applied.length ? { ...state, resolvedEffects: [...(state.resolvedEffects ?? []), ...applied] } : state;
}

export function recordHealthChanges(before: PlayerState[], state: GameState, source: ResolvedEffect["source"], cardDefinitionId?: string, sourcePlayerId?: string): GameState {
  return recordEffects(state, ...state.players.flatMap(player => {
    const change = player.health - (before.find(previous => previous.id === player.id)?.health ?? player.health);
    return change ? [{ kind: change > 0 ? "healing" as const : "damage" as const, source, cardDefinitionId, sourcePlayerId, playerId: player.id, amount: Math.abs(change) }] : [];
  }));
}

export function recordCombatEffects(state: GameState, attacker: PlayerState, defender: PlayerState, cardDefinitionId: string, baseDamage: number, damage: number, reviveHealth: number | undefined, counterDamage: number, attackerReward: number, defenderReward: number, source: ResolvedEffect["source"], reactionId?: string): GameState {
  const actualDamage = reviveHealth === undefined ? Math.min(defender.health, damage) : Math.max(0, defender.health - 1);
  return recordEffects(state,
    { kind: "damage", source, cardDefinitionId, sourcePlayerId: attacker.id, playerId: defender.id, amount: actualDamage },
    { kind: "prevention", source, cardDefinitionId: reactionId, sourcePlayerId: defender.id, playerId: defender.id, amount: Math.max(0, Math.min(defender.health, baseDamage) - actualDamage) },
    { kind: "healing", source: "revive", cardDefinitionId: reactionId, sourcePlayerId: defender.id, playerId: defender.id, amount: reviveHealth === undefined ? 0 : reviveHealth - 1 },
    { kind: "damage", source: "counterattack", cardDefinitionId: reactionId, sourcePlayerId: defender.id, playerId: attacker.id, amount: Math.min(attacker.health, counterDamage) },
    { kind: "healing", source: "eliminationReward", sourcePlayerId: attacker.id, playerId: attacker.id, amount: attackerReward },
    { kind: "healing", source: "eliminationReward", sourcePlayerId: defender.id, playerId: defender.id, amount: defenderReward }
  );
}
