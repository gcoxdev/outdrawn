import { describe, expect, it } from "vitest";
import { allCards } from "./cards";

function card(id: string) {
  const found = allCards.find((candidate) => candidate.id === id);
  if (!found) {
    throw new Error(`Missing card ${id}`);
  }
  return found;
}

describe("card data consistency", () => {
  it("keeps reaction defense cards self-targeted unless they redirect or retaliate", () => {
    expect(card("defense_armor_vest").target).toBe("self");
    expect(card("defense_shield_plate").target).toBe("self");
    expect(card("defense_dodge").target).toBe("self");
    expect(card("defense_smoke_bomb").target).toBe("self");
    expect(card("defense_brace").target).toBe("self");
    expect(card("defense_fake_death").target).toBe("self");
    expect(card("defense_decoy").target).toBe("onePlayer");
    expect(card("defense_counterattack").target).toBe("onePlayer");
    expect(card("defense_backfire").target).toBe("self");
  });

  it("uses target metadata that matches event scope", () => {
    expect(card("event_pressure_zone").target).toBe("allPlayers");
    expect(card("event_supply_drop").target).toBe("self");
    expect(card("event_bounty").target).toBe("onePlayer");
    expect(card("event_high_ground").target).toBe("allPlayers");
    expect(card("event_low_ammo").target).toBe("allPlayers");
    expect(card("event_no_cover").target).toBe("allPlayers");
    expect(card("event_critical_condition").target).toBe("allPlayers");
    expect(card("event_black_market").target).toBe("self");
  });
});
