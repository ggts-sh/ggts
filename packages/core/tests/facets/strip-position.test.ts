/**
 * Facet strip position and visibility (issue #590 / #611).
 * Seam: runPipeline scene geometry + SVG strip chrome.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";

import { FONT_METRICS } from "../../src/layout/font-metrics.ts";
import { MetricsTableMeasurer } from "../../src/layout/measure.ts";
import { runPipeline } from "../../src/pipeline.ts";
import { sceneToSVGString } from "../../src/render-svg.ts";
import { STRIP_BAND } from "../../src/scene.ts";
import { size, wrapRows } from "./fixtures.ts";

function facetSpec(strip?: { position?: "top" | "bottom" | "left" | "right"; show?: boolean }) {
  return gg(wrapRows, aes({ x: "x", y: "y" }))
    .geomPoint()
    .facet({
      wrap: { field: "g", levels: ["a", "b", "c"] },
      ...(strip !== undefined && { strip }),
    })
    .spec();
}

describe("facet strip position — layout and render (#590)", () => {
  it("defaults to top strips with a reserved band above every panel", () => {
    const model = runPipeline(facetSpec(), size);
    const panel = model.scene.panels[0]!;
    expect(panel.strip).toBe("a");
    expect(panel.stripPosition).toBe("top");
    expect(panel.showStrip).toBe(true);
    expect(panel.stripBand).toBe(STRIP_BAND);
    // Panel content starts below the strip band
    expect(panel.y).toBeGreaterThanOrEqual(STRIP_BAND);

    const svg = sceneToSVGString(model.scene);
    expect(svg).toContain('class="gg-strip"');
  });

  it("bottom strips place the band below the panel and axis margin", () => {
    const model = runPipeline(facetSpec({ position: "bottom" }), size);
    const panels = model.scene.panels;
    expect(panels.every((p) => p.stripPosition === "bottom")).toBe(true);
    expect(panels[0]!.stripBand).toBe(STRIP_BAND);

    const svg = sceneToSVGString(model.scene);
    // Scene panels and strip groups share paint order; axis-bearing panels
    // clear the tick band before the strip chrome starts.
    const strips = [...svg.matchAll(/class="gg-strip" transform="translate\(([^,]+),([^)]+)\)"/g)];
    expect(strips).toHaveLength(panels.length);
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i]!;
      const stripY = Number(strips[i]![2]);
      const axisBand = panel.axisX === null ? 0 : 28;
      expect(stripY).toBeCloseTo(panel.y + panel.height + axisBand, 1);
    }
  });

  it("left strips reserve horizontal space and draw outside the y-axis band", () => {
    const model = runPipeline(
      gg(wrapRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({
          wrap: {
            field: "g",
            levels: ["a", "b"],
            labels: { a: "Alpha Region", b: "Beta Zone" },
          },
          strip: { position: "left" },
        })
        .spec(),
      size,
    );
    const panel = model.scene.panels[0]!;
    expect(panel.stripPosition).toBe("left");
    expect(panel.stripBand).toBeGreaterThan(STRIP_BAND); // long label → wider band
    expect(panel.x).toBeGreaterThanOrEqual(panel.stripBand!);

    const svg = sceneToSVGString(model.scene);
    expect(svg).toContain("Alpha Region");
    const match = svg.match(/class="gg-strip" transform="translate\(([^,]+),([^)]+)\)"/);
    expect(match).not.toBeNull();
    const stripX = Number(match![1]);
    // Strip is left of the y-axis margin when the panel draws a left axis.
    const axisBand = panel.axisY === null ? 0 : 36;
    expect(stripX).toBeCloseTo(panel.x - axisBand - panel.stripBand!, 1);
  });

  it("right strips draw to the right of the panel content", () => {
    const model = runPipeline(facetSpec({ position: "right" }), size);
    const panel = model.scene.panels[0]!;
    expect(panel.stripPosition).toBe("right");
    expect(panel.stripBand).toBeGreaterThan(0);

    const svg = sceneToSVGString(model.scene);
    const match = svg.match(/class="gg-strip" transform="translate\(([^,]+),([^)]+)\)"/);
    expect(match).not.toBeNull();
    const stripX = Number(match![1]);
    expect(stripX).toBeCloseTo(panel.x + panel.width, 1);
  });

  it("show:false hides strip chrome and reserves no strip band", () => {
    const model = runPipeline(facetSpec({ show: false }), size);
    const panel = model.scene.panels[0]!;
    // Display label remains for a11y/interaction consumers
    expect(panel.strip).toBe("a");
    expect(panel.showStrip).toBe(false);
    expect(panel.stripBand).toBe(0);

    const svg = sceneToSVGString(model.scene);
    expect(svg).not.toContain('class="gg-strip"');
  });
});

describe("side strip vertical collision (#611)", () => {
  const longLabel =
    "Extremely Long Facet Panel Label That Exceeds Short Multi-Row Panel Height When Rotated";

  it("caps rotated left strip label advance to panel height and clips SVG paint", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1, g: "a" },
          { x: 2, y: 2, g: "b" },
          { x: 3, y: 3, g: "c" },
          { x: 4, y: 4, g: "d" },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .facet({
          wrap: {
            field: "g",
            levels: ["a", "b", "c", "d"],
            labels: {
              a: longLabel,
              b: longLabel,
              c: longLabel,
              d: longLabel,
            },
          },
          ncol: 1,
          strip: { position: "left" },
        })
        .spec(),
      // Short viewport → multi-row panels shorter than the full label advance.
      { width: 360, height: 220 },
    );

    expect(model.scene.panels.length).toBe(4);
    // Multi-row: distinct y positions
    expect(new Set(model.scene.panels.map((p) => p.y)).size).toBeGreaterThan(1);

    const measurer = new MetricsTableMeasurer(FONT_METRICS);
    const stripSize = model.scene.theme.stripSize;

    for (const panel of model.scene.panels) {
      expect(panel.stripPosition).toBe("left");
      // Rotated advance must fit inside the panel's vertical budget.
      expect(measurer.measureWidth(panel.strip, stripSize)).toBeLessThanOrEqual(panel.height + 0.5);
      // Full label was longer than the panel — expect ellipsis truncation.
      expect(panel.strip.length).toBeLessThan(longLabel.length);
      expect(panel.strip.endsWith("…")).toBe(true);
      // Band width also respects the vertical budget (+ pad).
      expect(panel.stripBand!).toBeLessThanOrEqual(Math.ceil(panel.height) + 8 + 1);
    }

    const svg = sceneToSVGString(model.scene);
    expect(svg).toContain("gg-strip-clip-");
    expect(svg).toContain('clip-path="url(#gg-strip-clip-0)"');
    // Truncated label is rendered; full long string is not.
    expect(svg).not.toContain(longLabel);
    expect(svg).toContain("…");
  });

  it("leaves short side-strip labels untruncated", () => {
    const model = runPipeline(
      gg(wrapRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({
          wrap: { field: "g", levels: ["a", "b"], labels: { a: "Alpha", b: "Beta" } },
          strip: { position: "left" },
        })
        .spec(),
      size,
    );
    expect(model.scene.panels.map((p) => p.strip)).toEqual(["Alpha", "Beta"]);
    const svg = sceneToSVGString(model.scene);
    expect(svg).toContain("Alpha");
    expect(svg).toContain("Beta");
  });
});
