/**
 * #1570: SceneView y-axis title must track gridLeft like pure SVG renderAxisTitles.
 */
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";

import type { Scene } from "@ggts-sh/core";

import SceneView from "../../src/lib/scene/SceneView.svelte";
import { render } from "../helpers/render.js";

function sceneWithYTitle(gridLeft: number, titleOffset?: number): Scene {
  return fromAny<Scene>({
    width: 640,
    height: 400,
    panels: [
      {
        id: "panel:all",
        x: gridLeft,
        y: 20,
        width: 400,
        height: 300,
        strip: "",
        axisX: null,
        axisY: null,
        grid: { x: [], y: [] },
        clip: false,
      },
    ],
    batches: [],
    legends: [],
    theme: {
      ink: "black",
      accent: "blue",
      paper: "none",
      panel: "none",
      interactionMuted: 0.35,
      fontFamily: "sans-serif",
      fontSize: 12,
      fontWeight: 400,
      axisTitleSize: 11,
      axisTitleWeight: 400,
      gridX: false,
      gridY: false,
      showPanelBorder: false,
    },
    axes: {
      x: { ticks: [], title: "" },
      y: {
        ticks: [],
        title: "Y axis",
        ...(titleOffset !== undefined && { titleOffset }),
      },
    },
    title: "",
    subtitle: "",
    caption: "",
  });
}

describe("SceneView y-axis title (#1570)", () => {
  it("places the y title at gridLeft - default 32, not fixed x=12", () => {
    const gridLeft = 100;
    const { container } = render(SceneView, {
      props: { scene: sceneWithYTitle(gridLeft) },
    });
    const title = container.querySelector(".gg-axis-title");
    expect(title).not.toBeNull();
    const transform = title?.getAttribute("transform") ?? "";
    expect(transform).toContain(`translate(${gridLeft - 32},`);
    expect(transform).not.toContain("translate(12,");
  });

  it("honours axes.y.titleOffset", () => {
    const gridLeft = 120;
    const titleOffset = 72;
    const { container } = render(SceneView, {
      props: { scene: sceneWithYTitle(gridLeft, titleOffset) },
    });
    const transform = container.querySelector(".gg-axis-title")?.getAttribute("transform") ?? "";
    expect(transform).toContain(`translate(${gridLeft - titleOffset},`);
  });
});
