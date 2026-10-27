/**
 * Fixture cases: long labels, tiny plots, empty domains, band thinning.
 */
import { describe, expect, it } from "bun:test";

import { layout } from "../../src/layout/layout.ts";
import { band, base, lin, measurer, theme } from "./fixtures.ts";

describe("two-pass layout: fixtures", () => {
  it("long category labels: capped left margin + ellipsis truncation", () => {
    const r = layout(
      base({
        width: 400,
        y: band(
          "Government & Public Sector Organizations",
          "Energy — renewables and storage infrastructure",
          "Consumer discretionary (durables)",
          "IT",
        ),
      }),
    );
    expect(r.margins.left).toBeLessThanOrEqual(theme.maxMarginFraction * 400);
    expect(r.y.truncated).toBe(true);
    expect(r.degradations).toContain("band-label-margin-overflow");
    const truncated = r.y.ticks.filter((t) => t.label.endsWith(theme.ellipsis));
    expect(truncated.length).toBeGreaterThan(0);
    // Short labels survive untouched.
    expect(r.y.ticks.find((t) => t.value === "IT")?.label).toBe("IT");
    // Every shown truncated label still fits the cap.
    for (const t of r.y.ticks.filter((tick) => tick.labeled)) {
      const w = measurer.measureWidth(t.label, theme.fontSize);
      expect(w + theme.tickLength + theme.tickLabelGap).toBeLessThanOrEqual(
        theme.maxMarginFraction * 400 + theme.quantum,
      );
    }
  });

  it("tiny plot: margins stay within caps, inner area stays positive", () => {
    const r = layout(base({ width: 80, height: 60 }));
    expect(r.margins.left).toBeLessThanOrEqual(theme.maxMarginFraction * 80);
    expect(r.margins.right).toBeLessThanOrEqual(theme.maxMarginFraction * 80);
    expect(r.margins.top).toBeLessThanOrEqual(theme.maxMarginFraction * 60);
    expect(r.margins.bottom).toBeLessThanOrEqual(theme.maxMarginFraction * 60);
    expect(r.innerWidth).toBeGreaterThan(0);
    expect(r.innerHeight).toBeGreaterThan(0);
    expect(r.x.ticks.length).toBeGreaterThanOrEqual(2);
    expect(r.y.ticks.length).toBeGreaterThanOrEqual(2);
  });

  it("huge numbers: grouped labels degrade instead of blowing the margin", () => {
    const r = layout(base({ width: 300, height: 240, y: lin(0, 1e15) }));
    expect(r.margins.left).toBeLessThanOrEqual(theme.maxMarginFraction * 300);
    // Degradation happened (thinning and/or truncation), and it is recorded.
    expect(r.degradations.some((d) => d === "y:thin" || d === "y:truncate")).toBe(true);
  });

  it("huge numbers fit untouched when the plot is wide enough", () => {
    const r = layout(base({ width: 900, height: 500, y: lin(0, 1e15) }));
    expect(r.y.truncated).toBe(false);
    // "800,000,000,000,000"-class labels are wide; margin reflects it.
    expect(r.margins.left).toBeGreaterThan(80);
    expect(r.margins.left).toBeLessThanOrEqual(theme.maxMarginFraction * 900);
  });

  it("empty domains: no ticks, floor margins, tagged degradation", () => {
    const r = layout(base({ x: lin(NaN, NaN), y: band() }));
    expect(r.x.ticks).toEqual([]);
    expect(r.y.ticks).toEqual([]);
    expect(r.degradations).toContain("x:empty-domain");
    expect(r.degradations).toContain("y:empty-domain");
    expect(r.margins.left).toBeLessThanOrEqual(
      Math.ceil(theme.minMargins.left / theme.quantum) * theme.quantum,
    );
    expect(r.converged).toBe(true);
  });

  it("band x axis with many categories thins labels before truncating", () => {
    const cats = Array.from(
      { length: 40 },
      (_, i) => `Category number ${i + 1} — extended edition`,
    );
    const r = layout(base({ width: 240, x: { type: "band", categories: cats } }));
    expect(r.margins.right).toBeLessThanOrEqual(theme.maxMarginFraction * 240);
    // Thinning was tried first (labelEvery grew) before/instead of truncation.
    expect(r.x.labelEvery).toBeGreaterThan(1);
  });

  it("linear/temporal axes never rotate labels (rotation is band-only)", () => {
    // Non-band axes carry no rotation; band rotation lives on the guide plan, and
    // is exercised by the "measured band x-axis" suite below.
    const r = layout(base({}));
    expect(r.x.guidePlan?.bandLabelAngle).toBeUndefined();
    expect(r.x.ticks.every((t) => t.angle === undefined)).toBe(true);
  });
});
