import { describe, expect, it } from "vitest";
import { getTeamModeValidation } from "./SetupScreen";
import type { TeamId } from "../game/types";
import { assignTeamsForMode, getPlayerCountOptions, getDefaultPlayerName, getTeamColor, labelGeneratedTeam } from "../game/setupOptions";

describe("setup screen team mode validation", () => {
  it("provides scalable player count and generated setup helpers", () => {
    expect(getPlayerCountOptions()).toContain(100);
    expect(getDefaultPlayerName(0)).toBe("Ari");
    expect(getDefaultPlayerName(12)).toBe("Player 13");
    expect(assignTeamsForMode("duos", 6)).toEqual(["team_1", "team_1", "team_2", "team_2", "team_3", "team_3"]);
    expect(getTeamModeValidation("duos", assignTeamsForMode("duos", 6), 6).isValid).toBe(true);
    expect(getTeamModeValidation("duos", assignTeamsForMode("duos", 5), 5).isValid).toBe(false);
    expect(getTeamModeValidation("twoTeams", assignTeamsForMode("twoTeams", 100), 100).isValid).toBe(true);
    expect(labelGeneratedTeam("team_27")).toBe("Team 27");
    expect(getTeamColor("team_27")).toMatch(/^hsl\(/);
  });

  it("allows free-for-all without team balance checks", () => {
    expect(getTeamModeValidation("ffa", ["team_a", "team_a", "team_b"], 3).isValid).toBe(true);
  });

  it("requires two balanced teams for 2v2 and 3v3", () => {
    expect(getTeamModeValidation("2v2", ["team_a", "team_b", "team_a", "team_b"], 4).isValid).toBe(true);
    expect(getTeamModeValidation("2v2", ["team_a", "team_a", "team_a", "team_b"], 4)).toEqual({
      isValid: false,
      message: "2v2 requires 2 players each on Team A and Team B."
    });
    expect(getTeamModeValidation("3v3", ["team_a", "team_b", "team_a", "team_b", "team_a", "team_b"], 6).isValid).toBe(true);
    expect(getTeamModeValidation("3v3", ["team_a", "team_b", "team_a", "team_b", "team_a", "team_a"], 6)).toEqual({
      isValid: false,
      message: "3v3 requires 3 players each on Team A and Team B."
    });
  });

  it("allows valid 2v2v2 teams and rejects uneven team splits", () => {
    const validTeams: TeamId[] = ["team_a", "team_b", "team_c", "team_a", "team_b", "team_c"];
    const unevenTeams: TeamId[] = ["team_a", "team_a", "team_a", "team_a", "team_a", "team_b"];

    expect(getTeamModeValidation("2v2v2", validTeams, 6).isValid).toBe(true);
    expect(getTeamModeValidation("2v2v2", unevenTeams, 6)).toEqual({
      isValid: false,
      message: "2v2v2 requires 2 players each on Team A, Team B, and Team C."
    });
  });
});
