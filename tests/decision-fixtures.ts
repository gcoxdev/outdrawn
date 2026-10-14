import { createNewGame } from "../src/game/setup";
import { saveGame } from "../src/game/persistence";

export function fixtures() {
  let sequence = 0;
  const card = (definitionId: string) => ({ instanceId: `choice_${++sequence}`, definitionId });
  const base = createNewGame(["Ari", "Blake", "Casey"], () => 0);
  base.players.forEach(player => { player.hand = [card("weapon_pistol"), card("defense_dodge")]; });
  base.mainDeck = [card("weapon_knife"), card("healing_bandage"), card("weapon_shotgun")];
  const choices = () => [card("weapon_pistol"), card("defense_dodge"), card("healing_bandage")];
  const search = structuredClone(base);
  search.pendingSearch = { playerId: "player_1", cards: choices() };
  const supply = structuredClone(base);
  supply.pendingSupplyDrop = { playerOrder: ["player_1", "player_2", "player_3"], currentIndex: 0, revealedCards: choices() };
  const market = structuredClone(base);
  market.pendingMarketSearch = { playerId: "player_1", cards: choices(), keepCount: 2 };
  const trade = structuredClone(base);
  trade.settings.blackMarketPreset = "custom";
  trade.settings.blackMarketCustom = { actionCost: 0, discardCost: 1, healthCost: 2, revealCount: 3, keepCount: 1 };
  trade.pendingBlackMarket = { playerId: "player_1", card: card("event_black_market") };
  const minigun = createNewGame(Array.from({ length: 100 }, (_, i) => `Player ${i + 1}`), () => 0);
  minigun.players[0].hand = [card("weapon_minigun")];
  const warning = structuredClone(base);
  warning.players[0].hand = Array.from({ length: 9 }, () => card("weapon_pistol"));
  return Object.fromEntries(Object.entries({ base, search, supply, market, trade, minigun, warning }).map(([name, state]) => {
    let serialized = "";
    saveGame(state, { setItem: (_key, value) => { serialized = value; }, removeItem() {} });
    return [name, serialized];
  }));
}
