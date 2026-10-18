import { createNewGame } from "../src/game/setup";
import { gameReducer } from "../src/game/reducer";
import { saveGame } from "../src/game/persistence";

export function fixtures() {
  return Object.fromEntries([false, true].map(secondary => {
    let state = createNewGame(["Ari", "Blake"], () => 0);
    state.settings.passDeviceMode = false;
    state.settings.allowSecondaryDefense = secondary;
    state.players[0].hand = [{ instanceId: "pistol", definitionId: "weapon_pistol" }];
    state.players[1].hand = [{ instanceId: "ricochet", definitionId: "defense_ricochet" }];
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: "pistol" });
    let saved = "";
    saveGame(state, { setItem: (_, value) => { saved = value; }, removeItem() {} });
    return [secondary ? "secondary" : "immediate", saved];
  }));
}
