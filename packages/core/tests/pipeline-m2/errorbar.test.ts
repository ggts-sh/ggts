/**
 * M2 pipeline — errorbar geom.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { SegmentsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

describe("errorbar geom", () => {
  it("identity stat: three segments (bar + caps) per row from ymin/ymax fields", () => {
    const model = runPipeline(
      gg({ g: ["a", "b"], lo: [1, 2], hi: [3, 5] }, aes({ x: "g", ymin: "lo", ymax: "hi" }))
        .geomErrorbar()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as SegmentsBatch;
    expect(batch.kind).toBe("segments");
    expect(batch.segments.length / 4).toBe(6);
    expect(model.scales.x.type).toBe("band");
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(1);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(5);
    }
  });

  it("summary stat computes mean_se bounds per x group", () => {
    const model = runPipeline(
      gg({ g: ["a", "a", "a", "b", "b", "b"], v: [1, 2, 3, 10, 12, 14] }, aes({ x: "g", y: "v" }))
        .geomErrorbar({ stat: "summary" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as SegmentsBatch;
    expect(batch.segments.length / 4).toBe(6); // 2 groups x 3 segments
    // mean_se of [1,2,3]: mean 2, se = 1/sqrt(3) => domain min <= 2 - 0.577.
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(2 - 1 / Math.sqrt(3) + 1e-9);
    }
  });

  it("identity stat without ymin/ymax is a missing-channel error", () => {
    expect(() =>
      runPipeline(
        gg({ g: ["a"], v: [1] }, aes({ x: "g", y: "v" }))
          .geomErrorbar()
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
  });
});

// ---------------------------------------------------------------------------
// jitter + nudge
// ---------------------------------------------------------------------------
