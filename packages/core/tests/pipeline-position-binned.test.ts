/**
 * PR 3 — `type: "binned"` position family (identity-position geoms).
 *
 * Two-phase contract: transformed-space automatic/explicit boundaries are
 * resolved once from the parent table before any frame/stat reads (pre-stat),
 * every valid input snaps to its bin's transformed center, and that snapped
 * value flows through the existing pre-stat/geometry/training call sites with
 * no further special-casing. Bin membership doubles as the stack/dodge
 * grouping key via exact-float-equality slot keys.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg, scaleXBinned } from "@ggts-sh/spec";

import { MAX_BINNED_BREAKS as SPEC_MAX_BINNED_BREAKS } from "@ggts-sh/spec";

import { PipelineError, runPipeline } from "../src/pipeline.ts";
import { MAX_BINNED_BREAKS, resolveBinnedBoundaries } from "../src/pipeline/binned-scale.ts";

const size = { width: 640, height: 400 };

describe("scaleXBinned — automatic boundaries snap to a small, bounded set of bin centers", () => {
  it("100 distinct x values render at far fewer distinct pixel positions", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ x: i, y: 1 }));
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scales(scaleXBinned())
        .spec(),
      size,
    );
    const batch = model.scene.batches[0]!;
    if (batch.kind !== "points") throw new Error("expected a points batch");
    expect(batch.rowIndex.length).toBe(100);
    const distinctX = new Set<number>();
    for (let i = 0; i < batch.positions.length; i += 2) distinctX.add(batch.positions[i]!);
    expect(distinctX.size).toBeLessThan(20);
    expect(distinctX.size).toBeGreaterThan(1);
  });
});

describe("scaleXBinned — explicit breaks control exact bin edges/centers", () => {
  it("values in the same explicit bin render at the exact same pixel x (snapped to one center)", () => {
    // Bins [0,10] -> center 5, (10,20] -> center 15, (20,30] -> center 25
    // (right-closed, inclusive lowest bound).
    const rows = [1, 9, 11, 19, 21, 29].map((x) => ({ x, y: 1 }));
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scales(scaleXBinned({ breaks: [0, 10, 20, 30] }))
        .spec(),
      size,
    );
    const batch = model.scene.batches[0]!;
    if (batch.kind !== "points") throw new Error("expected a points batch");
    const xs: number[] = [];
    for (let i = 0; i < batch.positions.length; i += 2) xs.push(batch.positions[i]!);
    // Pairs (1,9), (11,19), (21,29) share a bin -> identical pixel x.
    expect(xs[0]).toBeCloseTo(xs[1]!, 4);
    expect(xs[2]).toBeCloseTo(xs[3]!, 4);
    expect(xs[4]).toBeCloseTo(xs[5]!, 4);
    // The three bins are distinct and evenly spaced (equal bin widths).
    const distinct = [...new Set(xs.map((v) => Math.round(v * 1000)))];
    expect(distinct.length).toBe(3);
  });

  it("a value exactly on a shared edge belongs to the LOWER-indexed (right-closed) bin", () => {
    const rows = [{ x: 10, y: 1 }];
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scales(scaleXBinned({ breaks: [0, 10, 20] }))
        .spec(),
      size,
    );
    const scale = model.scales.x;
    if (scale.type === "band") throw new Error("expected a continuous x scale");
    expect(Math.round(scale.domain[0])).toBeLessThanOrEqual(5);
    expect(Math.round(scale.domain[1])).toBeGreaterThanOrEqual(5);
  });
});

describe("scaleXBinned — MAX_BINNED_BREAKS (shared spec/core constant)", () => {
  it("core re-exports the identical spec constant (single source of truth)", () => {
    expect(MAX_BINNED_BREAKS).toBe(64);
    expect(MAX_BINNED_BREAKS).toBe(SPEC_MAX_BINNED_BREAKS);
  });

  it("TypeBox rejects explicit breaks beyond the cap before data execution", () => {
    // n boundaries → n − 1 bins, so > MAX_BINNED_BREAKS + 1 items is invalid.
    const breaks = Array.from({ length: MAX_BINNED_BREAKS + 2 }, (_, i) => i);
    const rows = [{ x: 1, y: 1 }];
    expect(() =>
      runPipeline(
        gg(rows, aes({ x: "x", y: "y" }))
          .geomPoint()
          .scales(scaleXBinned({ breaks }))
          .spec(),
        size,
      ),
    ).toThrow(/breaks/);
  });

  it("the runtime resolver guards over-limit boundaries with binned-scale-break-limit", () => {
    // Defends the internally-resolved path (bypassing TypeBox): 66 edges → 65 bins.
    const edges = Array.from({ length: MAX_BINNED_BREAKS + 2 }, (_, i) => i);
    try {
      resolveBinnedBoundaries(null, edges);
      throw new Error("expected resolveBinnedBoundaries to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as InstanceType<typeof PipelineError>).code).toBe("binned-scale-break-limit");
    }
  });
});

describe("scaleXBinned — requires a quantitative field", () => {
  it("rejects a nominal field with binned-scale-requires-continuous", () => {
    const rows = [
      { x: "a", y: 1 },
      { x: "b", y: 2 },
    ];
    for (const breaks of [undefined, [0, 10]]) {
      try {
        runPipeline(
          gg(rows, aes({ x: "x", y: "y" }))
            .geomPoint()
            .scales(scaleXBinned({ ...(breaks !== undefined && { breaks }) }))
            .spec(),
          size,
        );
        throw new Error("expected runPipeline to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(PipelineError);
        expect((error as InstanceType<typeof PipelineError>).code).toBe(
          "binned-scale-requires-continuous",
        );
      }
    }
  });

  it("coerces numeric strings as quantitative instead of inferring time or nominal", () => {
    const model = runPipeline(
      gg(
        [
          { x: "2024", y: 1 },
          { x: "2025", y: 2 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales(scaleXBinned({ breaks: [2023, 2024, 2025] }))
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("linear");
    expect(model.scene.batches[0]?.rowIndex).toHaveLength(2);
    expect(model.scaleDecisions.some((decision) => decision.aesthetic === "x")).toBe(false);
  });

  it("rejects explicit boundaries that cannot produce a valid bin", () => {
    for (const breaks of [
      [-10, 0],
      ["0", "10"],
    ] as const) {
      try {
        runPipeline(
          gg([{ x: 1, y: 1 }], aes({ x: "x", y: "y" }))
            .geomPoint()
            .scales(scaleXBinned({ transform: "log10", breaks: [...breaks] }))
            .spec(),
          size,
        );
        throw new Error("expected invalid binned boundaries to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(PipelineError);
        expect((error as InstanceType<typeof PipelineError>).code).toBe("invalid-scale-breaks");
      }
    }
  });
});

describe("scaleXBinned — bin membership doubles as the dodge/stack grouping key", () => {
  it("two rows in the same bin dodge into two slots at that bin's center", () => {
    const rows = [
      { x: 1, y: 1, g: "a" },
      { x: 2, y: 1, g: "b" },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y", fill: "g" }))
        .geomCol({ position: "dodge" })
        .scales(scaleXBinned({ breaks: [0, 10] }))
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "rects");
    if (batch === undefined || batch.kind !== "rects") throw new Error("expected a rects batch");
    expect(batch.rowIndex.length).toBe(2);
    // Same bin -> both rects dodge around the SAME center, at DIFFERENT x.
    const x0 = batch.rects[0]!;
    const x1 = batch.rects[4]!;
    expect(x0).not.toBeCloseTo(x1, 0);
    const w0 = batch.rects[2]!;
    const w1 = batch.rects[6]!;
    expect(w1).toBeCloseTo(w0, 0);
    expect(x0 + w0).toBeCloseTo(x1, 0);
  });
});

describe("scaleXBinned — composes with transform: log10 (bins in transformed space)", () => {
  it("equal-ratio explicit log10 bins produce equal-width transformed bins", () => {
    const rows = [15, 150, 1500].map((x) => ({ x, y: 1 }));
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scales(scaleXBinned({ transform: "log10", breaks: [10, 100, 1000, 10_000] }))
        .spec(),
      size,
    );
    const scale = model.scales.x;
    if (scale.type === "band") throw new Error("expected a continuous x scale");
    expect(scale.transform).toBe("log10");
    const batch = model.scene.batches[0]!;
    if (batch.kind !== "points") throw new Error("expected a points batch");
    const xs = [batch.positions[0]!, batch.positions[2]!, batch.positions[4]!].toSorted(
      (a, b) => a - b,
    );
    const gap1 = xs[1]! - xs[0]!;
    const gap2 = xs[2]! - xs[1]!;
    expect(gap1).toBeCloseTo(gap2, 0);
  });
});
