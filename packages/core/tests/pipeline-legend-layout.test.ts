import { describe, expect, it } from "bun:test";

import {
  aes,
  gg,
  guideAxis,
  guideColorbar,
  guideLegend,
  scaleColorContinuous,
  scaleColorDiscrete,
  scaleColorIdentity,
  scaleShapeDiscrete,
  scaleSizeIdentity,
} from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.js";

import { renderToSVGString } from "../src/render-svg-full.js";

const rows = [
  { x: 1, y: 2, region: "North" },
  { x: 2, y: 4, region: "South" },
  { x: 3, y: 3, region: "North" },
];

describe("responsive guide planning", () => {
  it("moves automatic guides below on narrow viewports and keeps 320px of panel when right", () => {
    const narrow = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .spec(),
      { width: 420, height: 360 },
    );
    expect(narrow.scene.legends[0]?.position).toBe("bottom");
    expect(narrow.scene.legends[0]?.direction).toBe("horizontal");
    expect(narrow.warnings.filter((warning) => warning.code === "guide-auto-bottom")).toHaveLength(
      1,
    );

    const wide = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .spec(),
      { width: 720, height: 360 },
    );
    expect(wide.scene.legends[0]?.position).toBe("right");
    expect(wide.scene.panels[0]?.width).toBeGreaterThanOrEqual(320);
  });

  it("reserves independent right and bottom zones for explicitly placed guides", () => {
    const result = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region", shape: "region" }))
        .geomPoint()
        .scales({ ...scaleColorDiscrete(), ...scaleShapeDiscrete() })
        .labs({ color: "Region", shape: "Region" })
        .guides({
          color: guideLegend({ position: "right" }),
          shape: guideLegend({ position: "bottom" }),
        })
        .spec(),
      { width: 720, height: 360 },
    );
    expect(
      result.scene.legends
        .map((legend) => legend.position)
        .toSorted((left, right) => (left ?? "").localeCompare(right ?? "")),
    ).toEqual(["bottom", "right"]);
    expect(result.scene.panels[0]?.width).toBeLessThan(620);
    expect(result.scene.panels[0]?.height).toBeLessThan(260);
    const bottomLegend = result.scene.legends.find((legend) => legend.position === "bottom");
    expect(bottomLegend!.width).toBeLessThanOrEqual(result.scene.panels[0]!.width);
    expect(bottomLegend!.y).toBeGreaterThanOrEqual(
      result.scene.panels[0]!.y + result.scene.panels[0]!.height + 32,
    );
    const svg = renderToSVGString(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .guides({ color: guideLegend({ position: "bottom", direction: "horizontal" }) })
        .spec(),
      { width: 420, height: 360 },
    );
    expect(svg).toContain("gg-legend-bottom gg-legend-horizontal");
    expect(svg).toContain(">North</text>");
  });

  it("keeps bottom guides inside the viewport when the y-axis has wide chrome", () => {
    const wideChromeRows = [
      { x: 0, y: "A very long category on the vertical axis", value: 0 },
      { x: 1, y: "Another very long category on the vertical axis", value: 1 },
    ];
    const result = runPipeline(
      gg(wideChromeRows, aes({ x: "x", y: "y", color: "value" }))
        .geomPoint()
        .scales({ y: { type: "band" }, ...scaleColorContinuous() })
        .guides({
          color: guideColorbar({
            position: "bottom",
            direction: "horizontal",
            theme: { colorbarLength: 512 },
          }),
        })
        .spec(),
      { width: 640, height: 360 },
    );
    const legend = result.scene.legends[0]!;
    expect(legend.x + legend.width).toBeLessThanOrEqual(result.scene.width - 2);
  });

  it("renders wrapped discrete labels as multiline SVG without ellipsis", () => {
    const wrappedRows = [
      { x: 1, y: 1, group: "A deliberately long northern category label" },
      { x: 2, y: 2, group: "A deliberately long southern category label" },
    ];
    const svg = renderToSVGString(
      gg(wrappedRows, aes({ x: "x", y: "y", color: "group" }))
        .geomPoint()
        .guides({
          color: guideLegend({
            position: "bottom",
            direction: "horizontal",
            collision: "wrap",
          }),
        })
        .spec(),
      { width: 190, height: 360 },
    );
    expect(svg).toContain("<tspan");
    expect(svg).toContain(">long northern</tspan>");
    expect(svg).toContain(">category label</tspan>");
    expect(svg).not.toContain("…");
  });

  it("renders measured colorbar title bands and horizontal ramp insets in pure SVG", () => {
    const spec = gg(rows, aes({ x: "x", y: "y", color: "x" }))
      .geomPoint()
      .scales(scaleColorContinuous())
      .guides({
        color: guideColorbar({
          title: "Value",
          position: "bottom",
          theme: { titleSize: 32 },
        }),
      })
      .spec();
    const result = runPipeline(spec, { width: 640, height: 360 });
    const legend = result.scene.legends[0];
    expect(legend?.type).toBe("ramp");
    if (legend?.type !== "ramp") return;
    const rampX = Math.round((legend.rampX ?? 0) * 100) / 100;
    const svg = renderToSVGString(spec, { width: 640, height: 360 });
    expect(svg).toContain('class="gg-legend-title" x="4" y="32"');
    expect(svg).toContain(`class="gg-legend-ramp" x="${String(rampX)}"`);
  });

  it("controls colorbar tick marks independently from complete semantic labels", () => {
    const spec = gg(rows, aes({ x: "x", y: "y", color: "x" }))
      .geomPoint()
      .scales(scaleColorContinuous())
      .guides({
        color: guideColorbar({
          position: "bottom",
          showTicks: false,
          showLabels: false,
        }),
      })
      .spec();
    const result = runPipeline(spec, { width: 640, height: 360 });
    const legend = result.scene.legends[0];
    expect(legend?.type).toBe("ramp");
    if (legend?.type !== "ramp") return;
    expect(legend.showTicks).toBe(false);
    expect(legend.ticks.every((tick) => tick.label === "" && tick.fullLabel !== "")).toBe(true);
    const svg = renderToSVGString(spec, { width: 640, height: 360 });
    expect(svg).not.toContain("gg-legend-tick");
    expect(svg).not.toContain("gg-legend-label");
  });

  it("suppresses identity guides by default and exposes exact values only when forced", () => {
    const identityRows = [
      { x: 1, y: 2, color: "#ff0000", size: 4 },
      { x: 2, y: 3, color: "#0000ff", size: 8 },
    ];
    const base = gg(identityRows, aes({ x: "x", y: "y", color: "color", size: "size" }))
      .geomPoint()
      .scales({ ...scaleColorIdentity(), ...scaleSizeIdentity() })
      .labs({ color: "Authored color", size: "Authored size" });
    expect(runPipeline(base.spec(), { width: 720, height: 360 }).scene.legends).toHaveLength(0);

    const forced = runPipeline(
      base
        .guides({
          color: guideLegend({ force: true }),
          size: guideLegend({ force: true }),
        })
        .spec(),
      { width: 720, height: 360 },
    );
    expect(forced.scene.legends).toHaveLength(2);
    expect(
      forced.scene.legends.every(
        (legend) => legend.type === "discrete" && legend.interactive === true,
      ),
    ).toBe(true);
  });

  it("uses each preceding guide block gap without reserving trailing whitespace", () => {
    const result = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region", shape: "region" }))
        .geomPoint()
        .labs({ color: "Color", shape: "Shape" })
        .guides({
          color: guideLegend({ position: "right", theme: { blockGap: 30 } }),
          shape: guideLegend({ position: "right", theme: { blockGap: 4 } }),
        })
        .spec(),
      { width: 720, height: 360 },
    );
    const [color, shape] = result.scene.legends;
    expect(shape?.y).toBe((color?.y ?? 0) + (color?.height ?? 0) + 30);
  });

  it("uses theme-owned guide roles and reserves bounded per-guide typography", () => {
    const baseline = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .spec(),
      { width: 720, height: 360 },
    );
    const result = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .theme({
          name: "light",
          guideTitleSize: 14,
          legendKeySize: 15,
          legendKeyGap: 8,
          guideBlockGap: 16,
        })
        .guides({
          x: guideAxis({ theme: { titleSize: 16, labelSize: 12 } }),
          color: guideLegend({ theme: { labelSize: 13 } }),
        })
        .spec(),
      { width: 720, height: 360 },
    );
    const legend = result.scene.legends[0];
    expect(legend).toMatchObject({ titleSize: 14, labelSize: 13, swatchSize: 15 });
    expect(result.scene.axes.x.titleSize).toBe(16);
    expect(result.scene.axes.x.ticks.every((tick) => tick.labelSize === 12)).toBe(true);
    expect(result.scene.panels[0]!.height).toBeLessThan(baseline.scene.panels[0]!.height);
  });
});
