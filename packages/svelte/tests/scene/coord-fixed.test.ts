import { describe, expect, it } from "vitest";

import { runPipeline } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

import {
  coord_equal,
  coord_fixed,
  coord_sf,
  coordEqual,
  coordFixed,
  coordSf,
} from "../../src/lib/index.js";
import SceneView from "../../src/lib/scene/SceneView.svelte";
import { render } from "../helpers/render.js";

const rows = [
  { x: 0, y: 0 },
  { x: 10, y: 10 },
];

describe("fixed-aspect scene", () => {
  it("re-exports camelCase and ggplot2 coordinate helpers from the Svelte package", () => {
    expect(coord_fixed).toBe(coordFixed);
    expect(coord_equal).toBe(coordEqual);
    expect(coordEqual).toBe(coordFixed);
    expect(coordFixed({ ratio: 2 })).toEqual({ type: "fixed", ratio: 2 });
  });

  it("re-exports the simple-features coordinate helper as a value, not only its types", () => {
    expect(coord_sf).toBe(coordSf);
    expect(coordSf()).toEqual({ type: "sf" });
    expect(coordSf({ ratio: 2 })).toEqual({ type: "sf", ratio: 2 });
  });

  it("renders the theme-owned allocation behind only the fitted data rectangle", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .coordFixed()
        .theme({ letterboxFill: "#123456" })
        .spec(),
      { width: 640, height: 400 },
    );
    const panel = model.scene.panels[0];
    if (panel === undefined) throw new Error("expected fixed-aspect panel");
    const allocation = panel.allocation;
    if (allocation === undefined) throw new Error("expected fixed-aspect allocation");
    const { container } = render(SceneView, { scene: model.scene });
    const letterboxes = [...container.querySelectorAll("rect.gg-letterbox")];
    const panelBackground = container.querySelector("rect.gg-panel-background");
    expect(letterboxes.length).toBeGreaterThan(0);
    for (const letterbox of letterboxes) {
      expect(letterbox.getAttribute("fill")).toContain("#123456");
      const x = Number(letterbox.getAttribute("x"));
      const y = Number(letterbox.getAttribute("y"));
      const width = Number(letterbox.getAttribute("width"));
      const height = Number(letterbox.getAttribute("height"));
      // Gutters must not cover the fitted data rectangle interior.
      const fullyCoversPanel =
        x <= panel.x &&
        y <= panel.y &&
        x + width >= panel.x + panel.width &&
        y + height >= panel.y + panel.height;
      expect(fullyCoversPanel).toBe(false);
      expect(x).toBeGreaterThanOrEqual(allocation.x - 1e-9);
      expect(y).toBeGreaterThanOrEqual(allocation.y - 1e-9);
    }
    expect(panelBackground?.getAttribute("width")).toBe(String(panel.width));
    model.dispose();
  });

  it("publishes the degraded state and suppresses minor grid furniture", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scaleXContinuous({ minorBreaks: [2.5, 7.5] })
        .coordFixed({ ratio: 100 })
        .spec(),
      { width: 320, height: 240 },
    );
    const { container } = render(SceneView, { scene: model.scene });
    expect(container.querySelector<SVGSVGElement>("svg")?.dataset.ggLayout).toBe("degraded");
    expect(container.querySelector(".gg-grid-minor")).toBeNull();
    model.dispose();
  });
});
