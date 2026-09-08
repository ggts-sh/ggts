/**
 * M2 pipeline — histogram geom.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { RectsBatch } from "../../src/scene.ts";
import { scatter, size } from "./fixtures.ts";

describe("histogram geom (canonicalized to bar + stat bin)", () => {
  const data = scatter(200);

  it("emits bin-spanning rects on a continuous x scale", () => {
    const model = runPipeline(
      gg({ x: data.x }, aes({ x: "x" }))
        .geomHistogram({ binwidth: 1, boundary: 0 })
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("linear");
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.kind).toBe("rects");
    expect(batch.rects.length / 4).toBe(10); // 10 bins over (0, 10)
    // Bins abut: each rect's right edge is the next rect's left edge.
    for (let j = 1; j < 10; j++) {
      const prevRight = batch.rects[(j - 1) * 4]! + batch.rects[(j - 1) * 4 + 2]!;
      expect(batch.rects[j * 4]!).toBeCloseTo(prevRight, 3);
    }
    expect(model.advisories.some((a) => a.code === "bar-x-discretized")).toBe(false);
  });

  it("default bins = 30 emits the Hadley-lesson-12 advisory; explicit binwidth silences it", () => {
    const withDefault = runPipeline(
      gg({ x: data.x }, aes({ x: "x" }))
        .geomHistogram()
        .spec(),
      size,
    );
    const advisory = withDefault.advisories.find((a) => a.code === "bin-default-bins");
    expect(advisory).toBeDefined();
    expect(advisory!.chosen).toContain("bins = 30");
    expect(advisory!.howToOverride).toContain("binwidth");

    const explicit = runPipeline(
      gg({ x: data.x }, aes({ x: "x" }))
        .geomHistogram({ binwidth: 2 })
        .spec(),
      size,
    );
    expect(explicit.advisories.some((a) => a.code === "bin-default-bins")).toBe(false);
  });

  it("y = { stat: 'density' } resolves to the density column", () => {
    const model = runPipeline(
      gg({ x: data.x }, aes({ x: "x", y: { stat: "density" } }))
        .geomHistogram({ binwidth: 1, boundary: 0 })
        .spec(),
      size,
    );
    expect(model.scales.y.type).toBe("linear");
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[1]).toBeLessThan(1); // densities, not counts
    }
    expect(model.scene.axes.y.title).toBe("density");
  });

  it("stacked histograms by fill share breaks and stack per bin", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", fill: "g" }))
        .geomHistogram({ binwidth: 2.5, boundary: 0 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.kind).toBe("rects");
    expect(batch.rects.length / 4).toBe(8); // 4 bins x 2 groups (zero bins kept)
    expect(new Set(batch.fills).size).toBe(2);
    expect(model.scene.legends).toHaveLength(1);
  });

  it("mapping aes.y to a field on a histogram is a structured error", () => {
    expect(() =>
      runPipeline(
        {
          data: { columns: { x: [1, 2], y: [1, 2] } },
          layers: [{ geom: "histogram", aes: { x: { field: "x" }, y: { field: "y" } } }],
        },
        size,
      ),
    ).toThrow(PipelineError);
  });

  it("center + boundary together is a structured error", () => {
    expect(() =>
      runPipeline(
        gg({ x: data.x }, aes({ x: "x" }))
          .geomHistogram({ binwidth: 1, center: 0, boundary: 0 })
          .spec(),
        size,
      ),
    ).toThrow(/center OR params.boundary/);
  });

  it("nominal x on the bin stat is a channel-type-mismatch error", () => {
    try {
      runPipeline(
        gg({ x: ["a", "b"] }, aes({ x: "x" }))
          .geomHistogram()
          .spec(),
        size,
      );
      expect.unreachable();
    } catch (error) {
      expect((error as PipelineError).code).toBe("channel-type-mismatch");
    }
  });
});

// ---------------------------------------------------------------------------
// smooth
// ---------------------------------------------------------------------------
