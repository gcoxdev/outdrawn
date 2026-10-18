import { describe, expect, it } from "vitest";
import { createMatchPresentation, matchPresentationReducer as reduce } from "./matchPresentation";
import { createNewGame } from "./setup";
import { getPendingDecision } from "./decisions";
import { readSavedMatch, saveGame } from "./persistence";

function fixture(weaponId = "weapon_pistol") {
  const game = createNewGame(["Ari", "Blake", "Casey", "Morgan"], () => 0);
  game.players.forEach(player => { player.hand = []; });
  const weapon = { instanceId: "notice_weapon", definitionId: weaponId };
  game.players[0].hand = [weapon];
  game.players[1].health = 1;
  game.pendingReaction = { attackerId: "player_1", defenderId: "player_2", weapon, baseDamage: weaponId === "weapon_grenade" ? 4 : 3 };
  return game;
}

describe("live elimination notifications", () => {
  it("pauses actions after a kill and acknowledges without advancing or changing gameplay", () => {
    const result = reduce(createMatchPresentation(fixture()), { type: "SKIP_REACTION", defenderId: "player_2" });
    expect(result.eliminatedPlayerIds).toEqual(["player_2"]);
    expect(reduce(result, { type: "END_TURN", playerId: "player_1" })).toBe(result);
    const acknowledged = reduce(result, { type: "ACKNOWLEDGE_ELIMINATIONS" });
    expect(acknowledged.game).toBe(result.game);
    expect(acknowledged.eliminatedPlayerIds).toEqual([]);
    expect(reduce(acknowledged, { type: "END_TURN", playerId: "player_1" }).game.currentPlayerIndex).toBe(2);
  });

  it("groups a grenade hit and splash eliminations", () => {
    const game = fixture("weapon_grenade");
    game.players[2].health = 1;
    const result = reduce(createMatchPresentation(game), { type: "SKIP_REACTION", defenderId: "player_2" });
    expect(result.eliminatedPlayerIds).toEqual(["player_2", "player_3"]);
  });

  it("does not announce damage prevented by Revive", () => {
    const game = fixture();
    game.players[1].hand = [{ instanceId: "revive", definitionId: "defense_fake_death" }];
    const result = reduce(createMatchPresentation(game), { type: "PLAY_REACTION", defenderId: "player_2", reactionCardInstanceId: "revive" });
    expect(result.game.players[1].health).toBe(1);
    expect(result.eliminatedPlayerIds).toEqual([]);
  });

  it("allows event acknowledgment before showing the eliminations", () => {
    const game = fixture();
    game.pendingReaction = null;
    game.mainDeck = [{ instanceId: "pressure", definitionId: "event_pressure_zone" }];
    const result = reduce(createMatchPresentation(game), { type: "DRAW_CARD", playerId: "player_1" });
    expect(result.game.pendingEventDialog).not.toBeNull();
    expect(result.eliminatedPlayerIds).toEqual(["player_2"]);
    const explained = reduce(result, { type: "ACKNOWLEDGE_EVENT_DIALOG" });
    expect(explained.game.pendingEventDialog).toBeNull();
    expect(explained.eliminatedPlayerIds).toEqual(["player_2"]);
  });

  it("announces collapse eliminations even when they end the match", () => {
    const game = fixture();
    game.pendingReaction = null;
    game.round = 3;
    game.firstPlayerIndex = 1; // Ari finishes the round.
    game.players.forEach((player, index) => { player.actedThisRound = true; player.health = index === 0 ? 10 : 1; });
    const result = reduce(createMatchPresentation(game), { type: "END_TURN", playerId: "player_1" });
    expect(result.game.phase).toBe("gameOver");
    expect(result.eliminatedPlayerIds).toEqual(["player_2", "player_3", "player_4"]);
    expect(reduce(result, { type: "ACKNOWLEDGE_ELIMINATIONS" }).game).toBe(result.game);
  });

  it("restores the game without replaying earlier notifications", () => {
    const result = reduce(createMatchPresentation(fixture()), { type: "SKIP_REACTION", defenderId: "player_2" });
    let serialized = "";
    saveGame(result.game, { setItem: (_key, value) => { serialized = value; }, removeItem() {} });
    const loaded = readSavedMatch(fixture(), { getItem: () => serialized });
    expect(loaded.rejected).toBeUndefined();
    expect(loaded.state.players[1].eliminated).toBe(true);
    expect(createMatchPresentation(loaded.state).eliminatedPlayerIds).toEqual([]);
  });

  it("clears a pending notification on restart", () => {
    const result = reduce(createMatchPresentation(fixture()), { type: "SKIP_REACTION", defenderId: "player_2" });
    const restarted = reduce(result, { type: "RESTART_GAME" });
    expect(restarted.eliminatedPlayerIds).toEqual([]);
    expect(restarted.game.players.every(player => !player.eliminated)).toBe(true);
  });
});


describe("returning to the lobby", () => {
  it.each(["reaction", "search", "event", "finished"])("starts a fresh match after leaving %s", kind => {
    const game = fixture();
    game.settings = { ...game.settings, startingHealth: 30, passDeviceMode: false };
    if (kind !== "reaction") game.pendingReaction = null;
    if (kind === "search") game.pendingSearch = { playerId: "player_1", cards: [game.players[0].hand[0]] };
    if (kind === "event") {
      game.pendingEventDialog = { playerId: "player_1", card: { instanceId: "event", definitionId: "event_pressure_zone" } };
      game.eventDialogQueue = [game.pendingEventDialog];
    }
    if (kind === "finished") {
      game.phase = "gameOver";
      game.winnerId = "player_1";
      game.outcome = { kind: "survivor", description: "Ari wins." };
    }
    const lobby = reduce({ game, eliminatedPlayerIds: ["player_2"] }, { type: "RESET_GAME" });
    const started = reduce(lobby, { type: "START_GAME", playerNames: ["New A", "New B", "New C"] });
    expect(started.game.phase).toBe("action");
    expect(started.game.players.map(player => player.name)).toEqual(["New A", "New B", "New C"]);
    expect(started.game.players.every(player => player.health === 30 && !player.eliminated)).toBe(true);
    expect(getPendingDecision(started.game)).toBeNull();
    expect(started.eliminatedPlayerIds).toEqual([]);
    expect(lobby.game.phase).toBe("setup");
    expect(lobby.game.settings).toEqual(game.settings);
    expect(lobby.game.players).toEqual([]);
    expect(lobby.game.log).toEqual([]);
    expect(getPendingDecision(lobby.game)).toBeNull();
    expect(lobby.game.eventDialogQueue ?? []).toEqual([]);
    expect(lobby.game.outcome).toBeUndefined();
    expect(lobby.game.winnerId).toBeNull();
  });
});
