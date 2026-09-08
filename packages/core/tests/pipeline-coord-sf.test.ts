/**
 * coord_sf pipeline — fixed-aspect layout for already-projected maps (#809).
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { applyFixedAspectLayout } from "../src/pipeline/panel-layout-fixed.ts";
import type { PipelineError } from "../src/pipeline/types-advisory.ts";

function ratioOf(panel: { width: number; height: number }): number {
  return panel.height / panel.width;
}

function geo(g: object): string {
  return JSON.stringify(g);
}

describe("coord_sf pipeline (#809)", () => {
  it("fits a square data rectangle at ratio 1 for equal projected units", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .coordSf()
        .spec(),
      { width: 640, height: 400 },
    );
    const panel = model.scene.panels[0]!;
    expect(ratioOf(panel)).toBeCloseTo(1, 10);
  });

  it("applies ratio as y-unit length / x-unit length", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .coordSf({ ratio: 2 })
        .spec(),
      { width: 640, height: 640 },
    );
    expect(ratioOf(model.scene.panels[0]!)).toBeCloseTo(2, 10);
  });

  it("works with geom_sf already-projected polygons", () => {
    const poly = geo({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [4, 2],
          [0, 2],
          [0, 0],
        ],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [poly] }, aes({}))
        .geomSf()
        .coordSf({ ratio: 1 })
        .spec(),
      { width: 400, height: 300 },
    );
    expect(model.scene.batches[0]?.kind).toBe("paths");
    // Domain x span 4, y span 2 → unit aspect ratio 1 ⇒ panel h/w ≈ (2/4)*1 = 0.5
    // after equal-unit fitting (y-span/x-span * ratio).
    expect(ratioOf(model.scene.panels[0]!)).toBeCloseTo(0.5, 5);
  });

  it("names coord_sf, not coord_fixed, in shared fixed-aspect layout errors", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .coordSf()
        .spec(),
      { width: 640, height: 400 },
    );
    const panel = model.scene.panels[0]!;
    const scale = (max: number) =>
      ({
        type: "linear" as const,
        transform: "identity" as const,
        domain: [0, max] as const,
        transformedDomain: [0, max] as const,
        range: [0, 1] as const,
      }) as never;

    const run = () =>
      applyFixedAspectLayout({
        placements: [
          {
            x: panel.x,
            y: panel.y,
            width: panel.width,
            height: panel.height,
            ticksH: [],
            ticksV: [],
            showAxisX: true,
            showAxisY: true,
          },
        ],
        // A denormal x-span makes the fitted rectangle non-finite.
        panelScales: [{ x: scale(1e-320), y: scale(1) }],
        coord: { type: "sf", ratio: 1 },
        faceted: false,
        freeX: false,
        freeY: false,
        scalesConfig: {},
        warnings: [],
      });

    expect(run).toThrow(expect.objectContaining({ code: "coord-fixed-invalid-aspect" }));
    try {
      run();
      throw new Error("expected coord_sf aspect failure");
    } catch (error) {
      const problem = (error as PipelineError).diagnostic?.problem ?? "";
      expect(problem).toContain("coord_sf");
      expect(problem).not.toContain("coord_fixed");
    }
  });
});
