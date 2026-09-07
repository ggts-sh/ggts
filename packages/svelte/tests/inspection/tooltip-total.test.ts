import { describe, expect, it } from "vitest";

import { tooltipTotalPlacement } from "../../src/lib/inspection/tooltip-total.js";

describe("tooltipTotalPlacement", () => {
  it("auto keeps axis-mode Total at the bottom when several series compose", () => {
    expect(
      tooltipTotalPlacement({
        tooltipTotal: "auto",
        groupTotal: 15,
        memberCount: 3,
        mode: "x",
      }),
    ).toBe("bottom");
  });

  it("auto hides Total for exact inspection even when a stack total exists", () => {
    expect(
      tooltipTotalPlacement({
        tooltipTotal: "auto",
        groupTotal: 15,
        memberCount: 1,
        mode: "exact",
      }),
    ).toBeNull();
  });

  it("bottom shows Total on exact stacked bars without changing inspect mode", () => {
    expect(
      tooltipTotalPlacement({
        tooltipTotal: "bottom",
        groupTotal: 15,
        memberCount: 1,
        mode: "exact",
      }),
    ).toBe("bottom");
  });

  it("top places Total above members when a numeric total exists", () => {
    expect(
      tooltipTotalPlacement({
        tooltipTotal: "top",
        groupTotal: 15,
        memberCount: 1,
        mode: "exact",
      }),
    ).toBe("top");
  });

  it("off hides Total even in axis mode", () => {
    expect(
      tooltipTotalPlacement({
        tooltipTotal: "off",
        groupTotal: 15,
        memberCount: 3,
        mode: "x",
      }),
    ).toBeNull();
  });

  it("never invents a Total when the group is not additive", () => {
    expect(
      tooltipTotalPlacement({
        tooltipTotal: "bottom",
        groupTotal: null,
        memberCount: 3,
        mode: "exact",
      }),
    ).toBeNull();
  });
});
