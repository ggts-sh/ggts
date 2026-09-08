/**
 * M2 pipeline — freqpoly (canonicalized to line + stat bin) (#796).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { scatter, size } from "./fixtures.ts";

describe("freqpoly geom (canonicalized to line + stat bin) (#796)", () => {
  const data = scatter(200);

  it("emits a path through bin centers on a continuous x scale", () => {
    const model = runPipeline(
      gg({ x: data.x }, aes({ x: "x" }))
        .geomFreqpoly({ binwidth: 1, boundary: 0 })
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("linear");
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    // 10 bins over (0, 10) with binwidth 1 → 10 vertices in one polyline.
    expect(batch.positions.length / 2).toBe(10);
    // Source rows for bin-stat marks are NO_ROW (no single source row).
    for (let i = 0; i < batch.rowIndex.length; i++) {
      expect(batch.rowIndex[i]).toBe(0xffffffff);
    }
  });

  it("default bins = 30 emits the bin-default-bins advisory; explicit binwidth silences it", () => {
    const withDefault = runPipeline(
      gg({ x: data.x }, aes({ x: "x" }))
        .geomFreqpoly()
        .spec(),
      size,
    );
    const advisory = withDefault.advisories.find((a) => a.code === "bin-default-bins");
    expect(advisory).toBeDefined();
    expect(advisory!.chosen).toContain("bins = 30");

    const explicit = runPipeline(
      gg({ x: data.x }, aes({ x: "x" }))
        .geomFreqpoly({ binwidth: 2 })
        .spec(),
      size,
    );
    expect(explicit.advisories.some((a) => a.code === "bin-default-bins")).toBe(false);
  });

  it("y = { stat: 'density' } resolves to the density column", () => {
    const model = runPipeline(
      gg({ x: data.x }, aes({ x: "x", y: { stat: "density" } }))
        .geomFreqpoly({ binwidth: 1, boundary: 0 })
        .spec(),
      size,
    );
    expect(model.scales.y.type).toBe("linear");
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[1]).toBeLessThan(1);
    }
  });

  it("colored freqpoly draws one path series per group", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", color: "g" }))
        .geomFreqpoly({ binwidth: 2.5, boundary: 0 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    // Two groups → two subpaths (or stroke colors); at least two series.
    expect(new Set(batch.strokes).size).toBe(2);
  });
});
