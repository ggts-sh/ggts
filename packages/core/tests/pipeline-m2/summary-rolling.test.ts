/**
 * M2 pipeline — line/point + stat summary_rolling.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch, PointsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

describe("line + stat summary_rolling", () => {
  it("emits one vertex per unique x with the rolling summary as y", () => {
    const model = runPipeline(
      gg({ x: [1, 2, 3, 4, 5], y: [10, 20, 30, 40, 50] }, aes({ x: "x", y: "y" }))
        .geomLine({ stat: "summary_rolling", window: 2, fun: "mean" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.pathOffsets.length - 1).toBe(1);
    expect(batch.positions.length / 2).toBe(5);
    // Rolling means 15..45 must fit the y scale domain.
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(15);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(45);
    }
    // y stays a mapped measure channel (unlike ecdf) — the axis keeps its title.
    expect(model.scene.axes.y.title).toBe("y");
  });

  it("summarizes per group without crossing group boundaries", () => {
    const model = runPipeline(
      gg(
        {
          x: [1, 2, 3, 1, 2, 3],
          y: [10, 20, 30, 100, 200, 300],
          g: ["a", "a", "a", "b", "b", "b"],
        },
        aes({ x: "x", y: "y", color: "g" }),
      )
        .geomLine({ stat: "summary_rolling", window: 2, fun: "mean" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.pathOffsets.length - 1).toBe(2);
  });

  it("works on point layers (one summarized point per unique x)", () => {
    const model = runPipeline(
      gg({ x: [1, 2, 2, 3], y: [10, 20, 40, 60] }, aes({ x: "x", y: "y" }))
        .geomPoint({ stat: "summary_rolling", window: 2, fun: "median" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.kind).toBe("points");
    expect(batch.positions.length / 2).toBe(3);
  });

  it("fails loudly when window is omitted", () => {
    expect(() =>
      runPipeline(
        gg({ x: [1, 2, 3], y: [1, 2, 3] }, aes({ x: "x", y: "y" }))
          .geomLine({ stat: "summary_rolling" })
          .spec(),
        size,
      ),
    ).toThrow(/window/);
  });
});
