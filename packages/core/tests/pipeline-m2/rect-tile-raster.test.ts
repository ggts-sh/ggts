/**
 * geom rect / tile / raster — geometry, scales, diagnostics (#586).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import { renderToSVGString } from "../../src/render-svg-full.ts";
import type { RectsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

describe("geom rect", () => {
  it("emits one rect per row from xmin/xmax/ymin/ymax and trains domain on edges", () => {
    const model = runPipeline(
      gg(
        { xmin: [0, 2], xmax: [1, 4], ymin: [0, 1], ymax: [2, 3] },
        aes({ xmin: "xmin", xmax: "xmax", ymin: "ymin", ymax: "ymax" }),
      )
        .geomRect()
        .scales({ x: { nice: false }, y: { nice: false } })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.kind).toBe("rects");
    expect(batch.rects.length / 4).toBe(2);
    expect(batch.anchor).toBe("center");
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[0]).toBeLessThanOrEqual(0);
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(4);
    }
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(0);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(3);
    }
    // No y-zero force for rect.
    expect(model.advisories.some((a) => a.code === "zero-forced")).toBe(false);
  });

  it("maps color to per-rect strokes", () => {
    const model = runPipeline(
      gg(
        {
          xmin: [0, 1],
          xmax: [0.5, 1.5],
          ymin: [0, 0],
          ymax: [1, 1],
          g: ["a", "b"],
        },
        aes({
          xmin: "xmin",
          xmax: "xmax",
          ymin: "ymin",
          ymax: "ymax",
          color: "g",
        }),
      )
        .geomRect({ linewidth: 2 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.strokes).toHaveLength(2);
    expect(new Set(batch.strokes).size).toBe(2);
    expect(batch.strokeWidth).toBe(2);
  });

  it("coord flip emits finite flipped rect geometry", () => {
    const model = runPipeline(
      gg(
        { xmin: [0], xmax: [2], ymin: [0], ymax: [1] },
        aes({ xmin: "xmin", xmax: "xmax", ymin: "ymin", ymax: "ymax" }),
      )
        .geomRect()
        .coordFlip()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.rects.length / 4).toBe(1);
    for (let i = 0; i < 4; i++) expect(Number.isFinite(batch.rects[i]!)).toBe(true);
    expect(batch.rects[2]!).toBeGreaterThan(0);
    expect(batch.rects[3]!).toBeGreaterThan(0);
  });
});

describe("geom tile", () => {
  it("continuous centers + default resolution produce abutting cells", () => {
    const model = runPipeline(
      gg({ x: [0, 1, 2], y: [0, 0, 0], z: [1, 2, 3] }, aes({ x: "x", y: "y", fill: "z" }))
        .geomTile()
        .scales({ x: { nice: false }, y: { nice: false } })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.kind).toBe("rects");
    expect(batch.rects.length / 4).toBe(3);
    expect(batch.fills).toHaveLength(3);
    // Adjacent tiles share an edge (default width = resolution = 1).
    const right0 = batch.rects[0]! + batch.rects[2]!;
    expect(right0).toBeCloseTo(batch.rects[4]!, 3);
  });

  it("categorical heatmap trains band scales and draws one cell per category pair", () => {
    const model = runPipeline(
      gg(
        {
          x: ["a", "a", "b", "b"],
          y: ["low", "high", "low", "high"],
          z: [1, 2, 3, 4],
        },
        aes({ x: "x", y: "y", fill: "z" }),
      )
        .geomTile()
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("band");
    expect(model.scales.y.type).toBe("band");
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.rects.length / 4).toBe(4);
  });

  it("sizes continuous tiles from the minimum positive gap on both axes", () => {
    // Heatmap shape: continuous x and y, no width/height given, so each axis
    // falls back to resolution(). Duplicated values must not shrink the gap.
    const model = runPipeline(
      gg(
        { x: [0, 2, 4, 0, 2, 4], y: [0, 0, 0, 5, 5, 5], z: [1, 2, 3, 4, 5, 6] },
        aes({ x: "x", y: "y", fill: "z" }),
      )
        .geomTile()
        .scales({
          x: { type: "linear", domain: [-2, 6], expand: { mult: 0, add: 0 }, nice: false },
          y: { type: "linear", domain: [-5, 10], expand: { mult: 0, add: 0 }, nice: false },
        })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.rects.length / 4).toBe(6);
    const widths: number[] = [];
    const heights: number[] = [];
    for (let i = 0; i < batch.rects.length; i += 4) {
      widths.push(batch.rects[i + 2]!);
      heights.push(batch.rects[i + 3]!);
    }
    expect(widths.every((w) => Math.abs(w - widths[0]!) < 1e-6)).toBe(true);
    expect(heights.every((h) => Math.abs(h - heights[0]!) < 1e-6)).toBe(true);
    // Measure against the panel, not the plot: axis and legend margins are not
    // ours to predict. x gap 2 of an 8-unit domain, y gap 5 of a 15-unit one.
    const panel = model.scene.panels[0]!;
    expect(widths[0]! / panel.width).toBeCloseTo(2 / 8, 6);
    expect(heights[0]! / panel.height).toBeCloseTo(5 / 15, 6);
  });

  it("applies width after log transform (params.width is transformed-space span)", () => {
    const model = runPipeline(
      gg({ x: [1, 10, 100], y: [1, 1, 1] }, aes({ x: "x", y: "y" }))
        .geomTile({ width: 0.5, height: 0.5 })
        .scales({ x: { type: "linear", transform: "log10", nice: false }, y: { nice: false } })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.rects.length / 4).toBe(3);
    // Equal width in transformed space → equal pixel widths under a linear panel map.
    const w0 = batch.rects[2]!;
    const w1 = batch.rects[6]!;
    expect(w0).toBeCloseTo(w1, 3);
  });

  it("rejects non-positive mapped width", () => {
    expect(() =>
      runPipeline(
        gg({ x: [1], y: [1], w: [0] }, aes({ x: "x", y: "y", width: "w" }))
          .geomTile()
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
  });

  it("infers a time x scale from temporal tile centers with synthetic edges", () => {
    const model = runPipeline(
      gg(
        {
          day: ["2024-01-01", "2024-01-02", "2024-01-03"],
          band: ["a", "b", "c"],
          z: [1, 2, 3],
        },
        aes({ x: "day", y: "band", fill: "z" }),
      )
        .geomTile()
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
  });

  it("ignores inherited xmin/xmax for tile x-scale type (uses center x)", () => {
    // Plot-level endpoint aes intended for rect/ribbon must not force a band
    // x scale on tile when the layer maps continuous centers.
    const model = runPipeline(
      gg(
        {
          cat: ["a", "b"],
          y0: [0, 0],
          y1: [1, 1],
          x: [0, 1],
          y: [0, 1],
          z: [1, 2],
        },
        aes({ xmin: "cat", xmax: "cat", ymin: "y0", ymax: "y1" }),
      )
        .geomTile({ aes: { x: "x", y: "y", fill: "z" } })
        .scales({ x: { nice: false }, y: { nice: false } })
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("linear");
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.kind).toBe("rects");
    expect(batch.rects.length / 4).toBe(2);
  });

  it("clears inherited ymin/ymax when tile y is categorical", () => {
    const model = runPipeline(
      gg(
        {
          x: [0, 1, 2],
          y: ["a", "b", "c"],
          ymin: [0, 0, 0],
          ymax: [1, 1, 1],
          z: [1, 2, 3],
        },
        aes({ x: "x", y: "y", ymin: "ymin", ymax: "ymax", fill: "z" }),
      )
        .geomTile()
        .spec(),
      size,
    );
    expect(model.scales.y.type).toBe("band");
    expect(model.scales.y.domain).toEqual(["a", "b", "c"]);
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.kind).toBe("rects");
    expect(batch.rects.length / 4).toBe(3);
  });
});

describe("geom raster", () => {
  it("draws equal cells on a regular grid without stroke", () => {
    const spec = gg(
      {
        x: [0, 1, 0, 1],
        y: [0, 0, 1, 1],
        z: [1, 2, 3, 4],
      },
      aes({ x: "x", y: "y", fill: "z" }),
    )
      .geomRaster()
      .scales({ x: { nice: false }, y: { nice: false } })
      .spec();
    const model = runPipeline(spec, size);
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.kind).toBe("rects");
    expect(batch.rects.length / 4).toBe(4);
    expect(batch.stroke).toBeUndefined();
    expect(batch.strokes).toBeUndefined();
    const svg = renderToSVGString(spec, size);
    expect(svg.match(/<rect /g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("errors on duplicate (x,y) cells", () => {
    expect(() =>
      runPipeline(
        gg({ x: [0, 0], y: [0, 0], z: [1, 2] }, aes({ x: "x", y: "y", fill: "z" }))
          .geomRaster()
          .spec(),
        size,
      ),
    ).toThrow(/raster-duplicate|duplicate/i);
  });

  it("warns on irregular spacing and still draws", () => {
    const model = runPipeline(
      gg({ x: [0, 1, 3], y: [0, 0, 0], z: [1, 2, 3] }, aes({ x: "x", y: "y", fill: "z" }))
        .geomRaster()
        .spec(),
      size,
    );
    expect(model.warnings.some((w) => w.code === "raster-irregular-spacing")).toBe(true);
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.rects.length / 4).toBe(3);
  });
});
