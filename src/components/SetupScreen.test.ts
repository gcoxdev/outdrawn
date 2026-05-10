import { describe, expect, it } from "vitest";
import { getTeamModeValidation } from "./SetupScreen";
import type { TeamId } from "../game/types";

describe("setup screen team mode validation", () => {
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
