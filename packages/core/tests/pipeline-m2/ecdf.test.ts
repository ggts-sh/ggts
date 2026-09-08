/**
 * M2 pipeline — line + stat ecdf.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

describe("line + stat ecdf", () => {
  it("emits a paths batch with ecdf y in [0,1] and step-hv curve", () => {
    const model = runPipeline(
      gg({ x: [1, 2, 2, 3] }, aes({ x: "x" }))
        .geomLine({ stat: "ecdf", curve: "step-hv", pad: true })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.curve).toBe("step-hv");
    expect(batch.pathOffsets.length - 1).toBe(1);
    // pad + 3 unique x → 4 vertices
    expect(batch.positions.length / 2).toBe(4);
    expect(model.scales.y.type).toBe("linear");
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(0);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(1);
    }
    expect(model.scene.axes.y.title).toBe("ecdf");
  });

  it("draws one subpath per color group", () => {
    const model = runPipeline(
      gg({ x: [1, 2, 3, 10, 11], g: ["a", "a", "a", "b", "b"] }, aes({ x: "x", color: "g" }))
        .geomLine({ stat: "ecdf", curve: "step-hv", pad: false })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.pathOffsets.length - 1).toBe(2);
  });

  it("mapping field y with ecdf is a structured error", () => {
    try {
      runPipeline(
        gg({ x: [1, 2, 3], y: [1, 2, 3] }, aes({ x: "x", y: "y" }))
          .geomLine({ stat: "ecdf" })
          .spec(),
        size,
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("computed-y-mapped");
    }
  });
});
