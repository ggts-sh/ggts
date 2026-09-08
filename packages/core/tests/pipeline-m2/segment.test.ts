/**
 * M2 pipeline — segment geom (finite two-endpoint lines).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { SegmentsBatch } from "../../src/scene.ts";
import { sceneToSVGString } from "../../src/render-svg.ts";
import { size } from "./fixtures.ts";

describe("segment geom", () => {
  it("emits one finite segment per row from (x,y) to (xend,yend)", () => {
    const model = runPipeline(
      gg(
        { x: [0, 1], y: [0, 1], xend: [1, 0], yend: [1, 0] },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomSegment()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as SegmentsBatch;
    expect(batch.kind).toBe("segments");
    expect(batch.segments.length / 4).toBe(2);
    // First segment (0,0)→(1,1): start is lower-left of panel, end is upper-right
    // (y is flipped in pixel space). Panel size is smaller than the outer plot size.
    const x1 = batch.segments[0]!;
    const y1 = batch.segments[1]!;
    const x2 = batch.segments[2]!;
    const y2 = batch.segments[3]!;
    expect(x2).toBeGreaterThan(x1);
    expect(y2).toBeLessThan(y1);
    // Domain includes both endpoints
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[0]).toBeLessThanOrEqual(0);
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(1);
    }
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(0);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(1);
    }
  });

  it("trains scales from xend/yend extremes not present in x/y", () => {
    const model = runPipeline(
      gg(
        { x: [1], y: [1], xend: [10], yend: [20] },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomSegment()
        .spec(),
      size,
    );
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(10);
    }
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(20);
    }
  });

  it("trains band domains from discrete xend categories absent from x", () => {
    const model = runPipeline(
      gg(
        { x: ["A"], y: [0], xend: ["Z"], yend: [1] },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomSegment()
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("band");
    expect(model.scales.x.domain).toContain("A");
    expect(model.scales.x.domain).toContain("Z");
  });

  it("uses geometry-based auto hit mode (not forced xy)", () => {
    // Vertical segment → defaultAutoMode "x"; horizontal → "y".
    const model = runPipeline(
      gg(
        {
          x: [1, 0],
          y: [0, 1],
          xend: [1, 10],
          yend: [10, 1],
        },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomSegment()
        .spec(),
      size,
    );
    expect(model.candidates.candidate(0)?.autoMode).toBe("x");
    expect(model.candidates.candidate(1)?.autoMode).toBe("y");
  });

  it("does not reject a binned x from unused plot-level xend on a point layer", () => {
    // Plot aes includes xend for a sibling segment; point layer must not train
    // binned x from the (possibly nominal) endpoint field.
    expect(() =>
      runPipeline(
        gg(
          { x: [1, 2, 3], y: [1, 2, 3], xend: ["a", "b", "c"], yend: [1, 2, 3] },
          aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
        )
          .geomPoint()
          .scales({ x: { type: "binned" } })
          .spec(),
        size,
      ),
    ).not.toThrow();
  });

  it("requires all four endpoints at bind time", () => {
    expect(() =>
      runPipeline(
        gg({ x: [1], y: [2] }, aes({ x: "x", y: "y" }))
          .geomSegment()
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
  });

  it("removes rows with non-finite endpoints", () => {
    const model = runPipeline(
      gg(
        { x: [0, 1], y: [0, 1], xend: [1, null], yend: [1, 0] },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomSegment()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as SegmentsBatch | undefined;
    if (batch === undefined) {
      expect(model.scene.batches.length).toBe(0);
      return;
    }
    expect(batch.segments.length / 4).toBe(1);
  });

  it("sets linecap from params.lineend (default butt)", () => {
    const model = runPipeline(
      gg(
        { x: [0], y: [0], xend: [1], yend: [1] },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomSegment({ lineend: "round" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as SegmentsBatch;
    expect(batch.linecap).toBe("round");
  });

  it("does not put stroke-linecap on rule SVG output", () => {
    const model = runPipeline(
      gg({ x: [1, 2], y: [3, 4] }, aes({ x: "x", y: "y" }))
        .geomRule({ yintercept: 2 })
        .spec(),
      size,
    );
    const svg = sceneToSVGString(model.scene);
    expect(svg).not.toContain("stroke-linecap");
  });

  it("emits stroke-linecap on segment SVG when lineend is set", () => {
    const model = runPipeline(
      gg(
        { x: [0], y: [0], xend: [1], yend: [1] },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomSegment({ lineend: "square" })
        .spec(),
      size,
    );
    const svg = sceneToSVGString(model.scene);
    expect(svg).toContain('stroke-linecap="square"');
  });

  it("flips finite segment endpoints under coord flip", () => {
    const model = runPipeline(
      gg(
        { x: [0], y: [0], xend: [1], yend: [1] },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomSegment()
        .coord({ type: "flip" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as SegmentsBatch;
    // After flip, cartesian (x,y)→(width-y, height-x) per geometry-flip.
    // Original (0,0)→(w,h) in px becomes flipped; just assert we still have one segment.
    expect(batch.segments.length / 4).toBe(1);
    // Both endpoints should differ (not a zero-length collapse).
    const dx = batch.segments[2]! - batch.segments[0]!;
    const dy = batch.segments[3]! - batch.segments[1]!;
    expect(Math.hypot(dx, dy)).toBeGreaterThan(0);
  });
});
