import { describe, expect, it } from "vitest";
import { chooseAutomatedAction, simulateGames } from "./simulator";
import { createNewGame } from "./setup";
import { expandDeck } from "./deck";
import { mainDeckCards } from "../data/cards";

function main(definitionId: string) {
  const card = expandDeck(mainDeckCards, "simulator_test").find((candidate) => candidate.definitionId === definitionId);
  if (!card) {
    throw new Error(`Missing ${definitionId}`);
  }
  return card;
}

describe("game simulator", () => {
  it("can complete batches of automated games without stalling", () => {
    const summary = simulateGames(25, 8675309);

    expect(summary.gamesPlayed).toBe(25);
    expect(summary.completedGames).toBeGreaterThan(20);
    expect(summary.averageTurns).toBeGreaterThan(0);
  });

  it("reports configured strategy levels and winner strategy totals", () => {
    const summary = simulateGames(25, 8675309, ["beginner", "novice", "expert", "master"]);

    expect(summary.strategies).toEqual(["beginner", "novice", "expert", "master"]);
    expect(Object.values(summary.winnerStrategies).reduce((total, count) => total + count, 0)).toBe(summary.completedGames);
  });

  it("can simulate different player counts", () => {
    const summary = simulateGames(10, 8675309, ["competent"], { playerCount: 6 });

    expect(summary.strategies).toEqual(["competent", "competent", "competent", "competent", "competent", "competent"]);
    expect(Object.keys(summary.winners).some((winner) => winner === "player_6")).toBe(true);
  });

  it("can choose a live game action for a computer-controlled turn", () => {
    const state = createNewGame(
      [
        { name: "Ari", controller: { type: "human" } },
        { name: "Blake", controller: { type: "computer", strategy: "master" } },
        { name: "Casey", controller: { type: "computer", strategy: "novice" } }
      ],
      () => 0
    );

    const action = chooseAutomatedAction(state, "master", () => 0.5);

    expect(action.type).not.toBe("SELECT_CARD");
    expect(action.type).not.toBe("START_GAME");
  });

  it("master target choice favors high-skill threats when there is no kill shot", () => {
    let state = createNewGame(
      [
        { name: "Ari", controller: { type: "computer", strategy: "master" } },
        { name: "Blake", controller: { type: "computer", strategy: "beginner" } },
        { name: "Casey", controller: { type: "computer", strategy: "master" } }
      ],
      () => 0
    );
    const pistol = main("weapon_pistol");
    state = {
      ...state,
      players: state.players.map((player, index) =>
        index === 0
          ? { ...player, hand: [pistol] }
          : index === 1
            ? { ...player, health: 12, hand: [] }
            : { ...player, health: 20, hand: [main("weapon_sniper_rifle")] }
      )
    };

    const action = chooseAutomatedAction(state, "master", () => 0);

    expect(action).toMatchObject({ type: "ATTACK", targetPlayerId: "player_3" });
  });

  it("master target choice still takes available eliminations", () => {
    let state = createNewGame(
      [
        { name: "Ari", controller: { type: "computer", strategy: "master" } },
        { name: "Blake", controller: { type: "computer", strategy: "beginner" } },
        { name: "Casey", controller: { type: "computer", strategy: "master" } }
      ],
      () => 0
    );
    const pistol = main("weapon_pistol");
    state = {
      ...state,
      players: state.players.map((player, index) =>
        index === 0
          ? { ...player, hand: [pistol] }
          : index === 1
            ? { ...player, health: 3, hand: [] }
            : { ...player, health: 20, hand: [main("weapon_sniper_rifle")] }
      )
    };

    const action = chooseAutomatedAction(state, "master", () => 0);

    expect(action).toMatchObject({ type: "ATTACK", targetPlayerId: "player_2" });
  });

  it("master uses the cheapest lethal weapon instead of wasting stronger damage", () => {
    let state = createNewGame(
      [
        { name: "Ari", controller: { type: "computer", strategy: "master" } },
        { name: "Blake", controller: { type: "computer", strategy: "beginner" } },
        { name: "Casey", controller: { type: "computer", strategy: "expert" } }
      ],
      () => 0
    );
    const pistol = main("weapon_pistol");
    const sniper = main("weapon_sniper_rifle");
    state = {
      ...state,
      players: state.players.map((player, index) =>
        index === 0
          ? { ...player, hand: [sniper, pistol] }
          : index === 1
            ? { ...player, health: 3, hand: [] }
            : { ...player, health: 20, hand: [main("weapon_shotgun")] }
      )
    };

    const action = chooseAutomatedAction(state, "master", () => 0);

    expect(action).toMatchObject({ type: "ATTACK", targetPlayerId: "player_2", weaponInstanceId: pistol.instanceId });
  });
});
