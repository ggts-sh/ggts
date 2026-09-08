/**
 * geom_abline annotation path (#790).
 */
import { aes, gg } from "@ggts-sh/spec";
import { describe, expect, it } from "bun:test";

import { runPipeline } from "../src/pipeline.ts";
import { renderToSVGString } from "../src/render-svg-full.ts";

const size = { width: 400, height: 300 };
const rows = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
  { x: 2, y: 1.5 },
];

describe("geom_abline (#790)", () => {
  it("accepts annotation slope/intercept via builder sugar", () => {
    const spec = gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .geomAbline({ slope: 1, intercept: 0, linewidth: 1.5 })
      .spec();
    expect(spec.layers.some((l) => l.geom === "abline")).toBe(true);
    const ab = spec.layers.find((l) => l.geom === "abline")!;
    expect(ab.params).toMatchObject({ slope: 1, intercept: 0, linewidth: 1.5 });
  });

  it("emits a segments batch for identity line", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .geomAbline({ slope: 1, intercept: 0 })
        .spec(),
      size,
    );
    const segs = model.scene.batches.filter((b) => b.kind === "segments");
    expect(segs.length).toBeGreaterThanOrEqual(1);
    const ab = segs.find((b) => b.layerIndex === 1);
    expect(ab).toBeDefined();
    expect(ab!.segments.length).toBe(4);
  });

  it("ascends left-to-right in screen space for a positive slope", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .geomAbline({ slope: 1, intercept: 0 })
        .spec(),
      size,
    );
    const ab = model.scene.batches
      .filter((b) => b.kind === "segments")
      .find((b) => b.layerIndex === 1)!;
    const [x0, y0, x1, y1] = ab.segments;
    // Screen y grows downward, so a positive data slope must render with the
    // right-hand endpoint ABOVE the left-hand one.
    const [left, right] = x0! <= x1! ? [y0!, y1!] : [y1!, y0!];
    expect(right).toBeLessThan(left);
  });

  it("does not warn that the annotation layer was skipped", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .geomAbline({ slope: 1, intercept: 0 })
        .spec(),
      size,
    );
    // Abline is annotation-only, so every panel frame is rowless by design —
    // that must not read as "no drawable rows; skipping it" when it renders.
    expect(model.warnings.filter((w) => w.code === "empty-layer")).toEqual([]);
  });

  it("renders a stroke line in SVG", () => {
    const svg = renderToSVGString(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .geomAbline({ slope: 0.5, intercept: 0.2 })
        .spec(),
      size,
    );
    expect(svg).toMatch(/<line |gg-segment|gg-segments|stroke=/);
  });
});
