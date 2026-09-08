/**
 * M2 pipeline — stat manual portable registry (#814).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { PointsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

const data = {
  x: [1, 2, 3, 4],
  y: [10, 20, 30, 40],
  g: ["a", "a", "b", "b"],
};

describe("stat manual (#814)", () => {
  it("mean collapses to one point per group", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", color: "g" }))
        .geomPoint({ stat: "manual", fun: "mean" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.kind).toBe("points");
    expect(batch.positions.length / 2).toBe(2);
    expect(batch.colorPalette ?? batch.colors).toBeDefined();
    expect(new Set(batch.colorPalette ?? batch.colors).size).toBe(2);
  });

  it("first keeps one source row per group", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", color: "g" }))
        .geomPoint({ stat: "manual", fun: "first" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.positions.length / 2).toBe(2);
  });

  it("missing fun fails loud at pipeline bind", () => {
    expect(() =>
      runPipeline(
        {
          data: { columns: data },
          layers: [
            {
              geom: "point",
              stat: "manual",
              aes: { x: { field: "x" }, y: { field: "y" } },
            },
          ],
        },
        size,
      ),
    ).toThrow(PipelineError);
  });

  it("unknown fun fails schema validation before the pipeline", () => {
    expect(() =>
      runPipeline(
        {
          data: { columns: data },
          layers: [
            {
              geom: "point",
              stat: "manual",
              aes: { x: { field: "x" }, y: { field: "y" } },
              params: { fun: "hull" as "mean" },
            },
          ],
        },
        size,
      ),
    ).toThrow(/Invalid plot spec|invalid-enum-value|hull/);
  });

  it("line manual mean works", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", color: "g" }))
        .geomLine({ stat: "manual", fun: "mean" })
        .spec(),
      size,
    );
    expect(model.scene.batches.length).toBeGreaterThanOrEqual(1);
  });
});
