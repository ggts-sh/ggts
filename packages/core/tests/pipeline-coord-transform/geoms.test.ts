import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import { sceneToSVGString } from "../../src/render-svg-scene.ts";
import { size } from "./fixtures.ts";

describe("pipeline post-stat coord_transform — geoms", () => {
  it("projects continuous rectangle edges instead of reusing linear pixel widths", () => {
    const model = runPipeline(
      gg(
        [
          { x: 100, y: 1 },
          { x: 200, y: 2 },
          { x: 400, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomCol()
        .scales({ x: { type: "linear", domain: [50, 450], expand: { mult: 0, add: 0 } } })
        .coordTransform({ x: { transform: "log10", expand: false } })
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((candidate) => candidate.kind === "rects");
    const scale = model.scales.x;
    if (batch?.kind !== "rects" || scale.type === "band")
      throw new Error("expected continuous rects");
    const panel = model.scene.panels[0]!;
    const projector = model.coordProjectors[0]!.x;
    const edge = (value: number) =>
      projector.projectFraction(scale.normalizeTransformed(value)) * panel.width;
    const expectedLeft = Math.min(edge(55), edge(145));
    const expectedRight = Math.max(edge(55), edge(145));
    expect(batch.rects[0]).toBeCloseTo(expectedLeft, 4);
    expect(batch.rects[0]! + batch.rects[2]!).toBeCloseTo(expectedRight, 4);
    expect(batch.rects[2]).not.toBeCloseTo(batch.rects[6]!, 4);
  });
  it("projects both continuous errorbar cap endpoints", () => {
    const model = runPipeline(
      gg(
        {
          x: [100, 200, 400],
          lo: [1, 2, 3],
          hi: [2, 3, 4],
        },
        aes({ x: "x", ymin: "lo", ymax: "hi" }),
      )
        .geomErrorbar()
        .scales({ x: { type: "linear", domain: [50, 450], expand: { mult: 0, add: 0 } } })
        .coordTransform({ x: { transform: "log10", expand: false } })
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((candidate) => candidate.kind === "segments");
    const scale = model.scales.x;
    if (batch?.kind !== "segments" || scale.type === "band")
      throw new Error("expected continuous errorbars");
    const panel = model.scene.panels[0]!;
    const projector = model.coordProjectors[0]!.x;
    const edge = (value: number) =>
      projector.projectFraction(scale.normalizeTransformed(value)) * panel.width;
    expect(batch.segments[4]).toBeCloseTo(edge(55), 4);
    expect(batch.segments[6]).toBeCloseTo(edge(145), 4);
  });
  it("keeps projected rects finite and honors clip: false in SVG", () => {
    const model = runPipeline(
      gg(
        [
          { x: 10, y: 10 },
          { x: 100, y: 20 },
        ],
        aes({ x: "x" }),
      )
        .geomHistogram({ binwidth: 20, boundary: 1 })
        .coordTransform({ x: "log10", clip: false })
        .spec(),
      size,
    );
    const rects = model.scene.batches.find((batch) => batch.kind === "rects");
    if (rects?.kind !== "rects") throw new Error("expected rects");
    expect([...rects.rects].every((value) => Number.isFinite(value))).toBe(true);
    expect(model.scene.panels[0]?.clip).toBe(false);
    expect(sceneToSVGString(model.scene)).not.toContain('class="gg-marks" clip-path=');
  });
});
