import { createNewGame } from "../src/game/setup";
import { gameReducer } from "../src/game/reducer";
import { saveGame } from "../src/game/persistence";
import { validateSavedGame } from "../src/game/validateSave";

export function getReviveFixtures() {
  let sequence = 0;
  const card = (definitionId: string) => ({ definitionId, instanceId: `revive_browser_${++sequence}` });
  const holding = createNewGame(["Ari", "Blake", "Casey"], () => 0);
  holding.settings.passDeviceMode = false;
  holding.players.forEach(player => { player.hand = []; player.health = 10; });
  holding.mainDeck = []; holding.discardPile = []; holding.eventDiscardPile = [];
  holding.players[0].hand = [card("defense_revive"), card("weapon_pistol")];
  let reaction = structuredClone(holding);
  reaction.players[0].hand = [card("weapon_pistol")];
  reaction.players[1].health = 2;
  reaction.players[1].hand = [card("defense_revive"), card("healing_medkit"), card("weapon_knife")];
  reaction = gameReducer(reaction, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: reaction.players[0].hand[0].instanceId });
  const event = structuredClone(holding);
  event.players[0].health = 1;
  event.players[0].hand = [card("defense_revive"), card("healing_painkillers")];
  event.mainDeck = [card("event_pressure_zone"), card("weapon_knife")];
  return Object.fromEntries(Object.entries({ holding, reaction, event }).map(([name, state]) => {
    validateSavedGame(state);
    let serialized = "";
    saveGame(state, { setItem: (_key, value) => { serialized = value; }, removeItem() {} });
    return [name, serialized];
  }));
}
