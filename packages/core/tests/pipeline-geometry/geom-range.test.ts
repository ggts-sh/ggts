/**
 * Range geoms: linerange, pointrange, crossbar (#793).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg, validate } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import type { PointsBatch, RectsBatch, SegmentsBatch } from "../../src/scene.ts";

const size = { width: 200, height: 100 };

describe("range geoms schema (#793)", () => {
  it("accepts linerange with x ymin ymax", () => {
    const result = validate(
      {
        data: { values: [{ x: 1, lo: 0, hi: 2 }] },
        aes: { x: { field: "x" }, ymin: { field: "lo" }, ymax: { field: "hi" } },
        layers: [{ geom: "linerange" }],
      },
      {},
    );
    expect(result.ok).toBe(true);
  });

  it("pointrange identity requires y as well as ymin/ymax", () => {
    const missing = validate(
      {
        data: { values: [{ x: 1, lo: 0, hi: 2 }] },
        aes: { x: { field: "x" }, ymin: { field: "lo" }, ymax: { field: "hi" } },
        layers: [{ geom: "pointrange" }],
      },
      {},
    );
    expect(missing.ok).toBe(false);
  });

  it("builder sugars emit the three geoms", () => {
    const data = { g: ["a"], mid: [1], lo: [0], hi: [2] };
    const mapping = aes({ x: "g", y: "mid", ymin: "lo", ymax: "hi" });
    expect(gg(data, mapping).geomLinerange().spec().layers[0]?.geom).toBe("linerange");
    expect(gg(data, mapping).geomPointrange().spec().layers[0]?.geom).toBe("pointrange");
    expect(gg(data, mapping).geomCrossbar({ fatten: 3 }).spec().layers[0]?.params).toMatchObject({
      fatten: 3,
    });
  });
});

describe("range geoms geometry (#793)", () => {
  it("linerange emits one vertical stem per row (no caps)", () => {
    const model = runPipeline(
      gg({ g: ["a", "b"], lo: [1, 2], hi: [3, 5] }, aes({ x: "g", ymin: "lo", ymax: "hi" }))
        .geomLinerange()
        .spec(),
      size,
    );
    const segs = model.scene.batches.filter((b): b is SegmentsBatch => b.kind === "segments");
    expect(segs).toHaveLength(1);
    expect(segs[0]!.segments.length / 4).toBe(2);
    // Each stem is vertical (same x).
    const s = segs[0]!.segments;
    expect(s[0]).toBeCloseTo(s[2]!, 5);
    expect(s[4]).toBeCloseTo(s[6]!, 5);
  });

  it("pointrange emits stem segments then points (draw order)", () => {
    const model = runPipeline(
      gg(
        { g: ["a"], mid: [2], lo: [1], hi: [3] },
        aes({ x: "g", y: "mid", ymin: "lo", ymax: "hi" }),
      )
        .geomPointrange({ size: 4 })
        .spec(),
      size,
    );
    const kinds = model.scene.batches.map((b) => b.kind);
    expect(kinds).toEqual(["segments", "points"]);
    const points = model.scene.batches[1] as PointsBatch;
    expect(points.size).toBe(4);
    expect(points.positions.length / 2).toBe(1);
  });

  it("crossbar emits rects then mid segments; fatten scales mid linewidth", () => {
    const model = runPipeline(
      gg(
        { g: ["a"], mid: [2], lo: [1], hi: [3] },
        aes({ x: "g", y: "mid", ymin: "lo", ymax: "hi" }),
      )
        .geomCrossbar({ linewidth: 1, fatten: 3 })
        .spec(),
      size,
    );
    const kinds = model.scene.batches.map((b) => b.kind);
    expect(kinds).toEqual(["rects", "segments"]);
    const rect = model.scene.batches[0] as RectsBatch;
    expect(rect.rects.length / 4).toBe(1);
    // width, height > 0
    expect(rect.rects[2]!).toBeGreaterThan(0);
    expect(rect.rects[3]!).toBeGreaterThan(0);
    const mid = model.scene.batches[1] as SegmentsBatch;
    expect(mid.linewidth).toBe(3);
  });

  it("crossbar defaults to hollow (paper) when fill is unmapped", () => {
    const model = runPipeline(
      gg(
        { g: ["a"], mid: [2], lo: [1], hi: [3] },
        aes({ x: "g", y: "mid", ymin: "lo", ymax: "hi" }),
      )
        .geomCrossbar()
        .spec(),
      size,
    );
    const rect = model.scene.batches[0] as RectsBatch;
    expect(rect.fill).toBeNull();
    expect(rect.fillRole).toBe("paper");
  });

  it("crossbar width uses errorbar resolution rule on continuous x", () => {
    const model = runPipeline(
      gg(
        { x: [0, 10], mid: [1, 1], lo: [0, 0], hi: [2, 2] },
        aes({ x: "x", y: "mid", ymin: "lo", ymax: "hi" }),
      )
        .geomCrossbar({ width: 0.5 })
        .spec(),
      size,
    );
    const rect = model.scene.batches.find((b) => b.kind === "rects") as RectsBatch;
    // resolution of x is 10; half-width 0.5 * 10 / 2 in data → non-zero panel width
    expect(rect.rects[2]!).toBeGreaterThan(1);
  });

  it("drops rows with null ymin without inventing segments", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { g: "a", lo: 1, hi: 3 },
            { g: "b", lo: null, hi: 5 },
          ],
        },
        aes: { x: { field: "g" }, ymin: { field: "lo" }, ymax: { field: "hi" } },
        layers: [{ geom: "linerange" }],
      },
      size,
    );
    const segs = model.scene.batches[0] as SegmentsBatch;
    expect(segs.segments.length / 4).toBe(1);
  });

  it("pointrange drops the mid point when ymin is null (no floating estimate)", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { g: "a", mid: 2, lo: 1, hi: 3 },
            { g: "b", mid: 4, lo: null, hi: 5 },
          ],
        },
        aes: {
          x: { field: "g" },
          y: { field: "mid" },
          ymin: { field: "lo" },
          ymax: { field: "hi" },
        },
        layers: [{ geom: "pointrange" }],
      },
      size,
    );
    const segs = model.scene.batches.filter((b) => b.kind === "segments");
    const pts = model.scene.batches.filter((b) => b.kind === "points");
    expect(segs[0]!.segments.length / 4).toBe(1);
    expect(pts[0]!.positions.length / 2).toBe(1);
  });
});
