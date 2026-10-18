import { describe, expect, it } from "vitest";
import { getTeamModeValidation } from "../game/setupOptions";
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
    expect(getTeamModeValidation("ffa", ["team_1", "team_1", "team_2"], 3).isValid).toBe(true);
  });

  it("requires generated team modes to create at least two teams", () => {
    expect(getTeamModeValidation("duos", assignTeamsForMode("duos", 2), 2).isValid).toBe(false);
    expect(getTeamModeValidation("trios", assignTeamsForMode("trios", 3), 3)).toEqual({
      isValid: false,
      message: "Trios requires at least two teams."
    });
    expect(getTeamModeValidation("squads", assignTeamsForMode("squads", 4), 4)).toEqual({
      isValid: false,
      message: "Squads requires at least two teams."
    });
  });

  it("rejects odd two-team games without fractional team sizes", () => {
    expect(getTeamModeValidation("twoTeams", assignTeamsForMode("twoTeams", 5), 5)).toEqual({
      isValid: false,
      message: "Two Teams requires an even player count."
    });
  });

  it("requires two balanced teams for duos and trios", () => {
    expect(getTeamModeValidation("duos", ["team_1", "team_2", "team_1", "team_2"], 4).isValid).toBe(true);
    expect(getTeamModeValidation("duos", ["team_1", "team_1", "team_1", "team_2"], 4)).toEqual({
      isValid: false,
      message: "Duos requires 2 players each on Team 1 and Team 2."
    });
    expect(getTeamModeValidation("trios", ["team_1", "team_2", "team_1", "team_2", "team_1", "team_2"], 6).isValid).toBe(true);
    expect(getTeamModeValidation("trios", ["team_1", "team_2", "team_1", "team_2", "team_1", "team_1"], 6)).toEqual({
      isValid: false,
      message: "Trios requires 3 players each on Team 1 and Team 2."
    });
  });

  it("allows three valid duo teams and rejects uneven team splits", () => {
    const validTeams: TeamId[] = ["team_1", "team_2", "team_3", "team_1", "team_2", "team_3"];
    const unevenTeams: TeamId[] = ["team_1", "team_1", "team_1", "team_1", "team_1", "team_2"];

    expect(getTeamModeValidation("duos", validTeams, 6).isValid).toBe(true);
    expect(getTeamModeValidation("duos", unevenTeams, 6)).toEqual({
      isValid: false,
      message: "Duos requires 2 players each on Team 1, Team 2, and Team 3."
    });
  });
});
