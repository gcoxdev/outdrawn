import { createNewGame } from "../src/game/setup";
import { saveGame } from "../src/game/persistence";

export function fixtures() {
  let sequence = 0;
  const card = (definitionId: string) => ({ instanceId: `table_${++sequence}`, definitionId });
  const table = createNewGame(["Ari", "Blake", "Casey", "Morgan"], () => 0);
  table.settings.passDeviceMode = false;
  table.players[0].hand = ["weapon_pistol", "weapon_shotgun", "defense_dodge", "ability_search", "healing_bandage"].map(card);
  table.players[1].hand = [card("defense_dodge")];
  table.mainDeck = [card("weapon_knife"), card("weapon_pistol")];
  const crowded = createNewGame(Array.from({ length: 100 }, (_, index) => `Player ${index + 1} with a long name`), () => 0);
  crowded.settings.passDeviceMode = false;
  crowded.players[0].actionsRemaining = 0;
  crowded.players[0].hand = Array.from({ length: 12 }, () => card("weapon_pistol"));
  const team = structuredClone(table);
  team.players[0].teamId = "team_1";
  team.players[1].teamId = "team_1";
  team.players[2].teamId = "team_2";
  team.players[3].teamId = "team_2";
  return Object.fromEntries(Object.entries({ table, crowded, team }).map(([name, state]) => {
    let serialized = "";
    saveGame(state, { setItem: (_key, value) => { serialized = value; }, removeItem() {} });
    return [name, serialized];
  }));
}
