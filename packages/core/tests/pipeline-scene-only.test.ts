import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { runScene } from "../src/pipeline/run-scene.ts";
import { sceneToSVGString } from "../src/render-svg-scene.ts";

const size = { width: 420, height: 320 };

function expectSceneParity(
  spec: Parameters<typeof runScene>[0],
  options: Parameters<typeof runScene>[1] = size,
): void {
  const full = runPipeline(spec, options).scene;
  const lean = runScene(spec, options);
  expect(sceneToSVGString(lean)).toBe(sceneToSVGString(full));
}

describe("scene-only pipeline", () => {
  it("matches full-model scenes for facets and free scales", () => {
    const spec = gg(
      [
        { x: 1, y: 10, panel: "a", cls: "one" },
        { x: 2, y: 20, panel: "a", cls: "two" },
        { x: 100, y: 2, panel: "b", cls: "one" },
        { x: 200, y: 4, panel: "b", cls: "two" },
      ],
      aes({ x: "x", y: "y", color: "cls" }),
    )
      .geomPoint()
      .facet({ wrap: "panel", scales: "free" })
      .spec();

    expectSceneParity(spec);
  });

  it("matches full-model scenes for radial coordinates", () => {
    const spec = gg(
      [
        { pie: "all", category: "a", value: 1 },
        { pie: "all", category: "b", value: 2 },
        { pie: "all", category: "c", value: 3 },
      ],
      aes({ x: "pie", y: "value", fill: "category" }),
    )
      .geomCol({ width: 1, position: "stack" })
      .coordRadial({ theta: "y", expand: false })
      .spec();

    expectSceneParity(spec, { width: 400, height: 400 });
  });

  it("matches full-model scenes through the uncensored baseline pass", () => {
    const spec = gg(
      [
        { x: 1, y: 1 },
        { x: 2, y: 4 },
        { x: 3, y: 9 },
      ],
      aes({ x: "x", y: "y" }),
    )
      .geomPoint()
      .scales({ x: { domain: [1.5, 2.5] } })
      .spec();

    expectSceneParity(spec, {
      ...size,
      baselineScales: { x: {} },
    });
  });
});
