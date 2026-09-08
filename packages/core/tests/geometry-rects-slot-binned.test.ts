/**
 * Binned identity/count rect slots: recover edges via stable `bin.xId`, not
 * O(R·B) `centers.findIndex` scans.
 */
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "bun:test";

import { aes, gg, scaleXBinned } from "@ggts-sh/spec";

import { resolveRectSlot } from "../src/pipeline/geometry-rects-slot.ts";
import type { Frame } from "../src/pipeline/geometry-shared.ts";
import type { LayerFrame } from "../src/pipeline/types.ts";
import { runPipeline } from "../src/pipeline.ts";

const size = { width: 640, height: 400 };

function identityFx(): Frame {
  return fromPartial<Frame>({
    innerWidth: 100,
    innerHeight: 100,
    xScale: {
      type: "linear",
      transformedDomain: [0, 30] as const,
      normalize: (v: number) => v / 30,
      normalizeTransformed: (v: number) => v / 30,
    },
    yScale: {
      type: "linear",
      transformedDomain: [0, 1] as const,
      normalize: (v: number) => v,
      normalizeTransformed: (v: number) => v,
    },
  });
}

describe("resolveRectSlot — binned identity prefers bin.xId over centers.findIndex", () => {
  it("uses integer bin id when it disagrees with Object.is center scan", () => {
    // Centers [5, 15] for edges [0,10,20]. Row 0's xNumeric equals center 0,
    // but bin.xId claims bin 1 — integer id is the discrete source of truth.
    const frame = fromAny<LayerFrame>({
      n: 1,
      binding: {
        index: 0,
        xBinning: {
          edges: [0, 10, 20],
          centers: [5, 15],
        },
      },
      xNumeric: Float64Array.of(5),
      bin: { xId: Int32Array.of(1), yId: null },
      ymin: Float64Array.of(0),
      ymax: Float64Array.of(1),
      xmin: null,
      xmax: null,
      dodge: null,
    });
    const slot = resolveRectSlot({
      frame,
      fx: identityFx(),
      row: 0,
      binned: true,
      widthFrac: 1,
    });
    expect(slot).not.toBeNull();
    // Bin 1 spans [10, 20] → center 15 in scale space → normalize 15/30 = 0.5
    expect(slot!.center).toBeCloseTo(0.5, 12);
    expect(slot!.w).toBeCloseTo(10 / 30, 12);
  });

  it("drops rows with bin.xId −1 (out of range)", () => {
    const frame = fromAny<LayerFrame>({
      n: 1,
      binding: {
        index: 0,
        xBinning: {
          edges: [0, 10, 20],
          centers: [5, 15],
        },
      },
      xNumeric: Float64Array.of(5),
      bin: { xId: Int32Array.of(-1), yId: null },
      ymin: Float64Array.of(0),
      ymax: Float64Array.of(1),
      xmin: null,
      xmax: null,
      dodge: null,
    });
    expect(
      resolveRectSlot({
        frame,
        fx: identityFx(),
        row: 0,
        binned: true,
        widthFrac: 1,
      }),
    ).toBeNull();
  });
});

describe("scaleXBinned — identity geom_col edge recovery (pipeline seam)", () => {
  it("unequal-width explicit bins yield proportional rect widths", () => {
    // Breaks [0, 10, 40]: bin0 width 10, bin1 width 30 (3×).
    const rows = [
      { x: 5, y: 1 },
      { x: 25, y: 1 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomCol({ width: 1 })
        .scales(scaleXBinned({ breaks: [0, 10, 40] }))
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "rects");
    if (batch === undefined || batch.kind !== "rects") throw new Error("expected rects");
    expect(batch.rowIndex.length).toBe(2);
    const w0 = batch.rects[2]!;
    const w1 = batch.rects[6]!;
    expect(w1 / w0).toBeCloseTo(3, 5);
  });

  it("out-of-range x rows are removed from the rect batch", () => {
    const rows = [
      { x: 5, y: 1 },
      { x: 100, y: 1 }, // outside [0, 30]
      { x: 15, y: 1 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomCol()
        .scales(scaleXBinned({ breaks: [0, 10, 20, 30] }))
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "rects");
    if (batch === undefined || batch.kind !== "rects") throw new Error("expected rects");
    // Source rowIndex for kept rows is the original table index.
    expect([...batch.rowIndex]).toEqual([0, 2]);
  });
});
