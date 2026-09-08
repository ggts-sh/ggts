/**
 * M2 pipeline — smooth geom.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { scatter, size } from "./fixtures.ts";

describe("smooth geom", () => {
  const data = scatter(60);

  it("emits a ribbon (closed paths, under) then the fitted line", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomPoint()
        .geomSmooth({ method: "lm" })
        .spec(),
      size,
    );
    const smoothBatches = model.scene.batches.filter((b) => b.layerIndex === 1);
    expect(smoothBatches).toHaveLength(2);
    const ribbon = smoothBatches[0] as PathsBatch;
    const line = smoothBatches[1] as PathsBatch;
    expect(ribbon.kind).toBe("paths");
    expect(ribbon.closed).toBe(true);
    expect(ribbon.fills).toBeDefined();
    expect(line.closed).toBeUndefined();
    expect(line.pathOffsets.length - 1).toBe(1);
    expect(line.rowIndex.length).toBe(80); // n = 80 evaluation points
  });

  it("se: false renders the line only", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomSmooth({ method: "lm", se: false })
        .spec(),
      size,
    );
    const batches = model.scene.batches;
    expect(batches).toHaveLength(1);
    expect((batches[0] as PathsBatch).fills).toBeUndefined();
  });

  it("fits per group with per-group line colors (color mapping)", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", color: "g" }))
        .geomSmooth({ method: "lm" })
        .spec(),
      size,
    );
    const line = model.scene.batches[1] as PathsBatch;
    expect(line.pathOffsets.length - 1).toBe(2);
    expect(new Set(line.strokes).size).toBe(2);
    // Ribbon tints follow the line colors.
    const ribbon = model.scene.batches[0] as PathsBatch;
    expect(ribbon.fills).toEqual(line.strokes);
  });

  it("infers the method with an advisory (loess under 1000 rows)", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomSmooth()
        .spec(),
      size,
    );
    const advisory = model.advisories.find((a) => a.code === "smooth-method-inferred");
    expect(advisory).toBeDefined();
    expect(advisory!.chosen).toContain('"loess"');
    expect(advisory!.howToOverride).toContain("params.method");
  });

  it("the se band trains the y scale (ribbon never clips)", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomSmooth({ method: "lm", level: 0.999 })
        .spec(),
      size,
    );
    expect(model.scales.y.type).toBe("linear");
  });

  it("nominal x/y fields are channel-type-mismatch errors", () => {
    try {
      runPipeline(
        gg({ x: ["a", "b", "c"], y: [1, 2, 3] }, aes({ x: "x", y: "y" }))
          .geomSmooth()
          .spec(),
        size,
      );
      expect.unreachable();
    } catch (error) {
      expect((error as PipelineError).code).toBe("channel-type-mismatch");
    }
  });

  it("degenerate groups are dropped with a warning", () => {
    const model = runPipeline(
      gg({ x: [1, 1, 1], y: [1, 2, 3] }, aes({ x: "x", y: "y" }))
        .geomSmooth({ method: "lm" })
        .spec(),
      size,
    );
    expect(model.warnings.some((w) => w.code === "smooth-group-dropped")).toBe(true);
    expect(model.warnings.some((w) => w.code === "empty-layer")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// boxplot
// ---------------------------------------------------------------------------
