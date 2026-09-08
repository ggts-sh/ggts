import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import { withGrammarAsSpec } from "../helpers/ggplot-input.js";

import type { SceneLegend, ThemeTokens } from "@ggts-sh/core";

import GGPlot from "../../src/lib/GGPlot.svelte";
import LegendHarness from "../fixtures/LegendHarness.svelte";
import { render } from "../helpers/render.js";

function documentCssText(): string {
  return [...document.styleSheets]
    .flatMap((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText);
      } catch {
        return [] as string[];
      }
    })
    .join("\n");
}

const theme = fromPartial<ThemeTokens>({});
const discrete = {
  type: "discrete",
  scale: "fill",
  title: "Channel",
  x: 10,
  y: 12,
  width: 124,
  height: 72,
  swatchSize: 12,
  entries: [
    { value: "web", label: "Web", color: "#123456", y: 18 },
    { value: "store", label: "Store", color: "#654321", y: 42 },
    { value: "partner", label: "Partner", color: "#abcdef", y: 66 },
  ],
} satisfies SceneLegend;

const ramp = {
  type: "ramp",
  scale: "color",
  title: "Score",
  x: 10,
  y: 12,
  width: 80,
  height: 120,
  rampWidth: 12,
  rampHeight: 80,
  stops: [
    [0, "#000"],
    [1, "#fff"],
  ],
  ticks: [
    { y: 0, label: "10" },
    { y: 80, label: "0" },
  ],
} satisfies SceneLegend;

const steps = {
  type: "steps",
  scale: "fill",
  title: "Count",
  x: 10,
  y: 12,
  width: 96,
  height: 96,
  stepWidth: 12,
  stepHeight: 24,
  entries: [
    { label: "0–10", color: "#111111", y: 0 },
    { label: "10–20", color: "#777777", y: 24 },
    { label: "20–30", color: "#eeeeee", y: 48 },
  ],
} satisfies SceneLegend;

describe("static Legend", () => {
  it("renders discrete SVG swatches and labels without an embedded HTML interaction tree", () => {
    const { container } = render(LegendHarness, { legend: discrete, theme });
    const legend = container.querySelector(".gg-legend-fill");
    expect(legend?.getAttribute("transform")).toBe("translate(10,12)");
    expect(legend?.querySelector(".gg-legend-title")?.textContent).toBe("Channel");
    expect(legend?.querySelectorAll(".gg-legend-swatch")).toHaveLength(3);
    expect(
      [...(legend?.querySelectorAll(".gg-legend-label") ?? [])].map((label) => label.textContent),
    ).toEqual(["Web", "Store", "Partner"]);
    expect(legend?.querySelector("foreignObject, button")).toBeNull();
  });

  it("renders a continuous ramp with a component-scoped gradient id", () => {
    const { container } = render(LegendHarness, { legend: ramp, theme });
    const gradient = container.querySelector("linearGradient");
    const bar = container.querySelector(".gg-legend-ramp");
    expect(gradient?.id).toMatch(/^gg-ramp-/);
    expect(bar?.getAttribute("fill")).toBe(`url(#${gradient?.id})`);
    expect(container.querySelectorAll("stop")).toHaveLength(2);
    expect(
      [...container.querySelectorAll(".gg-legend-label")].map((label) => label.textContent),
    ).toEqual(["10", "0"]);
    expect(container.querySelector("foreignObject, button")).toBeNull();
  });

  it("renders repeated colorbar break positions without duplicate-key failures", () => {
    const repeatedTicks = {
      ...ramp,
      ticks: [
        { y: 40, label: "same" },
        { y: 40, label: "same" },
      ],
    } satisfies SceneLegend;
    const { container } = render(LegendHarness, { legend: repeatedTicks, theme });
    expect(container.querySelectorAll(".gg-legend-label")).toHaveLength(2);
  });

  it("renders binned colorsteps as discrete adjacent swatches with labels", () => {
    const { container } = render(LegendHarness, { legend: steps, theme });
    const legend = container.querySelector(".gg-legend-fill");
    expect(legend?.querySelectorAll(".gg-legend-step")).toHaveLength(3);
    expect(
      [...(legend?.querySelectorAll(".gg-legend-label") ?? [])].map((label) => label.textContent),
    ).toEqual(["0–10", "10–20", "20–30"]);
    expect(
      [...(legend?.querySelectorAll(".gg-legend-step") ?? [])].map((step) =>
        step.getAttribute("fill"),
      ),
    ).toEqual(["#111111", "#777777", "#eeeeee"]);
    expect(legend?.querySelector("linearGradient, foreignObject, button")).toBeNull();
  });

  it("renders colorsteps whose formatted labels collide", () => {
    const repeatedLabels = {
      ...steps,
      entries: [
        { label: "0–0", color: "#111111", y: 0 },
        { label: "0–0", color: "#777777", y: 24 },
      ],
    } satisfies SceneLegend;
    const { container } = render(LegendHarness, { legend: repeatedLabels, theme });
    expect(container.querySelectorAll(".gg-legend-step")).toHaveLength(2);
  });

  it("renders binned colors and colorsteps through the public GGPlot composition", () => {
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: [
          { x: 1, y: 1, score: 1 },
          { x: 2, y: 2, score: 10 },
          { x: 3, y: 3, score: 100 },
        ],
        aes: { x: "x", y: "y", color: "score" },
        layers: [{ geom: "point" }],
        scales: {
          color: {
            type: "binned",
            breaks: [1, 10, 100],
            range: ["#111", "#eee"],
          },
        },
        width: 640,
        height: 400,
      }),
    );
    expect(container.querySelectorAll(".gg-legend-step")).toHaveLength(2);
    expect(
      [...container.querySelectorAll(".gg-legend-label")].map((label) => label.textContent),
    ).toEqual(["10–100", "1–10"]);
    expect(
      [...container.querySelectorAll(".gg-points circle, .gg-points rect")].map((mark) =>
        mark.getAttribute("fill"),
      ),
    ).toEqual(["#111111", "#eeeeee", "#eeeeee"]);
  });

  it("uses system colors for committed targets and recovery controls in forced colors", () => {
    render(GGPlot, {
      data: [
        { id: "a", x: 1, y: 1, group: "North" },
        { id: "b", x: 2, y: 2, group: "South" },
      ],
      aes: { x: "x", y: "y", color: "group" },
      layers: [{ geom: "point" }],
      key: "id",
      legendFocus: true,
      width: 640,
      height: 400,
    });
    const css = documentCssText();
    expect(css).toMatch(/forced-colors:\s*active/i);
    expect(css).toMatch(/aria-pressed="true"[^}]*border-color:\s*highlight/i);
    expect(css).toMatch(/\.gg-legend-clear[^}]*background:\s*canvas/i);
    expect(css).toMatch(/\.gg-legend-clear[^}]*color:\s*canvastext/i);
  });

  it("omits the title node and pins the ramp at y=0 when title is empty", () => {
    const untitled = { ...ramp, title: "" } satisfies SceneLegend;
    const { container } = render(LegendHarness, { legend: untitled, theme });
    expect(container.querySelector(".gg-legend-title")).toBeNull();
    const bar = container.querySelector(".gg-legend-ramp");
    expect(bar?.getAttribute("y")).toBe("0");
    // Tick labels are placed relative to rampTop=0 (not the titled offset of 18).
    const labels = [...container.querySelectorAll(".gg-legend-label")];
    expect(labels.map((label) => label.getAttribute("y"))).toEqual(["0", "80"]);
  });
});
