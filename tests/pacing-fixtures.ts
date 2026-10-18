import { createNewGame } from "../src/game/setup";
import { saveGame } from "../src/game/persistence";
import { validateSavedGame } from "../src/game/validateSave";

export function getPacingFixtures() {
  function base(count: number) {
    const game = createNewGame(Array.from({ length: count }, (_, i) => ({ name: `Player ${i + 1}`, controller: i === count - 1 ? { type: "human" as const } : { type: "computer" as const, strategy: "master" as const } })), () => 0);
    game.settings.passDeviceMode = false;
    game.players.forEach(player => { player.hand = []; player.actionsRemaining = 0; player.freeDrawsRemaining = 0; });
    game.mainDeck = [];
    game.discardPile = [];
    return game;
  }
  const large = base(100);
  const event = base(3);
  event.players[0].freeDrawsRemaining = 1;
  event.mainDeck = [{ instanceId: "pressure", definitionId: "event_pressure_zone" }];
  const finish = structuredClone(event);
  finish.players.forEach(player => { player.health = 1; });
  const attack = base(2);
  attack.players[0].hand = [{ instanceId: "pistol", definitionId: "weapon_pistol" }];
  attack.players[0].actionsRemaining = 1;
  const handoff = base(3);
  handoff.settings.passDeviceMode = true;
  handoff.players[1].controller = { type: "human" };
  const elimination = base(3);
  elimination.players[0].health = 1;
  const weapon = { instanceId: "pistol", definitionId: "weapon_pistol" };
  elimination.players[2].hand = [weapon];
  elimination.pendingReaction = { attackerId: "player_3", defenderId: "player_1", weapon, baseDamage: 3 };
  return Object.fromEntries(Object.entries({ large, event, finish, attack, handoff, elimination }).map(([name, state]) => {
    validateSavedGame(state);
    let serialized = "";
    saveGame(state, { setItem: (_key, value) => { serialized = value; }, removeItem() {} });
    return [name, serialized];
  }));
}
