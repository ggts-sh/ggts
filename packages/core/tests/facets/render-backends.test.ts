/**
 * render backends (auto threshold, hints, a11y)
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { renderToSVGString } from "../../src/render-svg-full.ts";
import { size } from "./fixtures.ts";

describe("render backends (auto threshold, hints, a11y)", () => {
  const manyRows = Array.from({ length: 30 }, (_, i) => ({ x: i, y: i * 2 }));

  it("auto resolves to svg below the threshold, canvas above (advisory)", () => {
    const below = runPipeline(
      gg(manyRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
      size,
    );
    expect(below.layerBackends).toEqual(["svg"]);
    expect(below.advisories.some((a) => a.code === "canvas-auto")).toBe(false);

    const above = runPipeline(
      gg(manyRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
      {
        ...size,
        canvasThreshold: 10,
      },
    );
    expect(above.layerBackends).toEqual(["canvas"]);
    const advisory = above.advisories.find((a) => a.code === "canvas-auto");
    expect(advisory).toBeDefined();
    expect(advisory!.path).toBe("layers.0");
    expect(advisory!.howToOverride).toContain("render");
  });

  it("explicit render hints win without advisories", () => {
    const model = runPipeline(
      gg(manyRows, aes({ x: "x", y: "y" }))
        .geomPoint({ render: "canvas" })
        .geomLine({ render: "svg" })
        .spec(),
      { ...size, canvasThreshold: 1 },
    );
    expect(model.layerBackends).toEqual(["canvas", "svg"]);
    expect(model.advisories.some((a) => a.code === "canvas-auto")).toBe(false);
  });

  it('a11y: "force-svg" overrides hints and thresholds', () => {
    const model = runPipeline(
      gg(manyRows, aes({ x: "x", y: "y" }))
        .geomPoint({ render: "canvas" })
        .a11y("force-svg")
        .spec(),
      { ...size, canvasThreshold: 1 },
    );
    expect(model.layerBackends).toEqual(["svg"]);
  });

  it("renderToSVGString is unaffected by render hints (always all-SVG)", () => {
    const svg = renderToSVGString(
      gg(manyRows, aes({ x: "x", y: "y" })).geomPoint({ render: "canvas" }),
      { width: 640 },
    );
    expect(svg).toContain("<circle");
  });
});
