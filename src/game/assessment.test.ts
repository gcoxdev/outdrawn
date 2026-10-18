import { describe, expect, it } from "vitest";
import { createNewGame } from "./setup";
import { defaultGameSettings } from "../data/constants";
import { getCardDefinitionById } from "./rules";
import { resolveSecondaryDamage } from "./combat";
import { gameReducer } from "./reducer";
import { chooseAutomatedAction, getBotObservation, simulateGame } from "./simulator";
import { readSavedMatch, saveGame, SAVE_KEY } from "./persistence";
import { validateSavedGame } from "./validateSave";
import type { GameState } from "./types";

const card = (id: string, instanceId = id) => ({ definitionId: id, instanceId });
const base = () => createNewGame(["Ann", "Anna", "Ann", "Blake"], () => 0);

describe("assessment follow-up", () => {
  it("keeps 65 regular cards and 16 events after dealing at scaling thresholds and hand limits", () => {
    for (const count of [2, 3, 4, 16, 17, 18, 33, 34, 35, 50, 51, 52, 100]) for (const handSize of [1, 5, 15]) {
      const state = createNewGame(Array.from({ length: count }, (_, i) => `P${i}`), () => 0.37, { ...defaultGameSettings, startingHandSize: handSize });
      expect(state.players.every(player => player.hand.length === handSize)).toBe(true);
      expect(state.mainDeck.filter(card => getCardDefinitionById(card.definitionId)?.type === "event")).toHaveLength(16);
      expect(state.mainDeck).toHaveLength(81);
      expect(new Set([...state.mainDeck, ...state.players.flatMap(player => player.hand)].map(card => card.instanceId)).size).toBe(81 + count * handSize);
    }
  });

  it("preserves invalid nested saves for recovery instead of returning them to rendering", () => {
    for (const corrupt of [
      (state: any) => delete state.players[0].hand,
      (state: any) => state.players[0].hand.push({ instanceId: "bad", definitionId: "missing" }),
      (state: any) => state.players[1].hand.push(state.players[0].hand[0]),
      (state: any) => state.pendingReaction = { attackerId: "absent" },
      (state: any) => state.pendingSearch = { playerId: "player_1", cards: [] },
      (state: any) => state.pendingDiscard = { playerId: "player_1", sourcePlayerId: "player_2", count: 500, reason: "bad" },
      (state: any) => state.settings.maxHealth = "bad",
      (state: any) => state.outcome = { kind: "bad" },
    ]) {
      const state = base(); corrupt(state);
      let raw = "";
      saveGame(state, { setItem: (_key, value) => { raw = value; }, removeItem() {} });
      const fallback = { ...base(), phase: "setup" as const };
      const restored = readSavedMatch(fallback, { getItem: key => key === SAVE_KEY ? raw : null });
      expect(restored.state).toBe(fallback);
      expect(restored.rejected).toBe(raw);
    }
  });

  it("accepts real suspended decisions and completed matches throughout seeded play", () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 15; seed++) {
      let rng = seed;
      const random = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 2 ** 32);
      let state = createNewGame(["A", "B", "C", "D"], random, { ...defaultGameSettings, allowSecondaryDefense: true });
      for (let step = 0; step < 1500 && state.phase !== "gameOver"; step++) {
        validateSavedGame({ ...state, selectedCardId: null });
        Object.keys(state).filter(key => key.startsWith("pending") && state[key as keyof GameState]).forEach(key => kinds.add(key));
        state = gameReducer(state, chooseAutomatedAction(state, "master", random));
      }
      expect(state.phase).toBe("gameOver");
      validateSavedGame({ ...state, selectedCardId: null });
    }
    expect(kinds.has("pendingReaction")).toBe(true);
    expect(kinds.has("pendingSecondaryDamage")).toBe(true);
    expect(kinds.has("pendingDiscard")).toBe(true);
  });

  it("attributes logs to IDs even with duplicate and overlapping names", () => {
    const state = base();
    const next = gameReducer(state, { type: "DRAW_CARD", playerId: "player_1" });
    expect(next.log.at(-1)?.participantIds).toContain("player_1");
    expect(next.log.at(-1)?.participantIds).not.toContain("player_3");
    expect(next.log.at(-1)?.participantIds).not.toContain("player_2");
  });

  it("heals vulnerable allies and transfers spare weapons using public information", () => {
    const state = base(); state.players[0].teamId = state.players[1].teamId = "team_1";
    state.players[1].health = 3;
    state.players[0].hand = [card("healing_bandage")];
    expect(chooseAutomatedAction(state, "master", () => 0)).toMatchObject({ type: "PLAY_HEALING", targetPlayerId: "player_2" });
    state.players[0].hand = [card("healing_medkit")];
    state.players[0].actionsRemaining = 1;
    expect(chooseAutomatedAction(state, "master", () => 0).type).not.toBe("PLAY_HEALING");
    state.players[0].hand = [card("healing_bandage")];
    state.players[0].actionsRemaining = 2;
    state.settings.allowTeamHealing = false;
    expect(chooseAutomatedAction(state, "master", () => 0).type).not.toBe("PLAY_HEALING");
    state.players[0].hand = [card("weapon_pistol"), card("weapon_shotgun")];
    state.players[1].hand = [];
    const transfer = chooseAutomatedAction(state, "master", () => 0);
    expect(transfer).toMatchObject({ type: "TRANSFER_CARD", targetPlayerId: "player_2" });
    expect(gameReducer(state, transfer).players[1].hand).toHaveLength(1);
    state.players[2].hand = state.players[2].hand.map((c, i) => card("defense_dodge", `secret_${i}`));
    expect(chooseAutomatedAction(state, "master", () => 0)).toEqual(transfer);
    state.settings.allowTeamCardTransfer = false;
    expect(chooseAutomatedAction(state, "master", () => 0).type).not.toBe("TRANSFER_CARD");
  });

  it("records automatic Revive damage and prevention without spending healing cards", () => {
    let state = base();
    state.players[0].hand = [card("weapon_pistol")];
    state.players[1].health = 3;
    state.players[1].hand = [card("defense_revive"), card("healing_bandage")];
    state = gameReducer(state, { type: "ATTACK", attackerId: "player_1", targetPlayerId: "player_2", weaponInstanceId: "weapon_pistol" });
    state = gameReducer(state, { type: "SKIP_REACTION", defenderId: "player_2" });
    expect(state.resolvedEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "damage", playerId: "player_2", amount: 2 }),
      expect.objectContaining({ kind: "prevention", playerId: "player_2", amount: 1 })
    ]));
    expect(state.resolvedEffects?.some(effect => effect.kind === "healing")).toBe(false);
    expect(getBotObservation(state).resolvedEffects).toBeUndefined();
  });

  it("attributes deferred counter damage to its defense card", () => {
    const state = base();
    for (const source of ["counterattack", "backfire"] as const) {
      const result = resolveSecondaryDamage(state, state.players[0], state.players[1], card("weapon_pistol"), 3, source, null);
      expect(result.state.resolvedEffects).toContainEqual(expect.objectContaining({ kind: "damage", source, cardDefinitionId: `defense_${source}`, amount: 3 }));
    }
  });

  it("reconciles health effects and records card exposure and elimination waiting time", () => {
    const result = simulateGame(987654, ["master"], { strict: true, settings: { eliminationHealthReward: 3, allowSecondaryDefense: true }, teams: ["a", "a", "b", "b"] });
    expect(result.stalled).toBe(false);
    expect(result.metrics.decisions).toBeGreaterThan(0);
    expect(Object.keys(result.metrics.cards).length).toBeGreaterThan(10);
    expect(Object.keys(result.metrics.waitingDecisions).length).toBeGreaterThan(0);
    expect(result.state.outcome).toBeDefined();
  });
});
