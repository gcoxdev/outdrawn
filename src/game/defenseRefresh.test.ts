import { describe, expect, it } from "vitest";
import { resolveAttack, resolveSecondaryDamage } from "./combat";
import { gameReducer } from "./reducer";
import { createNewGame } from "./setup";
import { chooseAutomatedAction } from "./simulator";

function fixture(defenseId: string, weaponId = "weapon_pistol") {
  const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
  const weapon = { instanceId: "weapon", definitionId: weaponId };
  const reaction = { instanceId: "defense", definitionId: defenseId };
  state.players.forEach(player => { player.hand = []; });
  state.players[0].hand = [weapon];
  state.players[1].hand = [reaction];
  return { state, weapon, reaction };
}

describe("refreshed blocking defenses", () => {
  it.each([
    ["defense_armor_vest", 3, 0],
    ["defense_armor_vest", 8, 4],
    ["defense_shield_plate", 1, 0],
    ["defense_shield_plate", 3, 1],
    ["defense_shield_plate", 8, 4],
    ["defense_brace", 1, 0],
    ["defense_brace", 3, 1],
    ["defense_brace", 8, 6]
  ])("%s against %i damage resolves ordinary and secondary hits", (id, damage, normal) => {
    const { state, weapon, reaction } = fixture(id, "weapon_pistol");
    const [attacker, defender] = state.players;
    const primary = resolveAttack(state, attacker, defender, weapon, reaction, { baseDamageOverride: damage });
    const secondary = resolveSecondaryDamage(state, attacker, defender, weapon, damage, "ricochet", reaction);
    const expected = 20 - normal;
    expect(primary.state.players[1].health).toBe(expected);
    expect(secondary.state.players[1].health).toBe(expected);
  });

  it.each([
    ["defense_armor_vest", 16],
    ["defense_shield_plate", 18],
    ["defense_brace", 18]
  ])("Crossbow pierces Armor Vest only: %s leaves %i health", (id, health) => {
    const { state, weapon, reaction } = fixture(id, "weapon_crossbow");
    const [attacker, defender] = state.players;
    expect(resolveAttack(state, attacker, defender, weapon, reaction).state.players[1].health).toBe(health);
    expect(resolveSecondaryDamage(state, attacker, defender, weapon, 4, "ricochet", reaction).state.players[1].health).toBe(health);
  });

  it("Shield Plate halves only its SMG hit and is discarded before the next reaction", () => {
    const { state, weapon, reaction } = fixture("defense_shield_plate", "weapon_smg");
    const [attacker, defender] = state.players;
    let next = gameReducer(state, { type: "ATTACK", attackerId: attacker.id, targetPlayerId: defender.id, weaponInstanceId: weapon.instanceId });
    next = gameReducer(next, { type: "PLAY_REACTION", defenderId: defender.id, reactionCardInstanceId: reaction.instanceId });
    expect(next.players[1].health).toBe(19);
    expect(next.players[1].hand).toHaveLength(0);
    expect(next.pendingReaction?.baseDamage).toBe(2);
    next = gameReducer(next, { type: "SKIP_REACTION", defenderId: defender.id });
    expect(next.players[1].health).toBe(17);
    expect(next.discardPile.filter(card => card.instanceId === reaction.instanceId)).toHaveLength(1);
  });

  it.each(["defense_shield_plate", "defense_brace"])("computer players recognize %s as a useful defense", id => {
    const { state, weapon, reaction } = fixture(id, "weapon_sniper_rifle");
    state.pendingReaction = { attackerId: state.players[0].id, defenderId: state.players[1].id, weapon, baseDamage: 8 };
    expect(chooseAutomatedAction(state, "competent", () => 0.5)).toMatchObject({ type: "PLAY_REACTION", reactionCardInstanceId: reaction.instanceId });
  });

  it.each([[4, "vest"], [10, "shield"]])("computer players choose the larger damage reduction against %i", (damage, expectedCard) => {
    const { state, weapon } = fixture("defense_brace");
    state.players[1].hand = [
      { instanceId: "shield", definitionId: "defense_shield_plate" },
      { instanceId: "vest", definitionId: "defense_armor_vest" },
      { instanceId: "brace", definitionId: "defense_brace" }
    ];
    state.pendingReaction = { attackerId: state.players[0].id, defenderId: state.players[1].id, weapon, baseDamage: damage };
    expect(chooseAutomatedAction(state, "competent", () => 0.5)).toMatchObject({ type: "PLAY_REACTION", reactionCardInstanceId: expectedCard });
  });
});
