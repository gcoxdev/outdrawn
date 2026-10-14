import { createNewGame } from "../src/game/setup";
import { saveGame } from "../src/game/persistence";
import { gameReducer } from "../src/game/reducer";

export function fixtures() {
  let sequence = 0;
  const card = (definitionId: string) => ({ instanceId: `dialog_${++sequence}`, definitionId });
  const base = createNewGame(["Ari", "Blake", "Casey", "Morgan"], () => 0);
  base.settings.passDeviceMode = false;
  const discards = structuredClone(base);
  discards.discardPile = ["weapon_pistol", "defense_dodge", "healing_bandage", "ability_search", "weapon_shotgun"].map(card);
  discards.eventDiscardPile = ["event_low_ammo", "event_pressure_zone"].map(card);
  const crowded = structuredClone(discards);
  crowded.discardPile = Array.from({ length: 100 }, () => card("weapon_pistol"));
  const eventBase = structuredClone(base);
  eventBase.mainDeck = [card("event_low_ammo")];
  const event = gameReducer(eventBase, { type: "DRAW_CARD", playerId: base.players[0].id });
  const winner = structuredClone(base);
  winner.phase = "gameOver";
  winner.round = 9;
  winner.winnerId = winner.players[0].id;
  winner.players[0].eliminations = 3;
  winner.players.slice(1).forEach(player => { player.eliminated = true; player.health = 0; });
  const tie = structuredClone(winner);
  tie.winnerId = null;
  tie.players[0].eliminated = true;
  tie.players[0].health = 0;
  const team = createNewGame(Array.from({ length: 30 }, (_, index) => `Player ${index + 1} with a long name`), () => 0);
  team.phase = "gameOver";
  team.winnerId = team.players[0].id;
  team.winnerTeamId = "team_1";
  team.players.forEach((player, index) => { player.teamId = index < 20 ? "team_1" : "team_2"; player.eliminated = index >= 20; });
  return Object.fromEntries(Object.entries({ empty: base, discards, crowded, event, winner, tie, team }).map(([name, state]) => {
    let serialized = "";
    saveGame(state, { setItem: (_key, value) => { serialized = value; }, removeItem() {} });
    return [name, serialized];
  }));
}
