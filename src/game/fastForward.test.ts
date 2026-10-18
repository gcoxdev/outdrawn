import { describe, expect, it } from "vitest";
import { canFastForward, createMatchPresentation, matchPresentationReducer as reduce } from "./matchPresentation";
import { createNewGame } from "./setup";
import { getDecisionPlayerId } from "./rules";
import { getPassDeviceContext } from "./privacy";

function fixture(count = 3) {
  const game = createNewGame(Array.from({ length: count }, (_, i) => ({ name: `Player ${i + 1}`, controller: i === count - 1 ? { type: "human" as const } : { type: "computer" as const, strategy: "master" as const } })), () => 0);
  game.players.forEach(player => { player.hand = []; player.actionsRemaining = 0; player.freeDrawsRemaining = 0; });
  game.mainDeck = [];
  game.discardPile = [];
  return createMatchPresentation(game);
}
const start = (state: ReturnType<typeof fixture>) => reduce(state, { type: "START_FAST_FORWARD" });
const advance = (state: ReturnType<typeof fixture>) => reduce(state, { type: "ADVANCE_COMPUTERS", seed: 42 });

describe("skip to the next human decision", () => {
  it("stops at a human turn without spending that player's actions", () => {
    const result = advance(start(fixture()));
    expect(result.fastForward).toBe(false);
    expect(getDecisionPlayerId(result.game)).toBe("player_3");
    expect(result.game.players[2].actionsRemaining).toBe(result.game.settings.actionsPerTurn);
    expect(result.computerRecap!.decisions).toBeGreaterThan(0);
    expect(advance(result)).toBe(result);
  });

  it("stops before a human reaction, even during a computer's turn", () => {
    const state = fixture(2);
    state.game.players[0].hand = [{ instanceId: "pistol", definitionId: "weapon_pistol" }];
    state.game.players[0].actionsRemaining = 1;
    const result = advance(start(state));
    expect(result.fastForward).toBe(false);
    expect(result.game.pendingReaction?.defenderId).toBe("player_2");
    expect(result.game.players[1].health).toBe(state.game.players[1].health);
    expect(result.computerRecap?.decisions).toBe(1);
  });

  it("leaves event explanations open and records actual human damage", () => {
    const state = fixture();
    state.game.players[0].freeDrawsRemaining = 1;
    state.game.mainDeck = [{ instanceId: "event", definitionId: "event_pressure_zone" }];
    const result = advance(start(state));
    expect(result.fastForward).toBe(false);
    expect(result.game.pendingEventDialog?.card.definitionId).toBe("event_pressure_zone");
    expect(result.computerRecap).toMatchObject({ decisions: 1, eventIds: ["event_pressure_zone"], damageTaken: { player_3: 1 } });
    expect(result.game.players[0].id).toBe(getDecisionPlayerId(result.game));
  });

  it("preserves elimination notices and includes them in the recap", () => {
    const state = fixture();
    const weapon = { instanceId: "pistol", definitionId: "weapon_pistol" };
    state.game.players[2].hand = [weapon];
    state.game.players[0].health = 1;
    state.game.pendingReaction = { attackerId: "player_3", defenderId: "player_1", weapon, baseDamage: 3 };
    const result = advance(start(state));
    expect(result.fastForward).toBe(false);
    expect(result.eliminatedPlayerIds).toEqual(["player_1"]);
    expect(result.computerRecap?.eliminatedPlayerIds).toEqual(["player_1"]);
    expect(result.computerRecap?.decisions).toBe(1);
  });

  it("stops when an event ends the match, retaining its recap and elimination notices", () => {
    const state = fixture(2);
    state.game.players.forEach(player => { player.health = 1; });
    state.game.players[0].freeDrawsRemaining = 1;
    state.game.mainDeck = [{ instanceId: "event", definitionId: "event_pressure_zone" }];
    const result = advance(start(state));
    expect(result.game.phase).toBe("gameOver");
    expect(result.fastForward).toBe(false);
    expect(result.game.pendingEventDialog).toBeNull();
    expect(result.eliminatedPlayerIds).toEqual(["player_1", "player_2"]);
    expect(result.computerRecap).toMatchObject({ decisions: 1, eliminatedPlayerIds: ["player_1", "player_2"], eventIds: ["event_pressure_zone"], damageTaken: { player_2: 1 } });
  });

  it("yields after 20 decisions, is deterministic, and can be stopped between batches", () => {
    const state = start(fixture(100));
    const result = advance(state);
    expect(result).toEqual(advance(state));
    expect(state.computerRecap?.decisions).toBe(0);
    expect(result.computerRecap?.decisions).toBe(20);
    expect(result.fastForward).toBe(true);
    const stopped = reduce(result, { type: "STOP_FAST_FORWARD" });
    expect(stopped.game).toBe(result.game);
    expect(stopped.computerRecap).toBe(result.computerRecap);
    expect(advance(stopped)).toBe(stopped);
    expect(reduce(stopped, { type: "DISMISS_COMPUTER_RECAP" }).computerRecap).toBeUndefined();
  });

  it("preserves pass-device handoffs", () => {
    const state = fixture();
    state.game.players[1].controller = { type: "human" };
    state.game.settings.passDeviceMode = true;
    const result = advance(start(state));
    expect(result.fastForward).toBe(false);
    expect(getPassDeviceContext(result.game, "player_3")?.playerId).toBe("player_2");
  });

  it.each(["human", "event", "elimination", "noHuman", "gameOver"])("cannot start while blocked by %s", reason => {
    const state = fixture();
    if (reason === "human") state.game.currentPlayerIndex = 2;
    if (reason === "event") state.game.pendingEventDialog = { playerId: "player_1", card: { instanceId: "event", definitionId: "event_pressure_zone" } };
    if (reason === "elimination") state.eliminatedPlayerIds = ["player_2"];
    if (reason === "noHuman") state.game.players[2].controller = { type: "computer", strategy: "master" };
    if (reason === "gameOver") state.game.phase = "gameOver";
    expect(canFastForward(state)).toBe(false);
    expect(start(state)).toBe(state);
  });

  it("clears pacing and recap on lobby/restart, and does not restore them from game state", () => {
    const state = advance(start(fixture(100)));
    expect(reduce(state, { type: "RESET_GAME" })).toMatchObject({ game: { phase: "setup" }, eliminatedPlayerIds: [] });
    expect(reduce(state, { type: "RESTART_GAME" }).computerRecap).toBeUndefined();
    expect(createMatchPresentation(state.game).fastForward).toBeUndefined();
    expect(createMatchPresentation(state.game).computerRecap).toBeUndefined();
  });
});
