import { describe, expect, it } from "vitest";
import { getRulesPopoverPosition } from "./CardView";

describe("card rules popover positioning", () => {
  it("keeps the popover inside the left viewport edge", () => {
    expect(getRulesPopoverPosition({ left: 4, right: 26, top: 120, bottom: 142 }, 400, 700)).toMatchObject({
      left: 8
    });
  });

  it("keeps the popover inside the right viewport edge", () => {
    expect(getRulesPopoverPosition({ left: 374, right: 396, top: 120, bottom: 142 }, 400, 700)).toMatchObject({
      left: 132
    });
  });

  it("places the popover below the icon when there is not enough room above", () => {
    expect(getRulesPopoverPosition({ left: 180, right: 202, top: 12, bottom: 34 }, 400, 700)).toMatchObject({
      top: 42
    });
  });
});
