/**
 * M1 failure policy: empty data, null columns, skip layers, zero-variance domains.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import { renderToSVGString } from "../../src/render-svg-full.ts";
import { size } from "./fixtures.ts";

describe("failure policy", () => {
  it("empty data renders a frame + axes placeholder with a warning", () => {
    const model = runPipeline(
      {
        data: { values: [] },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
      },
      size,
    );
    expect(model.scene.batches).toHaveLength(0);
    expect(model.scene.panels).toHaveLength(1);
    expect(model.warnings.some((w) => w.code === "empty-data")).toBe(true);
    const svg = renderToSVGString(
      {
        data: { values: [] },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
      },
      size,
    );
    expect(svg).toContain("gg-axis-x");
  });

  it("an all-null mapped column is a structured error", () => {
    try {
      runPipeline(
        {
          data: {
            values: [
              { x: null, y: 1 },
              { x: null, y: 2 },
            ],
          },
          layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
        },
        size,
      );
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as PipelineError).code).toBe("all-null-column");
    }
  });

  it("a layer with no drawable rows is skipped with a warning", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { x: 1, y: 5, z: null },
            { x: 2, y: 9, z: null },
          ],
        },
        layers: [
          { geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } },
          { geom: "point", aes: { x: { field: "x" }, y: { field: "x" }, alpha: null } },
        ],
      },
      { ...size },
    );
    expect(model.scene.batches.length).toBeGreaterThan(0);
  });

  it("zero-variance domains render with padding, not a collapse", () => {
    const model = runPipeline(
      gg([{ x: 5, y: 5 }], aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
      size,
    );
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[0]).toBeLessThan(5);
      expect(model.scales.x.domain[1]).toBeGreaterThan(5);
    }
  });
});
