/**
 * Vertical band axis: width overflow must truncate, not thin away short labels (#1356).
 *
 * Thinning labelEvery only helps left-margin width when the widest labeled
 * ticks actually disappear. When a survivor stays over-wide (index 0 is always
 * labeled), doubling every is a no-op for width and must not strip siblings.
 */
import { describe, expect, it } from "bun:test";

import { layout } from "../../src/layout/layout.ts";
import { band, base, lin, theme } from "./fixtures.ts";

const LONG_A =
  "ESTABLECESE LA FECHA DE ENTRADA EN VIGENCIA DE LA LEY 27.742 DE PRESUPUESTO NACIONAL PARA EL EJERCICIO";
const LONG_B =
  "APRUEBASE EL PROYECTO DE INVERSION PRESENTADO POR LA EMPRESA CONSORCIO MINERO SA DEL NORTE";

/** Issue #1356 repro categories: two over-wide labels among short siblings. */
const MIXED = [
  LONG_A,
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  "Epsilon",
  LONG_B,
  "Zeta",
  "Eta",
  "Theta",
];

describe("vertical band y: over-wide label does not hide short siblings (#1356)", () => {
  it("keeps every short category labeled and truncates only the over-wide ones", () => {
    const r = layout(
      base({
        width: 400,
        height: 360,
        x: lin(0, 10),
        y: band(...MIXED),
      }),
    );

    expect(r.y.ticks).toHaveLength(MIXED.length);
    // Thinning must not fire when it cannot shrink max labeled width.
    expect(r.y.labelEvery).toBe(1);
    expect(r.degradations).not.toContain("band-label-overlap");
    expect(r.degradations).toContain("band-label-margin-overflow");
    expect(r.y.truncated).toBe(true);

    for (const t of r.y.ticks) {
      expect(t.labeled).toBe(true);
    }

    const short = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"];
    for (const name of short) {
      const tick = r.y.ticks.find((t) => t.value === name);
      expect(tick?.label).toBe(name);
    }

    for (const long of [LONG_A, LONG_B]) {
      const tick = r.y.ticks.find((t) => t.value === long);
      expect(tick?.label).not.toBe(long);
      expect(tick?.label.endsWith(theme.ellipsis)).toBe(true);
    }

    expect(r.margins.left).toBeLessThanOrEqual(theme.maxMarginFraction * 400);
  });

  it("still thins when hiding wider ticks actually reduces left-margin width", () => {
    // Odd indices are the only over-wide labels; every=2 keeps even shorts.
    // Tall plot + 16 cats so density does not force further thinning.
    const cats = Array.from({ length: 16 }, (_, i) =>
      i % 2 === 1
        ? `Very long category label that blows the left margin budget number ${i}`
        : `S${i}`,
    );
    const r = layout(
      base({
        width: 200,
        height: 640,
        x: lin(0, 10),
        y: band(...cats),
      }),
    );
    expect(r.y.labelEvery).toBeGreaterThan(1);
    expect(r.degradations).toContain("band-label-margin-overflow");
    // Surviving labels are the short even-index ones — no need to truncate.
    const labeled = r.y.ticks.filter((t) => t.labeled);
    expect(labeled.length).toBeGreaterThan(0);
    expect(labeled.every((t) => String(t.value).startsWith("S"))).toBe(true);
  });

  it("probes past a no-op doubling when a later every drops the widest survivor", () => {
    // Widest at index 2: every=2 still labels it; every=4 drops it and shrinks width.
    const cats = [
      "Short0",
      "Short1",
      "THIS IS THE ONE VERY LONG CATEGORY LABEL THAT BLOWS THE LEFT MARGIN ALONE",
      "Short3",
      "Short4",
      "Short5",
      "Short6",
      "Short7",
    ];
    const r = layout(
      base({
        width: 200,
        height: 320,
        x: lin(0, 10),
        y: band(...cats),
      }),
    );
    expect(r.y.labelEvery).toBeGreaterThanOrEqual(4);
    expect(r.y.ticks.find((t) => t.value === cats[2])?.labeled).toBe(false);
    expect(r.degradations).toContain("band-label-margin-overflow");
  });

  it("density-thins many short categories when the plot is too short for all labels", () => {
    const cats = Array.from({ length: 40 }, (_, i) => `C${i}`);
    const r = layout(
      base({
        width: 400,
        height: 120,
        x: lin(0, 10),
        y: band(...cats),
      }),
    );
    expect(r.y.labelEvery).toBeGreaterThan(1);
    expect(r.degradations).toContain("band-label-overlap");
    expect(r.y.ticks.filter((t) => t.labeled).length).toBeLessThan(cats.length);
  });

  it("keeps and flags overlapping labels below the density-thinning floor (#1846)", () => {
    const cats = Array.from({ length: 8 }, (_, i) => `Category ${i}`);
    const r = layout(
      base({
        width: 640,
        height: 120,
        x: lin(0, 10),
        y: band(...cats),
      }),
    );
    expect(r.y.labelEvery).toBe(1);
    expect(r.y.ticks.every((t) => t.labeled)).toBe(true);
    expect(r.degradations).toContain("band-label-overlap");
    expect(r.y.guidePlan?.overlap).toBe(true);
  });

  it("does not density-thin sparse authored breaks that already have room", () => {
    // 200 categories, 16 evenly spaced breaks — on-screen pitch is large enough
    // that every break label should stay labeled.
    const categories = Array.from({ length: 200 }, (_, i) => `Cat ${i}`);
    const breaks = Array.from({ length: 16 }, (_, i) => categories[i * 12]!);
    const r = layout(
      base({
        width: 400,
        height: 400,
        x: lin(0, 10),
        y: { type: "band", categories, breaks },
      }),
    );
    expect(r.y.ticks).toHaveLength(breaks.length);
    expect(r.y.labelEvery).toBe(1);
    expect(r.y.ticks.every((t) => t.labeled)).toBe(true);
  });

  it("does not reserve left margin for a wide label that density hides", () => {
    // Wide label only at odd indices; density (every≥2) hides it. Left margin
    // must reflect the short survivors, not the hidden long name.
    const cats = Array.from({ length: 40 }, (_, i) =>
      i % 2 === 1 ? `Very long category label reserved width should not survive ${i}` : `S${i}`,
    );
    const shortOnly = layout(
      base({
        width: 400,
        height: 120,
        x: lin(0, 10),
        y: band(...Array.from({ length: 40 }, (_, i) => `S${i}`)),
      }),
    );
    const mixed = layout(
      base({
        width: 400,
        height: 120,
        x: lin(0, 10),
        y: band(...cats),
      }),
    );
    expect(mixed.y.labelEvery).toBeGreaterThan(1);
    expect(mixed.y.ticks.some((t) => t.labeled && String(t.value).startsWith("Very"))).toBe(false);
    // Same density outcome as all-short → left margin within one quantum.
    expect(Math.abs(mixed.margins.left - shortOnly.margins.left)).toBeLessThanOrEqual(
      theme.quantum,
    );
  });
});
