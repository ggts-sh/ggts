/**
 * PR 3 — binned family correctness gaps 3.1–3.6.
 *
 * Invariant under test:
 *  - transformed numeric centers/edges feed continuous geometry/training;
 *  - a SEPARATE stable integer bin-id vector drives discrete consumers
 *    (count aggregation + stack/fill/dodge grouping), never the rendered float;
 *  - jitter uses transformed bin WIDTH (from centers), never integer ids;
 *  - count consumes bin ids then restores transformed centers + semantic
 *    inverse-center values after aggregation;
 *  - identity marks snap to transformed centers but keep SOURCE tooltip values;
 *  - continuous stats (bin/density/smooth/summary/boxplot) consume transformed
 *    SOURCE values, not bin ids;
 *  - no bin integer leaks to the public RenderModel / candidates / guides.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg, scaleXBinned } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { assignBinId, binIdColumn, resolveBinnedBoundaries } from "../src/pipeline/binned-scale.ts";

const size = { width: 640, height: 400 };

describe("bin-id assignment — right-closed, inclusive lowest, −1 out of range", () => {
  const boundaries = resolveBinnedBoundaries(null, [0, 10, 20, 30])!;

  it("assigns stable integer ids by right-closed bin", () => {
    expect(assignBinId(0, boundaries)).toBe(0); // inclusive lowest edge
    expect(assignBinId(5, boundaries)).toBe(0);
    expect(assignBinId(10, boundaries)).toBe(0); // right-closed → lower bin
    expect(assignBinId(10.0001, boundaries)).toBe(1);
    expect(assignBinId(20, boundaries)).toBe(1);
    expect(assignBinId(25, boundaries)).toBe(2);
    expect(assignBinId(30, boundaries)).toBe(2); // inclusive top edge
  });

  it("returns −1 for out-of-range and non-finite inputs", () => {
    expect(assignBinId(-0.001, boundaries)).toBe(-1);
    expect(assignBinId(30.001, boundaries)).toBe(-1);
    expect(assignBinId(Number.NaN, boundaries)).toBe(-1);
    expect(assignBinId(Number.POSITIVE_INFINITY, boundaries)).toBe(-1);
  });

  it("binIdColumn maps a whole column, −1 for misses", () => {
    const ids = binIdColumn(Float64Array.of(0, 9, 11, 25, 99, Number.NaN), boundaries);
    expect(Array.from(ids)).toEqual([0, 0, 1, 2, -1, -1]);
  });
});

describe("count over a binned x — consumes bin ids, restores centers + semantic inverse", () => {
  it("produces one bar per BIN (not per source value) with correct summed counts", () => {
    // 6 distinct source x values collapse into 3 explicit bins.
    const rows = [1, 9, 11, 19, 21, 29].map((x) => ({ x }));
    const model = runPipeline(
      gg(rows, aes({ x: "x" }))
        .geomBar()
        .scales(scaleXBinned({ breaks: [0, 10, 20, 30] }))
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "rects");
    if (batch === undefined || batch.kind !== "rects") throw new Error("expected a rects batch");
    // 3 bins, so 3 bars — not 6.
    expect(batch.rowIndex.length).toBe(3);
  });

  it("count-bar candidates expose the SEMANTIC (inverse-center) x, never a bin id", () => {
    const rows = [1, 9, 11, 19, 21, 29].map((x) => ({ x }));
    const model = runPipeline(
      gg(rows, aes({ x: "x" }))
        .geomBar()
        .scales(scaleXBinned({ breaks: [0, 10, 20, 30] }))
        .spec(),
      size,
    );
    const xs: number[] = [];
    for (let id = 0; id < model.candidates.size; id++) {
      const c = model.candidates.candidate(id);
      if (c !== null && typeof c.xValue === "number") xs.push(c.xValue);
    }
    // Identity transform: bin centers are 5, 15, 25 — NOT ids 0,1,2.
    expect(xs.toSorted((a, b) => a - b)).toEqual([5, 15, 25]);
  });
});

describe("count over a log10 binned x — semantic inverse (geometric) centers", () => {
  it("candidate x values are the inverse-transformed bin centers, domain stays positive", () => {
    const rows = [15, 150, 1500].map((x) => ({ x }));
    const model = runPipeline(
      gg(rows, aes({ x: "x" }))
        .geomBar()
        .scales(scaleXBinned({ transform: "log10", breaks: [10, 100, 1000, 10_000] }))
        .spec(),
      size,
    );
    const scale = model.scales.x;
    if (scale.type === "band") throw new Error("expected a continuous x scale");
    expect(scale.transform).toBe("log10");
    // Public domain must be SEMANTIC (positive), never transformed decades.
    expect(scale.domain[0]).toBeGreaterThan(0);
    expect(scale.domain[1]).toBeGreaterThan(scale.domain[0]);

    const xs: number[] = [];
    for (let id = 0; id < model.candidates.size; id++) {
      const c = model.candidates.candidate(id);
      if (c !== null && typeof c.xValue === "number") xs.push(c.xValue);
    }
    const sorted = xs.toSorted((a, b) => a - b);
    // Transformed centers 1.5/2.5/3.5 → 10^x geometric centers.
    expect(sorted[0]).toBeCloseTo(10 ** 1.5, 2);
    expect(sorted[1]).toBeCloseTo(10 ** 2.5, 2);
    expect(sorted[2]).toBeCloseTo(10 ** 3.5, 2);
  });
});

describe("identity binned marks — snap to transformed centers, keep SOURCE tooltip x", () => {
  it("point candidates report the raw source x, not the snapped center", () => {
    const rows = [1, 9, 21].map((x) => ({ x, y: 1 }));
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scales(scaleXBinned({ breaks: [0, 10, 20, 30] }))
        .spec(),
      size,
    );
    const xs = new Set<number>();
    for (let id = 0; id < model.candidates.size; id++) {
      const c = model.candidates.candidate(id);
      if (c !== null && typeof c.xValue === "number") xs.add(c.xValue);
    }
    // Source rows keep raw x (1, 9, 21) — NOT snapped centers (5, 5, 25).
    expect(xs.has(1)).toBe(true);
    expect(xs.has(9)).toBe(true);
    expect(xs.has(21)).toBe(true);
    expect(xs.has(5)).toBe(false);
  });
});

describe("jitter over binned x — offsets scale to transformed bin WIDTH, never ids", () => {
  it("jittered points spread across a substantial fraction of the bin width", () => {
    // Many rows in ONE wide bin. Id-scaled jitter (resolution 1) would give a
    // negligible ±0.4 spread on a width-100 bin; width-scaled jitter gives ~±40.
    const rows = Array.from({ length: 40 }, (_, i) => ({ x: i, y: 1 }));
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint({ position: "jitter" })
        .scales(scaleXBinned({ breaks: [0, 100] }))
        .spec(),
      size,
    );
    const batch = model.scene.batches[0]!;
    if (batch.kind !== "points") throw new Error("expected a points batch");
    const xs: number[] = [];
    for (let i = 0; i < batch.positions.length; i += 2) xs.push(batch.positions[i]!);
    const spread = Math.max(...xs) - Math.min(...xs);
    // The single bin center maps to one pixel; jitter must spread pixels wide.
    // Id-scaled (±0.4 data units on a 100-wide bin) would be < 3px here.
    expect(spread).toBeGreaterThan(50);
  });
});

describe("binned × count × stack × facet matrix", () => {
  it("count + fill stacks per bin id (one segment per group within a bin)", () => {
    const rows = [
      { x: 1, g: "a" },
      { x: 2, g: "b" },
      { x: 3, g: "a" },
      { x: 11, g: "a" },
      { x: 12, g: "b" },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x", fill: "g" }))
        .geomBar({ position: "stack" })
        .scales(scaleXBinned({ breaks: [0, 10, 20] }))
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "rects");
    if (batch === undefined || batch.kind !== "rects") throw new Error("expected a rects batch");
    // 2 bins × 2 groups = 4 stacked segments; segments in a bin share an x.
    expect(batch.rowIndex.length).toBe(4);
    const xs: number[] = [];
    for (let i = 0; i < batch.rects.length; i += 4) xs.push(Math.round(batch.rects[i]! * 100));
    // Only two distinct bin centers (two bins), not four raw values.
    expect(new Set(xs).size).toBe(2);
  });

  it("count over binned is per-panel under faceting, sharing pre-facet boundaries", () => {
    const rows = [
      { x: 1, p: "L" },
      { x: 9, p: "L" },
      { x: 11, p: "L" },
      { x: 2, p: "R" },
      { x: 21, p: "R" },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x" }))
        .geomBar()
        .facet({ wrap: "p" })
        .scales(scaleXBinned({ breaks: [0, 10, 20, 30] }))
        .spec(),
      size,
    );
    const bars = model.scene.batches
      .filter((b) => b.kind === "rects")
      .reduce((sum, b) => sum + b.rowIndex.length, 0);
    // L: bins {0:[1,9], 1:[11]} = 2 bars; R: bins {0:[2], 2:[21]} = 2 bars = 4 total.
    expect(bars).toBe(4);
  });
});

describe("binned guides are SEMANTIC (inverse-projected), never transformed or bin ids", () => {
  it("log10 binned axis ticks read as semantic decades (10/100/1000), not 1/2/3", () => {
    const rows = [15, 150, 1500].map((x) => ({ x, y: 1 }));
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scales(scaleXBinned({ transform: "log10", breaks: [10, 100, 1000, 10_000] }))
        .spec(),
      size,
    );
    const values = model.scene.axes.x.ticks
      .map((t) => t.value)
      .filter((v): v is number => typeof v === "number");
    // Semantic: every tick value is a real (positive, large) source value.
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) expect(v).toBeGreaterThan(1);
    // No transformed-decade leak (1,2,3) and no bin-id leak (0,1,2).
    expect(values.some((v) => v >= 10)).toBe(true);
    expect(values.every((v) => v !== 0)).toBe(true);
  });
});

describe("continuous stats over binned x — consume transformed SOURCE values, not ids", () => {
  it("a smooth layer stays continuous (not collapsed to a few bin centers)", () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ x: i, y: i + (i % 3) }));
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomSmooth()
        .scales(scaleXBinned({ breaks: [0, 20, 40, 60] }))
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "path" || b.kind === "paths");
    if (batch === undefined) throw new Error("expected a path batch");
    const distinctX = new Set<number>();
    const positions = "positions" in batch ? (batch.positions as Float64Array) : new Float64Array();
    for (let i = 0; i < positions.length; i += 2) distinctX.add(Math.round(positions[i]! * 100));
    // A smooth grid has many distinct x — proof the stat read source x, not 3 bins.
    expect(distinctX.size).toBeGreaterThan(10);
  });
});
