/**
 * M2 pipeline — geom_dotplot / stat_bindot (#803).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { PointsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

describe("dotplot geom (histodot bindot)", () => {
  const data = {
    x: [1, 1, 1, 2, 2, 3],
    g: ["a", "a", "b", "a", "b", "a"],
  };

  it("emits one point per finite observation", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x" }))
        .geomDotplot({ binwidth: 1, boundary: 0.5 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.kind).toBe("points");
    expect(batch.positions.length / 2).toBe(6);
  });

  it("y domain includes zero baseline and stack height", () => {
    const model = runPipeline(
      gg({ x: [1, 1, 1] }, aes({ x: "x" }))
        .geomDotplot({ binwidth: 1, boundary: 0.5, stackdir: "up" })
        .spec(),
      size,
    );
    expect(model.scales.y.type).toBe("linear");
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(0);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(3);
    }
  });

  it("normalize defaults y to stackpos", () => {
    const spec = gg({ x: [1, 2] }, aes({ x: "x" }))
      .geomDotplot({ binwidth: 1 })
      .spec();
    expect(spec.layers[0]!.stat).toBe("bindot");
    expect(spec.layers[0]!.aes?.y).toEqual({ stat: "stackpos" });
  });

  it("rejects mapped aes.y", () => {
    expect(() =>
      runPipeline(
        {
          data: { columns: { x: [1, 2], y: [1, 2] } },
          layers: [
            {
              geom: "dotplot",
              aes: { x: { field: "x" }, y: { field: "y" } },
              params: { binwidth: 1 },
            },
          ],
        },
        size,
      ),
    ).toThrow(PipelineError);
  });

  it("default bins emits advisory", () => {
    const model = runPipeline(
      gg({ x: [0, 1, 2, 3, 4] }, aes({ x: "x" }))
        .geomDotplot()
        .spec(),
      size,
    );
    expect(model.advisories.some((a) => a.code === "bin-default-bins")).toBe(true);
  });

  it("color aesthetic paints per-observation dots", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", color: "g" }))
        .geomDotplot({ binwidth: 1, boundary: 0.5 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.kind).toBe("points");
    const colors = batch.colorPalette ?? batch.colors;
    expect(colors).toBeDefined();
    expect(new Set(colors).size).toBe(2);
  });

  // ggplot2 geom_dotplot groups by fill by default; schema advertises "Map fill/color".
  it("fill aesthetic paints per-observation dots", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", fill: "g" }))
        .geomDotplot({ binwidth: 1, boundary: 0.5 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.kind).toBe("points");
    const colors = batch.colorPalette ?? batch.colors;
    expect(colors).toBeDefined();
    expect(new Set(colors).size).toBe(2);
  });

  it("fill paint wins over color when both are mapped", () => {
    const model = runPipeline(
      gg(
        { x: [1, 1, 2, 2], fillG: ["a", "a", "b", "b"], colorG: ["x", "x", "x", "x"] },
        aes({ x: "x", fill: "fillG", color: "colorG" }),
      )
        .geomDotplot({ binwidth: 1, boundary: 0.5 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.colorPalette ?? batch.colors).toBeDefined();
    // fill has 2 levels; color is constant — paint must follow fill.
    expect(new Set(batch.colorPalette ?? batch.colors).size).toBe(2);
  });

  it("exposes per-dot xValue/yValue for inspect tooltips (hybrid source row + after_stat)", () => {
    // One observation alone at x=1 → stackpos 1; three at x=2 → stackpos 1,2,3.
    // Candidates keep real source rowIndex for aesthetics, but x/y are after_stat.
    const model = runPipeline(
      gg({ x: [1, 2, 2, 2] }, aes({ x: "x" }))
        .geomDotplot({ binwidth: 1, boundary: 0.5, stackdir: "up" })
        .spec(),
      size,
    );
    expect(model.layerFields[0]).toEqual([
      { channel: "x", field: "x", source: "stat" },
      { channel: "y", field: "stackpos", source: "stat" },
    ]);

    const values: { xValue: unknown; yValue: unknown; rowIndex: number | null }[] = [];
    for (let id = 0; model.candidates.candidate(id) !== null; id++) {
      const candidate = model.candidates.candidate(id)!;
      values.push({
        xValue: candidate.xValue,
        yValue: candidate.yValue,
        rowIndex: candidate.rowIndex,
      });
    }
    expect(values).toHaveLength(4);
    // Every dot carries a real source row and non-null position semantics.
    for (const value of values) {
      expect(value.rowIndex).not.toBeNull();
      expect(value.xValue).not.toBeNull();
      expect(value.yValue).not.toBeNull();
    }
    // Stack ranks differ inside the denser bin; x values differ across bins.
    expect(new Set(values.map((v) => v.xValue)).size).toBeGreaterThan(1);
    expect(new Set(values.map((v) => v.yValue)).size).toBeGreaterThan(1);
    // Tallest stack at the denser bin reaches 3 under stackdir=up.
    expect(values.some((v) => v.yValue === 3)).toBe(true);
  });
});
