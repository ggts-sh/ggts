/**
 * Measured band x-axis planner integration through layoutPass / layout.
 */
import { describe, expect, it } from "bun:test";

import { layout, layoutPass, type Domain } from "../../src/layout/layout.ts";
import { MODE_RANK, SPANISH, bandX, base, theme } from "./fixtures.ts";

describe("measured band x-axis (planner integration)", () => {
  it("wraps long categorical x labels and grows the bottom margin, dropping none", () => {
    // 560px wide → inner band ≈ 103px: the labels wrap to two lines and fit.
    const r = layout(base({ width: 560, height: 300, x: bandX(SPANISH) }));
    expect(r.x.guidePlan?.bandLabelMode).toBe("wrapped");
    expect(r.x.ticks.every((t) => t.labeled)).toBe(true);
    // Two-line labels reserve more bottom than one line, but stay within the cap.
    const oneLine = theme.marginPriors.bottom;
    expect(r.margins.bottom).toBeGreaterThan(oneLine);
    expect(r.margins.bottom).toBeLessThanOrEqual(theme.maxMarginFraction * 300);
    expect(r.x.ticks.some((t) => (t.lines?.length ?? 1) === 2)).toBe(true);
  });

  it("wrap-then−45° at narrow width keeps every bar labelled without truncating (#637)", () => {
    // 240px: plain wrap fails; hybrid balances multi-word labels and rotates −45°
    // so the long outlier no longer needs ellipsis (full-string −45° used to).
    const r = layout(base({ width: 240, height: 300, x: bandX(SPANISH) }));
    expect(r.x.guidePlan?.bandLabelMode).toBe("rotated");
    expect(r.x.guidePlan?.bandLabelAngle).toBe(-45);
    expect(r.x.ticks.every((t) => t.labeled)).toBe(true);
    expect(r.x.ticks.some((t) => (t.lines?.length ?? 1) > 1)).toBe(true);
    expect(r.x.ticks.every((t) => !t.label.includes("…"))).toBe(true);
    expect(r.degradations).not.toContain("band-label-margin-overflow");
    expect(r.margins.bottom).toBeLessThanOrEqual(theme.maxMarginFraction * 300);
  });

  it("mode is monotonic across the two passes (escalate-only, no de-escalation)", () => {
    const input = base({ width: 240, height: 300, x: bandX(SPANISH) });
    const passA = layoutPass(theme.marginPriors, input, theme);
    const passB = layoutPass(
      passA.margins,
      { ...input, previousGuidePlans: { x: passA.x.guidePlan } },
      theme,
    );
    const rankOf = (m: string | undefined) =>
      MODE_RANK[(m ?? "single-line") as keyof typeof MODE_RANK];
    expect(rankOf(passB.x.guidePlan?.bandLabelMode)).toBeGreaterThanOrEqual(
      rankOf(passA.x.guidePlan?.bandLabelMode),
    );
  });

  it("reserves tick chrome: band height + tickLength/gap stays within the bottom cap (Codex P2)", () => {
    // The planner budgets the label band against the cap MINUS tick chrome, so
    // once layoutPass adds tickLength+tickLabelGap the total still honors the cap
    // (no silent clip). Assert the reserved band leaves room for the chrome.
    const height = 300;
    const r = layout(base({ width: 240, height, x: bandX(SPANISH) }));
    const cap = theme.maxMarginFraction * height;
    const chrome = theme.tickLength + theme.tickLabelGap;
    expect(r.x.guidePlan?.bandLabelBandHeight ?? 0).toBeLessThanOrEqual(cap - chrome + 1e-6);
    expect(r.margins.bottom).toBeLessThanOrEqual(cap);
  });

  it("plans a vertical band axis and keeps its left margin within the cap", () => {
    const yBand: Domain = {
      type: "band",
      categories: SPANISH,
      rawCategories: SPANISH,
      band: { aesthetic: "y", panelIndex: 0, config: { type: "band" } },
    };
    const r = layout(base({ width: 300, height: 300, y: yBand }));
    expect(r.y.guidePlan?.bandLabelMode).toBe("single-line");
    expect(r.y.guidePlan?.bandLabelAngle).toBe(0);
    expect(r.margins.left).toBeLessThanOrEqual(theme.maxMarginFraction * 300);
  });
});
