/**
 * SVG renderer — panels, clipping, strips
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { sceneToSVGString } from "../../src/render-svg.ts";
import { size, wrapRows, wrapSpec } from "./fixtures.ts";

describe("SVG renderer — panels, clipping, strips", () => {
  it("marks clip to their panel rect (clipPath per panel)", () => {
    const model = runPipeline(wrapSpec(), size);
    const svg = sceneToSVGString(model.scene);
    expect(svg).toContain('clip-path="url(#gg-clip-0)"');
    expect(svg).toContain('clip-path="url(#gg-clip-2)"');
    expect((svg.match(/<clipPath/g) ?? []).length).toBe(3);
    expect(svg).toContain('class="gg-strip"');
    expect(svg).toContain(">a</text>");
  });

  it("single-panel plots clip too (jitter/ribbons under pinned domains)", () => {
    const model = runPipeline(
      gg(wrapRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
      size,
    );
    const svg = sceneToSVGString(model.scene);
    expect((svg.match(/<clipPath/g) ?? []).length).toBe(1);
    expect(svg).not.toContain("gg-strip");
  });
});
