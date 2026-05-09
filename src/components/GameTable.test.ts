import { describe, expect, it } from "vitest";
import type { GameState, PlayerState } from "../game/types";
import { shouldShowToastForLog } from "./GameTable";

function player(name: string, controller: PlayerState["controller"]): GameState["players"][number] {
  return {
    id: name.toLowerCase(),
    name,
    controller,
    health: 10,
    hand: [],
    eliminated: false,
    eliminations: 0,
    attackedThisRound: false,
    actedThisRound: false,
    actionsRemaining: 2
  };
}

const human = player("Ari", { type: "human" });
const computer = player("Blake", { type: "computer", strategy: "competent" });

describe("game table toast filtering", () => {
  it("shows negative action toasts when a human is affected", () => {
    expect(shouldShowToastForLog("Ari took 3 Minigun damage.", [human, computer])).toBe(true);
    expect(shouldShowToastForLog("Blake stole 1 card from Ari.", [human, computer])).toBe(true);
    expect(shouldShowToastForLog("Blake sabotaged Ari. Ari must discard 2 cards.", [human, computer])).toBe(true);
  });

  it("does not show negative action toasts for computer-only events", () => {
    expect(shouldShowToastForLog("Blake took 3 Minigun damage.", [human, computer])).toBe(false);
    expect(shouldShowToastForLog("Ari stole 1 card from Blake.", [human, computer])).toBe(false);
    expect(shouldShowToastForLog("Ari disarmed Blake, discarding Pistol.", [human, computer])).toBe(false);
  });

  it("does not show toasts for non-negative log messages", () => {
    expect(shouldShowToastForLog("Ari drew 1 card.", [human, computer])).toBe(false);
  });
});
