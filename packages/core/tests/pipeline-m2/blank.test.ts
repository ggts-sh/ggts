/**
 * M2 pipeline — geom blank (#791): trains scales, emits no marks / candidates.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { size } from "./fixtures.ts";

describe("blank geom (#791)", () => {
  it("trains scales from a blank-only layer with no geometry batches", () => {
    const model = runPipeline(
      gg({ x: [0, 10], y: [1, 5] }, aes({ x: "x", y: "y" }))
        .geomBlank()
        .spec(),
      size,
    );
    expect(model.scene.batches).toEqual([]);
    expect(model.candidates.size).toBe(0);
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[0]).toBeLessThanOrEqual(0);
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(10);
    }
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(1);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(5);
    }
  });

  it("expands domain beyond co-layered points", () => {
    const model = runPipeline(
      gg(
        {
          x: [0, 1],
          y: [0, 1],
          x2: [0, 100],
          y2: [0, 50],
        },
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .geomBlank({ aes: aes({ x: "x2", y: "y2" }) })
        .spec(),
      size,
    );
    expect(model.scene.batches.some((b) => b.kind === "points")).toBe(true);
    // Blank layer must not add a second mark batch for its rows.
    const blankBatches = model.scene.batches.filter((b) => b.layerIndex === 1);
    expect(blankBatches).toEqual([]);
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(100);
    }
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(50);
    }
  });

  it("accepts blank with no mapped channels (noop layer)", () => {
    const model = runPipeline(
      gg({ x: [1], y: [2] }, aes({ x: "x", y: "y" }))
        .geomPoint()
        .geomBlank()
        .spec(),
      size,
    );
    // Plot aes is inherited by blank, which trains the same domain as points.
    expect(model.scene.batches.some((b) => b.kind === "points")).toBe(true);
    const blankBatches = model.scene.batches.filter((b) => b.layerIndex === 1);
    expect(blankBatches).toEqual([]);
  });
});
