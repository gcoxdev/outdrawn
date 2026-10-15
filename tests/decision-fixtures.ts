import { createNewGame } from "../src/game/setup";
import { saveGame } from "../src/game/persistence";
import { gameReducer } from "../src/game/reducer";
import { validateSavedGame } from "../src/game/validateSave";

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
  function discardEvent(definitionId: string) {
    const state = structuredClone(base);
    state.mainDeck.unshift(card(definitionId));
    return gameReducer(gameReducer(state, { type: "DRAW_CARD", playerId: "player_1" }), { type: "ACKNOWLEDGE_EVENT_DIALOG" });
  }
  const noCover = discardEvent("event_no_cover");
  const lowAmmo = discardEvent("event_low_ammo");
  const attack = { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: base.players[0].hand[0].instanceId } as const;
  const intimidated = structuredClone(base);
  intimidated.intimidations = { player_1: ["player_2"] };
  const intimidate = gameReducer(intimidated, attack);
  const reaction = gameReducer(structuredClone(base), attack);
  reaction.players[1].hand.push(card("defense_fake_death"), card("defense_decoy"));
  const secondary = structuredClone(reaction);
  secondary.pendingSecondaryDamage = { ...secondary.pendingReaction!, source: "ricochet", remaining: [] };
  secondary.pendingReaction = null;
  return Object.fromEntries(Object.entries({ base, search, supply, market, trade, minigun, warning, noCover, lowAmmo, intimidate, reaction, secondary }).map(([name, state]) => {
    validateSavedGame(state);
    let serialized = "";
    saveGame(state, { setItem: (_key, value) => { serialized = value; }, removeItem() {} });
    return [name, serialized];
  }));
}
