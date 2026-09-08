/**
 * M2 pipeline — geom spoke (#810): origin + angle + radius → segment.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { SegmentsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

describe("spoke geom (#810)", () => {
  it("emits one segment per row; horizontal spoke (angle=0) extends +radius in x", () => {
    const model = runPipeline(
      gg(
        { x: [0], y: [0], theta: [0], r: [2] },
        aes({ x: "x", y: "y", angle: "theta", radius: "r" }),
      )
        .geomSpoke()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as SegmentsBatch;
    expect(batch.kind).toBe("segments");
    expect(batch.segments.length / 4).toBe(1);
    const x0 = batch.segments[0]!;
    const y0 = batch.segments[1]!;
    const x1 = batch.segments[2]!;
    const y1 = batch.segments[3]!;
    // Horizontal spoke: tip is to the right of origin in pixel space; y unchanged.
    expect(x1).toBeGreaterThan(x0);
    expect(y1).toBeCloseTo(y0, 3);
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(2);
    }
  });

  it("trains domain from spoke tips beyond the origin alone", () => {
    const model = runPipeline(
      gg(
        { x: [1], y: [1], theta: [0], r: [9] },
        aes({ x: "x", y: "y", angle: "theta", radius: "r" }),
      )
        .geomSpoke()
        .spec(),
      size,
    );
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(10);
    }
  });

  it("accepts constant angle/radius via params when not mapped", () => {
    const model = runPipeline(
      gg({ x: [0, 1], y: [0, 1] }, aes({ x: "x", y: "y" }))
        .geomSpoke({ angle: 0, radius: 1 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as SegmentsBatch;
    expect(batch.segments.length / 4).toBe(2);
  });

  it("rejects discrete x for spoke endpoint math", () => {
    expect(() =>
      runPipeline(
        gg(
          { x: ["a", "b"], y: [0, 1], theta: [0, 0], r: [1, 1] },
          aes({ x: "x", y: "y", angle: "theta", radius: "r" }),
        )
          .geomSpoke()
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
  });
});
