/**
 * Geometry characterization — paths-boxplot.
 */
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "bun:test";
import type { LayerFrame } from "../../src/pipeline/types.ts";
import type { Frame } from "../../src/pipeline/geometry-shared.ts";

describe("appendClosedBandEdges — shared closed ribbon vertices", () => {
  it("writes upper edge ascending then lower edge descending", async () => {
    const { appendClosedBandEdges } = await import("../../src/pipeline/geometry-paths-closed.ts");
    const positions = new Float32Array(16);
    const rowIndex = new Uint32Array(8);
    const frame = fromAny<LayerFrame>({
      xNumeric: new Float64Array([0, 1]),
      xValues: null,
      rowIndex: new Uint32Array([10, 11]),
      ymin: new Float64Array([0.2, 0.3]),
      ymax: new Float64Array([0.8, 0.9]),
    });
    const fx = fromPartial<Frame>({
      innerWidth: 100,
      innerHeight: 200,
      xScale: {
        type: "linear",
        normalize: (v: number) => v,
        normalizeTransformed: (v: number) => v,
      },
      yScale: {
        type: "linear",
        normalize: (v: number) => v,
        normalizeTransformed: (v: number) => v,
      },
    });
    const cursor = appendClosedBandEdges({
      positions,
      rowIndex,
      cursor: 0,
      rows: [0, 1],
      frame,
      fx,
      yTop: frame.ymax!,
      yBottom: frame.ymin!,
    });
    expect(cursor).toBe(4);
    // upper: row0 (0, 0.8) -> px (0, 200-160)=(0,40); row1 (1,0.9)->(100,20)
    expect(positions[0]).toBeCloseTo(0);
    expect(positions[1]).toBeCloseTo(40);
    expect(positions[2]).toBeCloseTo(100);
    expect(positions[3]).toBeCloseTo(20);
    // lower reverse: row1 (1,0.3)->(100,140); row0 (0,0.2)->(0,160)
    expect(positions[4]).toBeCloseTo(100);
    expect(positions[5]).toBeCloseTo(140);
    expect(positions[6]).toBeCloseTo(0);
    expect(positions[7]).toBeCloseTo(160);
    expect([...rowIndex.subarray(0, 4)]).toEqual([10, 11, 11, 10]);
  });
});

describe("boxplot body — rendered composite", () => {
  it("emits hinge rects, whiskers, and a 2×-fattened median line", async () => {
    const { aes, gg } = await import("@ggts-sh/spec");
    const { runPipeline } = await import("../../src/pipeline.ts");
    const model = runPipeline(
      gg(
        [
          { g: "a", y: 1 },
          { g: "a", y: 2 },
          { g: "a", y: 3 },
          { g: "a", y: 4 },
          { g: "a", y: 5 },
          { g: "b", y: 10 },
          { g: "b", y: 12 },
          { g: "b", y: 14 },
          { g: "b", y: 16 },
          { g: "b", y: 18 },
        ],
        aes({ x: "g", y: "y" }),
      )
        .geomBoxplot()
        .spec(),
      { width: 200, height: 100 },
    );
    const segments = model.scene.batches.filter((b) => b.kind === "segments");
    const rects = model.scene.batches.find((b) => b.kind === "rects");
    expect(rects).toBeDefined();
    expect(rects!.kind).toBe("rects");
    if (rects!.kind !== "rects") throw new Error("expected rects");
    // two categories → two hinge boxes
    expect(rects.rects.length / 4).toBe(2);
    expect(segments.length).toBe(2);
    const [whiskers, medians] = segments;
    if (whiskers!.kind !== "segments" || medians!.kind !== "segments") {
      throw new Error("expected whisker and median segment batches");
    }
    // 2 whiskers × 2 boxes; 1 median × 2 boxes
    expect(whiskers.segments.length / 4).toBe(4);
    expect(medians.segments.length / 4).toBe(2);
    // ggplot2 fatten default: median linewidth is 2× the box/whisker linewidth
    expect(medians.linewidth).toBe(whiskers.linewidth * 2);
  });
});

describe("areaGroupFillOf", () => {
  it("uses the constant fill when no scaled fill is mapped", async () => {
    const { areaGroupFillOf } = await import("../../src/pipeline/geometry-paths-area-fill.ts");
    const frame = fromAny({
      binding: { fill: { constant: "#cde", scaledConstant: null } },
      fillValues: null,
    });
    expect(areaGroupFillOf(frame, null, [0])).toBe("#cde");
  });
});
