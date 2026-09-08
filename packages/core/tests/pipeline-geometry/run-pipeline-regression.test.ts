/**
 * Geometry characterization — run-pipeline-regression.
 */
import { describe, expect, it } from "bun:test";
import { gg, aes } from "@ggts-sh/spec";
import { batchMarkCount, runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch, PointsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

describe("geometry via runPipeline (regression anchors)", () => {
  it("point layer: one points batch with N marks", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 4 },
          { x: 3, y: 6 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.kind).toBe("points");
    expect(batchMarkCount(batch)).toBe(3);
  });

  it("line layer: one paths batch with one subpath for ungrouped data", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 4 },
          { x: 3, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomLine()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batchMarkCount(batch)).toBe(1);
  });

  it("step layer: paths batch with curve from direction (default hv)", () => {
    const defaultHv = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomStep()
        .spec(),
      size,
    );
    const hvBatch = defaultHv.scene.batches[0] as PathsBatch;
    expect(hvBatch.kind).toBe("paths");
    expect(hvBatch.curve).toBe("step-hv");

    const vh = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomStep({ direction: "vh" })
        .spec(),
      size,
    );
    expect((vh.scene.batches[0] as PathsBatch).curve).toBe("step-vh");

    const mid = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomStep({ direction: "mid" })
        .spec(),
      size,
    );
    expect((mid.scene.batches[0] as PathsBatch).curve).toBe("step");
  });

  it("coord flip keeps mark count and remaps point into panel bounds", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 10 },
          { x: 2, y: 20 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .coord({ type: "flip" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    const panel = model.scene.panels[0]!;
    expect(batchMarkCount(batch)).toBe(2);
    for (let j = 0; j < 2; j++) {
      expect(batch.positions[j * 2]!).toBeGreaterThanOrEqual(0);
      expect(batch.positions[j * 2]!).toBeLessThanOrEqual(panel.width);
      expect(batch.positions[j * 2 + 1]!).toBeGreaterThanOrEqual(0);
      expect(batch.positions[j * 2 + 1]!).toBeLessThanOrEqual(panel.height);
    }
  });
});

describe("buildBatch dispatch via runPipeline", () => {
  it("point → points batch; line → paths; col → rects", () => {
    const point = runPipeline(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
      size,
    );
    expect(point.scene.batches[0]!.kind).toBe("points");

    const line = runPipeline(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomLine()
        .spec(),
      size,
    );
    expect(line.scene.batches[0]!.kind).toBe("paths");

    const col = runPipeline(
      gg(
        [
          { g: "a", y: 1 },
          { g: "b", y: 2 },
        ],
        aes({ x: "g", y: "y" }),
      )
        .geomCol()
        .spec(),
      size,
    );
    expect(col.scene.batches.some((b) => b.kind === "rects")).toBe(true);
  });

  it("smooth se ribbon attaches closedFrameRows for emitted band vertices (#502)", () => {
    // Dense enough for loess SE; x starts at 1 so log10 coord is defined.
    const rows = Array.from({ length: 30 }, (_, i) => ({
      x: i + 1,
      y: Math.sin(i / 4) * 10 + 20,
    }));
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomSmooth({ method: "loess", se: true, n: 20 })
        .coordTransform({ x: "log10" })
        .spec(),
      size,
    );
    const ribbon = model.scene.batches.find(
      (b) => b.kind === "paths" && b.closed === true && b.fills !== undefined,
    );
    expect(ribbon?.kind).toBe("paths");
    if (ribbon?.kind !== "paths") return;
    expect(ribbon.closedFrameRows).toBeDefined();
    // Pre-projection semantic verts: closedFrameRows length matches original topology
    // (semanticIndex maps render → that space after coord).
    expect(ribbon.closedFrameRows!.length).toBeGreaterThan(0);
    if (ribbon.semanticIndex !== undefined) {
      for (const semantic of ribbon.semanticIndex) {
        expect(semantic).toBeLessThan(ribbon.closedFrameRows!.length);
      }
    }
    // All closedFrameRows index into the smooth evaluation frame (0..n-1).
    for (const row of ribbon.closedFrameRows!) {
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(50);
    }
  });

  it("smooth with se ribbon emits closed ribbon path under the line", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 4 },
          { x: 3, y: 5 },
          { x: 4, y: 7 },
          { x: 5, y: 8 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomSmooth({ se: true, method: "lm" })
        .spec(),
      size,
    );
    const paths = model.scene.batches.filter((b) => b.kind === "paths");
    expect(paths.length).toBeGreaterThanOrEqual(2);
    const closed = paths.filter((b) => b.kind === "paths" && b.closed === true);
    expect(closed.length).toBeGreaterThanOrEqual(1);
    const line = paths.find((b) => b.kind === "paths" && b.closed !== true);
    expect(line).toBeTruthy();
  });

  it("area emits a closed filled path batch", () => {
    const area = runPipeline(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 4 },
          { x: 3, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomArea()
        .spec(),
      size,
    );
    const paths = area.scene.batches.find((b) => b.kind === "paths");
    expect(paths).toBeTruthy();
    if (paths?.kind === "paths") {
      expect(paths.closed).toBe(true);
      expect(paths.fills).toBeTruthy();
      // closed polygon: upper edge + lower edge = 2 * N vertices
      expect(paths.positions.length).toBe(3 * 2 * 2);
    }
  });

  it("text emits glyphs with label texts; annotation rule emits segments", () => {
    const text = runPipeline(
      gg(
        [
          { x: 1, y: 2, label: "a" },
          { x: 2, y: 3, label: "b" },
        ],
        aes({ x: "x", y: "y", label: "label" }),
      )
        .geomText()
        .spec(),
      size,
    );
    const glyphs = text.scene.batches.find((b) => b.kind === "glyphs");
    expect(glyphs).toBeTruthy();
    if (glyphs?.kind === "glyphs") {
      expect(glyphs.texts).toEqual(["a", "b"]);
      expect(batchMarkCount(glyphs)).toBe(2);
    }

    const rule = runPipeline(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomRule({ yintercept: 2.5 })
        .spec(),
      size,
    );
    expect(rule.scene.batches.some((b) => b.kind === "segments")).toBe(true);
    expect(batchMarkCount(rule.scene.batches.find((b) => b.kind === "segments")!)).toBeGreaterThan(
      0,
    );
  });

  it("boxplot emits composite rects + segments; errorbar emits segments", () => {
    const box = runPipeline(
      gg(
        [
          { g: "a", y: 1 },
          { g: "a", y: 2 },
          { g: "a", y: 3 },
          { g: "a", y: 10 },
        ],
        aes({ x: "g", y: "y" }),
      )
        .geomBoxplot()
        .spec(),
      size,
    );
    const kinds = new Set(box.scene.batches.map((b) => b.kind));
    expect(kinds.has("rects")).toBe(true);
    expect(kinds.has("segments")).toBe(true);
    // whiskers + median = two segment batches; outlier points when present
    expect(box.scene.batches.filter((b) => b.kind === "segments").length).toBeGreaterThanOrEqual(2);
    expect(box.scene.batches.some((b) => b.kind === "points")).toBe(true);

    const err = runPipeline(
      gg(
        [
          { x: "a", ymin: 1, ymax: 3 },
          { x: "b", ymin: 2, ymax: 5 },
        ],
        aes({ x: "x", ymin: "ymin", ymax: "ymax" }),
      )
        .geomErrorbar()
        .spec(),
      size,
    );
    expect(err.scene.batches.every((b) => b.kind === "segments")).toBe(true);
  });
});
