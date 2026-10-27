/**
 * Band y tick thinning must not rebuild every tick on each labelEvery doubling (#1335).
 *
 * Only the `labeled` flag depends on every; values, labels, and domainIndex stay
 * fixed. Counting formatY calls observes rebuilds without spying on deriveTicks.
 */
import { describe, expect, it } from "bun:test";

import { layout, layoutPass, DEFAULT_LAYOUT_THEME } from "../../src/layout/layout.ts";
import { band, base, lin, measurer, theme } from "./fixtures.ts";

function longCategories(k: number): string[] {
  return Array.from({ length: k }, (_, i) => `Category with a long name number ${i}`);
}

describe("band y thinning rebuild cost (#1335)", () => {
  it("formats each category once per layoutPass while thinning labelEvery", () => {
    const k = 64;
    const cats = longCategories(k);
    let formats = 0;
    const formatY = (v: string | number) => {
      formats++;
      return String(v);
    };
    // One pass only so the budget is k, not 2k.
    layoutPass(
      theme.marginPriors,
      {
        width: 400,
        height: 300,
        x: lin(0, 100),
        y: band(...cats),
        measurer,
        formatY,
      },
      theme,
    );
    expect(formats).toBe(k);
  });

  it("does not width-thin uniform long labels; density still thins crowded lists (#1356)", () => {
    // Width doubling cannot shrink maxLabeledWidth (index 0 always labeled), so
    // the planner truncates. Density thinning still raises labelEvery when the
    // band step is below label height + gap.
    const k = 64;
    const cats = longCategories(k);
    const r = layout(
      base({
        width: 400,
        height: 300,
        x: lin(0, 100),
        y: band(...cats),
      }),
    );
    expect(r.y.ticks).toHaveLength(k);
    expect(r.y.ticks.map((t) => t.value)).toEqual(cats);
    expect(r.y.labelEvery).toBeGreaterThan(1);
    expect(r.degradations).toContain("band-label-overlap");
    expect(r.degradations).toContain("band-label-margin-overflow");
    expect(r.y.truncated).toBe(true);
    for (let i = 0; i < k; i++) {
      expect(r.y.ticks[i]!.labeled).toBe(i % r.y.labelEvery === 0);
    }
  });

  it("width-truncates without density thin when few long categories fit the height", () => {
    // Under BAND_THIN_MIN_CATEGORIES, density never fires; width still cannot
    // improve via thinning, so every stays 1 and labels truncate.
    const cats = longCategories(8);
    const r = layout(
      base({
        width: 400,
        height: 400,
        x: lin(0, 100),
        y: band(...cats),
      }),
    );
    expect(r.y.labelEvery).toBe(1);
    expect(r.y.ticks.every((t) => t.labeled)).toBe(true);
    expect(r.degradations).not.toContain("band-label-overlap");
    expect(r.degradations).toContain("band-label-margin-overflow");
  });

  it("stops doubling when the next every would cover the whole tick list", () => {
    // Surviving labels get shorter at each doubling so width keeps falling, yet
    // the tinest cap still overflows — until every*2 >= length forces the break.
    const cats = [
      "WWWWWWWW", // 0
      "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", // 1 longest
      "YYYYYYYYYYYYYYYY", // 2 mid-long
      "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", // 3
      "ZZZZZZZZZZ", // 4 mid
      "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", // 5
      "AAAAAAAA", // 6 short
      "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", // 7
    ];
    const r = layout(
      base({
        width: 80,
        height: 200,
        x: lin(0, 10),
        y: band(...cats),
        theme: {
          ...DEFAULT_LAYOUT_THEME,
          maxMarginFraction: 0.05,
        },
      }),
    );
    // last successful double: every=4 (4*2=8 not < 8, so break). Labeled at 0,4.
    expect(r.y.labelEvery).toBe(4);
    expect(r.y.ticks.filter((t) => t.labeled).map((t) => t.value)).toEqual([cats[0], cats[4]]);
  });
});
