import {
  resolveTheme,
  type SceneDiscreteLegend,
  type SceneRampLegend,
  type SceneStepsLegend,
} from "@ggts-sh/core";
import { describe, expect, it } from "vitest";

import Legend from "../../src/lib/scene/Legend.svelte";
import { render } from "../helpers/render.js";

const theme = resolveTheme({ name: "light" });

describe("Legend scene rendering", () => {
  it("renders wrapped discrete labels as measured tspans", () => {
    const legend: SceneDiscreteLegend = {
      type: "discrete",
      scale: "color",
      title: "Group",
      position: "bottom",
      direction: "horizontal",
      x: 0,
      y: 0,
      width: 160,
      height: 72,
      swatchSize: 10,
      entries: [
        {
          value: "long",
          label: "A long category label",
          fullLabel: "A long category label",
          lines: ["A long", "category label"],
          lineHeight: 13,
          color: "#123456",
          x: 0,
          y: 18,
          height: 32,
        },
      ],
    };
    const { container } = render(Legend, { legend, theme });
    const tspans = container.querySelectorAll(".gg-legend-label tspan");
    expect(tspans).toHaveLength(2);
    expect(Array.from(tspans, (node) => node.textContent)).toEqual(["A long", "category label"]);
    expect(tspans.item(1)?.getAttribute("dy")).toBe("13");
  });

  it("preserves sentinel-gray paint on merged style keys", () => {
    const legend: SceneDiscreteLegend = {
      type: "discrete",
      scale: "color",
      aesthetics: ["color", "shape"],
      title: "Group",
      x: 0,
      y: 0,
      width: 120,
      height: 48,
      swatchSize: 10,
      entries: [
        {
          value: "gray",
          label: "Gray",
          color: "#999999",
          hasPaint: true,
          shape: "circle",
          y: 18,
        },
      ],
    };
    const { container } = render(Legend, { legend, theme });
    expect(container.querySelector(".gg-legend-key")?.getAttribute("fill")).toBe("#999999");
  });

  it("uses the measured title band for large guide titles", () => {
    const legend: SceneDiscreteLegend = {
      type: "discrete",
      scale: "color",
      title: "Large title",
      titleSize: 32,
      titleHeight: 39,
      position: "right",
      direction: "vertical",
      x: 0,
      y: 0,
      width: 180,
      height: 70,
      swatchSize: 10,
      entries: [{ value: "a", label: "A", color: "#123456", y: 39 }],
    };
    const { container } = render(Legend, { legend, theme });
    expect(container.querySelector(".gg-legend-title")?.getAttribute("y")).toBe("32");
    expect(container.querySelector(".gg-legend-swatch")?.getAttribute("y")).toBe("46");
  });

  it("exposes a truncated colorstep entry's complete semantic label", () => {
    const legend: SceneStepsLegend = {
      type: "steps",
      scale: "color",
      title: "",
      position: "bottom",
      direction: "horizontal",
      x: 0,
      y: 0,
      width: 120,
      height: 40,
      entries: [
        {
          label: "abbreviated…",
          fullLabel: "complete interval label",
          color: "#123456",
          y: 0,
        },
      ],
      stepWidth: 80,
      stepHeight: 12,
    };
    const { container } = render(Legend, { legend, theme });
    expect(container.querySelector(".gg-legend-label title")?.textContent).toBe(
      "complete interval label",
    );
  });

  it("renders horizontal ramp bars and endpoint labels from the measured inset", () => {
    const legend: SceneRampLegend = {
      type: "ramp",
      scale: "color",
      title: "",
      position: "bottom",
      direction: "horizontal",
      x: 0,
      y: 0,
      width: 180,
      height: 48,
      stops: [
        [0, "#000000"],
        [1, "#ffffff"],
      ],
      ticks: [
        { pos: 0, label: "minimum" },
        { pos: 120, label: "maximum" },
      ],
      rampX: 24,
      rampWidth: 120,
      rampHeight: 12,
    };
    const { container } = render(Legend, { legend, theme });
    expect(container.querySelector(".gg-legend-ramp")?.getAttribute("x")).toBe("24");
    expect(container.querySelector(".gg-legend-tick")?.getAttribute("x1")).toBe("24");
    expect(container.querySelector(".gg-legend-label")?.getAttribute("x")).toBe("24");
  });
});
