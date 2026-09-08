/**
 * M2 pipeline — geom/stat quantile (#805).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { size } from "./fixtures.ts";

describe("geom quantile (#805)", () => {
  it("draws one path series per default quantile (3)", () => {
    const model = runPipeline(
      gg(
        {
          x: [0, 1, 2, 3, 4, 5, 6, 7],
          y: [1, 3, 5, 7, 9, 11, 13, 15],
        },
        aes({ x: "x", y: "y" }),
      )
        .geomQuantile()
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "paths");
    expect(batch).toBeDefined();
    if (batch?.kind !== "paths") throw new Error("expected paths");
    // 3 quantiles → 3 subpaths
    expect(batch.pathOffsets.length).toBe(4); // nPaths+1 offsets
    expect(batch.pathOffsets.length - 1).toBe(3);
  });

  it("respects a single quantile param", () => {
    const model = runPipeline(
      gg(
        {
          x: [0, 1, 2, 3, 4],
          y: [0, 1, 2, 3, 4],
        },
        aes({ x: "x", y: "y" }),
      )
        .geomQuantile({ quantiles: [0.5], n: 2 })
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "paths");
    expect(batch).toBeDefined();
    if (batch?.kind !== "paths") throw new Error("expected paths");
    expect(batch.pathOffsets.length - 1).toBe(1);
    expect(batch.positions.length / 2).toBe(2);
  });

  it("rejects quantiles outside (0,1) at schema validation", () => {
    expect(() =>
      runPipeline(
        {
          data: { x: [0, 1], y: [0, 1] },
          mapping: { x: "x", y: "y" },
          layers: [{ geom: "quantile", params: { quantiles: [0, 0.5] } }],
        },
        size,
      ),
    ).toThrow();
  });
});
