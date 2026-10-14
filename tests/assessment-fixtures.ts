import { createNewGame } from "../src/game/setup";
import { gameReducer } from "../src/game/reducer";
import { saveGame } from "../src/game/persistence";

export function fixtures() {
  const base = createNewGame(["Ann", "Anna", "Ann", "Blake"], () => 0);
  base.players.forEach((player, i) => { player.hand = [{ instanceId: `gun_${i}`, definitionId: "weapon_pistol" }, { instanceId: `dodge_${i}`, definitionId: "defense_dodge" }]; });
  base.mainDeck = Array.from({ length: 20 }, (_, i) => ({ instanceId: `draw_${i}`, definitionId: "weapon_pistol" }));
  const reaction = gameReducer(base, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: "gun_0" });
  const bots = structuredClone(base);
  bots.players.forEach(player => { player.controller = { type: "computer", strategy: "master" }; });
  const roster = createNewGame(Array.from({ length: 100 }, (_, i) => ({ name: `Player ${i + 1}`, teamId: `team_${i % 4 + 1}`, controller: { type: "human" as const } })), () => 0);
  roster.players[99].health = 0; roster.players[99].eliminated = true; roster.discardPile.push(...roster.players[99].hand); roster.players[99].hand = [];
  const result = structuredClone(base);
  result.phase = "gameOver";
  result.winnerId = "player_1";
  result.outcome = { kind: "tiebreak", description: "Everyone fell in the final effect. Most eliminations, then pre-effect health, then pre-effect hand size determined the winner." };
  result.players.forEach(player => { player.health = 0; player.eliminated = true; result.discardPile.push(...player.hand); player.hand = []; });
  const invalid = structuredClone(base);
  Reflect.deleteProperty(invalid.players[0], "hand");
  return Object.fromEntries(Object.entries({ base, reaction, bots, roster, result, invalid }).map(([name, state]) => {
    let raw = ""; saveGame(state, { setItem: (_key, value) => { raw = value; }, removeItem() {} });
    return [name, raw];
  }));
}
