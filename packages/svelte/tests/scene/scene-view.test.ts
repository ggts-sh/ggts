/**
 * SceneView ARIA surface (role / aria-label / aria-hidden by mode).
 * Axis has no aria of its own — role/label live on the SVG root here.
 * Focus-mask projection maps full-scene masks onto mark batch subsets by
 * identity (shared with resolveBatchFocusMasks).
 */
import { describe, expect, it } from "vitest";

import type { BatchInteractionMask, Scene } from "@ggts-sh/core";
import { sceneLabel } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

import SceneView from "../../src/lib/scene/SceneView.svelte";
import { modelFor } from "../helpers/model.js";
import { render } from "../helpers/render.js";

const rows = [
  { x: 1, y: 10, cls: "a" },
  { x: 2, y: 20, cls: "b" },
];

function liveScene(): { scene: Scene; dispose: () => void } {
  const model = modelFor(
    gg(rows, aes({ x: "x", y: "y", color: "cls" }))
      .geomPoint()
      .labs({ title: "Plot title", caption: "Plot caption" })
      .spec(),
  );
  return {
    scene: model.scene,
    dispose() {
      model.dispose();
    },
  };
}

/** Two layers → two scene batches (points + paths) for mask index alignment. */
function multiLayerScene(): { scene: Scene; dispose: () => void } {
  const model = modelFor(
    gg(rows, aes({ x: "x", y: "y", color: "cls" }))
      .geomPoint()
      .geomLine()
      .spec(),
  );
  return {
    scene: model.scene,
    dispose() {
      model.dispose();
    },
  };
}

function focusFirstPrimitive(): BatchInteractionMask {
  return {
    primitiveCount: 2,
    focusedCount: 1,
    isFocused: (index) => index === 0,
  };
}

describe("SceneView ARIA surface", () => {
  it("full mode: role=img, aria-label from sceneLabel, no aria-hidden", () => {
    const { scene, dispose } = liveScene();
    const { container } = render(SceneView, { scene, mode: "full" });
    const svg = container.querySelector("svg.gg-plot");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe(sceneLabel(scene));
    expect(svg?.hasAttribute("aria-hidden")).toBe(false);
    expect(svg?.querySelector("title")?.textContent).toBe(sceneLabel(scene));
    dispose();
  });

  it("chrome-bottom mode: role=img with aria-label (sandwich bottom is the named surface)", () => {
    const { scene, dispose } = liveScene();
    const { container } = render(SceneView, { scene, mode: "chrome-bottom" });
    const svg = container.querySelector("svg.gg-plot");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe(sceneLabel(scene));
    expect(svg?.hasAttribute("aria-hidden")).toBe(false);
    expect(svg?.classList.contains("gg-svg-chrome-bottom")).toBe(true);
    dispose();
  });

  it("marks mode: role=presentation and aria-hidden (decorative mark slice)", () => {
    const { scene, dispose } = liveScene();
    const { container } = render(SceneView, { scene, mode: "marks" });
    const svg = container.querySelector("svg.gg-plot");
    expect(svg?.getAttribute("role")).toBe("presentation");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.hasAttribute("aria-label")).toBe(false);
    expect(svg?.querySelector("title")).toBeNull();
    expect(svg?.classList.contains("gg-svg-marks")).toBe(true);
    dispose();
  });

  it("chrome-top mode: role=presentation and aria-hidden (top chrome is decorative)", () => {
    const { scene, dispose } = liveScene();
    const { container } = render(SceneView, { scene, mode: "chrome-top" });
    const svg = container.querySelector("svg.gg-plot");
    expect(svg?.getAttribute("role")).toBe("presentation");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.hasAttribute("aria-label")).toBe(false);
    expect(svg?.classList.contains("gg-svg-chrome-top")).toBe(true);
    dispose();
  });

  it("renders caption text when scene.caption is non-empty (drawTop modes)", () => {
    const { scene, dispose } = liveScene();
    expect(scene.caption).toBe("Plot caption");
    const { container } = render(SceneView, { scene, mode: "full" });
    const caption = container.querySelector("text.gg-caption");
    expect(caption?.textContent).toBe("Plot caption");
    expect(caption?.getAttribute("text-anchor")).toBe("end");
    dispose();
  });
});

describe("SceneView focus-mask projection", () => {
  it("applies full-scene masks by batch identity on a marks subset", () => {
    const { scene, dispose } = multiLayerScene();
    expect(scene.batches.length).toBe(2);
    const points = scene.batches[0];
    const paths = scene.batches[1];
    const mask = focusFirstPrimitive();
    // Full-scene masks: focus only the path layer (index 1).
    const focusMasks: (BatchInteractionMask | null)[] = [null, mask];

    const { container } = render(SceneView, {
      scene,
      mode: "marks",
      // Subset is reverse of scene order — must not use subset index.
      batches: [paths, points],
      focusMasks,
    });

    const pathMarks = container.querySelectorAll(".gg-batch.gg-paths [data-gg-focused]");
    const pointMarks = container.querySelectorAll(".gg-batch.gg-points [data-gg-focused]");
    // Paths carry the mask (focused attrs present); points had null mask.
    expect(pathMarks.length).toBeGreaterThan(0);
    expect(pointMarks.length).toBe(0);
    dispose();
  });

  it("short-circuits when focusMasks is empty (no data-gg-focused attrs)", () => {
    const { scene, dispose } = multiLayerScene();
    const { container } = render(SceneView, {
      scene,
      mode: "full",
      focusMasks: [],
    });
    expect(container.querySelectorAll("[data-gg-focused]").length).toBe(0);
    dispose();
  });
});

describe("SceneView panel chrome branches", () => {
  it("draws minor grid lines when scales publish minorBreaks", () => {
    const model = modelFor(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scaleXContinuous({ minorBreaks: [1.5] })
        .scaleYContinuous({ minorBreaks: [15] })
        .spec(),
    );
    const panel = model.scene.panels[0];
    expect(panel?.grid.minorX?.length).toBeGreaterThan(0);
    expect(panel?.grid.minorY?.length).toBeGreaterThan(0);

    const { container } = render(SceneView, { scene: model.scene, mode: "full" });
    const minor = container.querySelector("g.gg-grid-minor");
    expect(minor).not.toBeNull();
    expect(minor?.querySelectorAll("line").length).toBeGreaterThan(0);
    model.dispose();
  });

  it("clips left facet strips with a side-band clipPath", () => {
    const facetRows = [
      { x: 1, y: 10, g: "alpha" },
      { x: 2, y: 20, g: "beta" },
    ];
    const model = modelFor(
      gg(facetRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({
          wrap: { field: "g", levels: ["alpha", "beta"] },
          strip: { position: "left" },
        })
        .spec(),
    );
    expect(model.scene.panels.every((p) => p.stripPosition === "left")).toBe(true);
    expect(model.scene.panels[0]?.strip).toBe("alpha");

    const { container } = render(SceneView, { scene: model.scene, mode: "full" });
    const strip = container.querySelector("g.gg-strip");
    expect(strip).not.toBeNull();
    // Left/right strips set clip:true so rotated labels stay in the band.
    expect(strip?.getAttribute("clip-path")).toMatch(/^url\(#/);
    const clipId = strip?.getAttribute("clip-path")?.match(/url\(#([^)]+)\)/)?.[1];
    expect(clipId).toBeTruthy();
    expect(container.querySelector(`clipPath#${CSS.escape(clipId!)}`)).not.toBeNull();
    model.dispose();
  });
});
