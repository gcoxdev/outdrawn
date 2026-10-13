import { createNewGame } from "../src/game/setup";
import { saveGame } from "../src/game/persistence";

let sequence = 0;
const card = (definitionId: string) => ({ instanceId: `browser_${++sequence}`, definitionId });
export function fixtures() {
  function state() {
    const game = createNewGame(["Ari", "Blake", "Casey"], () => 0);
    game.players.forEach(player => { player.hand = []; });
    game.mainDeck = []; game.discardPile = []; game.settings.passDeviceMode = true;
    return game;
  }
  const death = state();
  death.players[0].health = 1; death.players[0].hand = [card("weapon_pistol")];
  death.mainDeck = [card("event_pressure_zone")];
  const bot = state();
  bot.players[0].controller = { type: "computer", strategy: "master" };
  bot.players[0].hand = [card("weapon_minigun")]; bot.players[1].health = 3;
  const nested = state();
  nested.players.forEach(player => { player.hand = [card("weapon_pistol"), card("defense_dodge")]; });
  nested.players[0].hand.push(card("ability_search"));
  nested.mainDeck = [card("event_low_ammo"), card("event_no_cover"), card("weapon_knife"), card("weapon_pistol"), card("weapon_shotgun")];
  return Object.fromEntries(Object.entries({ death, bot, nested }).map(([name, game]) => {
    let serialized = "";
    saveGame(game, { setItem: (_key, value) => { serialized = value; }, removeItem() {} });
    return [name, serialized];
  }));
}
