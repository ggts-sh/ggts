/**
 * M2 pipeline — density geom.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { scatter, size } from "./fixtures.ts";

describe("density geom", () => {
  const data = scatter(120);

  it("renders a closed area path from the zero baseline", () => {
    const model = runPipeline(
      gg({ x: data.x }, aes({ x: "x" }))
        .geomDensity()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.closed).toBe(true);
    expect(batch.fills).toBeDefined();
    expect(model.scales.y.type).toBe("linear");
    // density area from the zero baseline; 5% display expansion pads below it.
    if (model.scales.y.type !== "band") expect(model.scales.y.domain[0]).toBeLessThanOrEqual(0);
    expect(model.scene.axes.y.title).toBe("density");
  });

  it("overlays one curve per fill group", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", fill: "g" }))
        .geomDensity({ alpha: 0.5 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.pathOffsets.length - 1).toBe(2);
    expect(new Set(batch.fills).size).toBe(2);
    // Constant alpha must land on each subpath — SVG <g opacity> composites
    // siblings into an offscreen buffer first, so group alpha would occlude
    // the rear density even when the declared alpha is translucent.
    expect(batch.alpha).toBe(1);
    expect(batch.alphas).toEqual(Float32Array.from([0.5, 0.5]));
    expect(model.scene.legends).toHaveLength(1);
  });

  it("keeps a single density fill's constant alpha on the batch", () => {
    const model = runPipeline(
      gg({ x: data.x }, aes({ x: "x" }))
        .geomDensity({ alpha: 0.45 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.pathOffsets.length - 1).toBe(1);
    expect(batch.alpha).toBe(0.45);
    expect(batch.alphas).toBeUndefined();
  });

  it("warns and drops sub-two-point groups", () => {
    const model = runPipeline(
      gg({ x: [1, 2, 3, 4, 9], g: ["a", "a", "a", "a", "b"] }, aes({ x: "x", fill: "g" }))
        .geomDensity()
        .spec(),
      size,
    );
    expect(model.warnings.some((w) => w.code === "density-group-dropped")).toBe(true);
  });

  it("mapping aes.y on a density layer is a structured error", () => {
    try {
      runPipeline(
        gg({ x: [1, 2, 3], y: [1, 2, 3] }, aes({ x: "x", y: "y" }))
          .geomDensity()
          .spec(),
        size,
      );
      expect.unreachable();
    } catch (error) {
      expect((error as PipelineError).code).toBe("computed-y-mapped");
    }
  });
});

// ---------------------------------------------------------------------------
// errorbar + summary
// ---------------------------------------------------------------------------
