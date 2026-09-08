/**
 * M2 pipeline — boxplot geom.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import { mulberry32 } from "../../src/stats/numeric.ts";
import type { PointsBatch, RectsBatch, SegmentsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

describe("boxplot geom", () => {
  const rows: { cat: string; v: number; side: string }[] = [];
  const rnd = mulberry32(11);
  for (const cat of ["a", "b", "c"]) {
    for (let i = 0; i < 20; i++) {
      rows.push({ cat, v: rnd() * 10 + (cat === "b" ? 8 : 0), side: i % 2 === 0 ? "l" : "r" });
    }
  }
  rows.push({ cat: "a", v: 60, side: "l" }); // guaranteed outlier

  it("composes whiskers, boxes, medians, and outlier points", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "cat", y: "v" }))
        .geomBoxplot()
        .spec(),
      size,
    );
    const kinds = model.scene.batches.map((b) => b.kind);
    expect(kinds).toEqual(["segments", "rects", "segments", "points"]);
    const [whiskers, boxes, medians, outliers] = model.scene.batches as [
      SegmentsBatch,
      RectsBatch,
      SegmentsBatch,
      PointsBatch,
    ];
    expect(boxes.rects.length / 4).toBe(3);
    expect(boxes.fillRole).toBe("paper");
    expect(boxes.stroke).toBeNull(); // theme ink outline
    expect(whiskers.segments.length / 4).toBe(6); // 2 per box
    expect(medians.segments.length / 4).toBe(3);
    expect(medians.linewidth).toBe(whiskers.linewidth * 2);
    expect(outliers.rowIndex.length).toBeGreaterThanOrEqual(1);
    expect(model.scales.x.type).toBe("band");
  });

  it("dodges grouped boxes within each band (fill mapping, default position)", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "cat", y: "v", fill: "side" }))
        .geomBoxplot()
        .spec(),
      size,
    );
    const boxes = model.scene.batches.find((b) => b.kind === "rects") as RectsBatch;
    expect(boxes.rects.length / 4).toBe(6); // 3 cats x 2 sides
    expect(new Set(boxes.fills).size).toBe(2);
    // Dodged pairs: two boxes per band, non-overlapping x ranges.
    const xs = Array.from({ length: 6 }, (_, j) => boxes.rects[j * 4]!).toSorted((a, b) => a - b);
    expect(new Set(xs.map((v) => v.toFixed(2))).size).toBe(6);
  });

  it("quantitative x is a channel-type-mismatch error (M2 scope: discrete x)", () => {
    try {
      runPipeline(
        gg({ x: [1, 2], y: [1, 2] }, aes({ x: "x", y: "y" }))
          .geomBoxplot()
          .spec(),
        size,
      );
      expect.unreachable();
    } catch (error) {
      expect((error as PipelineError).code).toBe("channel-type-mismatch");
    }
  });

  it("drops rows with missing y (na-drop warning)", () => {
    const model = runPipeline(
      gg({ x: ["a", "a", "a"], y: [1, null, 3] }, aes({ x: "x", y: "y" }))
        .geomBoxplot()
        .spec(),
      size,
    );
    expect(model.warnings.some((w) => w.code === "removed-missing")).toBe(true);
  });

  it("defaults to ggplot2 box width 0.75 and caps panel fraction for few categories (#653)", () => {
    const three = runPipeline(
      gg(rows, aes({ x: "cat", y: "v" }))
        .geomBoxplot()
        .spec(),
      size,
    );
    const threeBoxes = three.scene.batches.find((b) => b.kind === "rects") as RectsBatch;
    const threeWidth = threeBoxes.rects[2]!; // rect layout: x,y,w,h
    const threePanel = three.scene.panels[0]!;
    // step=1/3, 0.75*step≈0.25 of panel — must cap so 3-category charts stay readable
    // Float32 rect storage + theme chrome can sit ~1e-6 outside a pure *0.15 bound.
    expect(threeWidth).toBeLessThanOrEqual(threePanel.width * 0.15 + 1e-5);
    expect(threeWidth).toBeGreaterThan(0);

    const manyCats = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const manyRows = manyCats.flatMap((cat) =>
      Array.from({ length: 12 }, (_, i) => ({ cat, v: i + (cat.codePointAt(0)! % 5), side: "l" })),
    );
    const eight = runPipeline(
      gg(manyRows, aes({ x: "cat", y: "v" }))
        .geomBoxplot()
        .spec(),
      size,
    );
    const eightBoxes = eight.scene.batches.find((b) => b.kind === "rects") as RectsBatch;
    const eightWidth = eightBoxes.rects[2]!;
    // 0.75 / 8 = 0.09375 of panel — under the cap, so uncapped ggplot2 fraction
    const eightPanel = eight.scene.panels[0]!;
    // Float32 rect storage vs theme chrome (axis title size) — 4 dp is enough
    // to lock the ggplot2 width fraction without flaking on sub-pixel epsilon.
    expect(eightWidth).toBeCloseTo(0.75 * (1 / 8) * eightPanel.width, 4);

    const wide = runPipeline(
      gg(rows, aes({ x: "cat", y: "v" }))
        .geomBoxplot({ width: 1 })
        .spec(),
      size,
    );
    const wideBoxes = wide.scene.batches.find((b) => b.kind === "rects") as RectsBatch;
    // Explicit width bypasses the few-category cap (full step).
    expect(wideBoxes.rects[2]!).toBeCloseTo((1 / 3) * threePanel.width, 4);
  });
});
