import { describe, expect, it } from "vitest";
import { createNewGame } from "./setup";
import { chooseAutomatedAction } from "./simulator";
import type { StrategyLevel } from "./types";

const strategies: StrategyLevel[] = ["beginner", "novice", "competent", "expert", "master"];
describe("bot setup action budget", () => {
  for (const ability of ["ability_ambush", "ability_reload"]) {
    it.each(strategies)(`${ability}: %s saves its last action for a usable play, including fallback choices`, strategy => {
      for (const blocked of [false, true]) {
        const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
        state.players[0].actionsRemaining = 1;
        state.players[0].hand = [{ instanceId: "setup", definitionId: ability }, { instanceId: "weapon", definitionId: "weapon_pistol" }];
        if (blocked) state.smokeProtectedPlayerIds = ["player_2", "player_3"];
        for (const roll of [0.1, 0.9]) {
          const action = chooseAutomatedAction(state, strategy, () => roll);
          expect(action).not.toMatchObject({ type: "PLAY_ABILITY", cardInstanceId: "setup" });
        }
      }
    });
    it(`${ability}: remains available with enough actions for the follow-up weapon`, () => {
      const state = createNewGame(["Ari", "Blake", "Casey"], () => 0);
      state.players[0].hand = [{ instanceId: "setup", definitionId: ability }, { instanceId: "weapon", definitionId: "weapon_pistol" }];
      expect(chooseAutomatedAction(state, "competent", () => .9)).toMatchObject({ type: "PLAY_ABILITY", cardInstanceId: "setup" });
    });
  }
});
