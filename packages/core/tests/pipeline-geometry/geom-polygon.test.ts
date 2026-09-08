/**
 * Pipeline geometry — geom_polygon closed filled paths in data order.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";

const size = { width: 400, height: 300 };

function pathBatch(model: ReturnType<typeof runPipeline>): PathsBatch {
  const batch = model.scene.batches[0] as PathsBatch;
  expect(batch.kind).toBe("paths");
  return batch;
}

describe("geom_polygon", () => {
  it("emits a closed PathsBatch with fills and preserves data (not x) order", () => {
    // Vertices intentionally non-monotonic in x: 1 → 0 → 0.5
    const model = runPipeline(
      gg({ x: [1, 0, 0.5], y: [0, 0, 1] }, aes({ x: "x", y: "y" }))
        .geomPolygon({ alpha: 0.8 })
        .spec(),
      size,
    );
    const batch = pathBatch(model);
    expect(batch.closed).toBe(true);
    expect(batch.fills).toBeDefined();
    expect(batch.pathOffsets.length).toBe(2); // one subpath
    expect(batch.pathOffsets[0]).toBe(0);
    expect(batch.pathOffsets[1]).toBe(3);

    // First vertex should be x=1 (right side), not x=0 after x-sort
    const x0 = batch.positions[0]!;
    const x1 = batch.positions[2]!;
    const x2 = batch.positions[4]!;
    // Panel x increases with data x: first vertex (x=1) has largest pixel x
    expect(x0).toBeGreaterThan(x1);
    expect(x0).toBeGreaterThan(x2);
  });

  it("emits one closed subpath per group with distinct fills", () => {
    const model = runPipeline(
      gg(
        {
          x: [0, 1, 0.5, 2, 3, 2.5],
          y: [0, 0, 1, 0, 0, 1],
          id: ["a", "a", "a", "b", "b", "b"],
        },
        aes({ x: "x", y: "y", group: "id", fill: "id" }),
      )
        .geomPolygon()
        .spec(),
      size,
    );
    const batch = pathBatch(model);
    expect(batch.pathOffsets.length - 1).toBe(2);
    expect(batch.fills?.length).toBe(2);
    expect(batch.fills![0]).not.toBe(batch.fills![1]);
  });

  it("maps color to strokes and fill to fills", () => {
    const model = runPipeline(
      gg(
        {
          x: [0, 1, 0.5],
          y: [0, 0, 1],
          region: ["north", "north", "north"],
        },
        aes({ x: "x", y: "y", fill: "region", color: "region" }),
      )
        .geomPolygon({ linewidth: 2 })
        .spec(),
      size,
    );
    const batch = pathBatch(model);
    expect(batch.fills?.[0]).toBeTruthy();
    expect(batch.strokes[0]).toBeTruthy();
    expect(batch.linewidth).toBe(2);
  });

  it("uses exact auto hit mode for region selection", () => {
    const model = runPipeline(
      gg({ x: [0, 1, 0.5], y: [0, 0, 1] }, aes({ x: "x", y: "y" }))
        .geomPolygon()
        .spec(),
      size,
    );
    expect(model.candidates.candidate(0)?.autoMode).toBe("exact");
  });

  it("trains domains from vertex extents (no zero baseline invent)", () => {
    const model = runPipeline(
      gg({ x: [2, 4, 3], y: [5, 5, 8] }, aes({ x: "x", y: "y" }))
        .geomPolygon()
        .spec(),
      size,
    );
    if (model.scales.x.type !== "band") {
      // Default expansion may pad slightly outside [2,4]; vertices still train the domain.
      expect(model.scales.x.domain[0]).toBeLessThanOrEqual(2);
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(4);
    }
    if (model.scales.y.type !== "band") {
      // No forced zero for polygon (unlike bar/area)
      expect(model.scales.y.domain[0]).toBeGreaterThan(0);
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(5);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(8);
    }
  });

  it("drops singleton groups (need ≥2 finite vertices)", () => {
    const model = runPipeline(
      gg(
        {
          x: [0, 1, 0.5, 9],
          y: [0, 0, 1, 9],
          id: ["tri", "tri", "tri", "lonely"],
        },
        aes({ x: "x", y: "y", group: "id" }),
      )
        .geomPolygon()
        .spec(),
      size,
    );
    const batch = pathBatch(model);
    expect(batch.pathOffsets.length - 1).toBe(1);
    expect(batch.pathOffsets[1]).toBe(3);
  });
});
