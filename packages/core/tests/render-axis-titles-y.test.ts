/**
 * #1570: y-axis title must track the panel grid (gridLeft - offset), not a
 * fixed SVG x=12 that drifts when the left margin grows.
 */
import { describe, expect, it } from "bun:test";

import type { SpecInput } from "@ggts-sh/spec";

import { renderAxisTitles } from "../src/render-svg-panel-chrome.ts";
import { renderToSVGString } from "../src/render-svg-full.ts";
import { resolveTheme } from "../src/theme.ts";
import type { Scene, ScenePanel } from "../src/scene.ts";

function panelAt(x: number, y = 20, width = 400, height = 300): ScenePanel {
  return {
    id: "panel:all",
    identity: { key: "panel:all", fields: {}, values: {} },
    x,
    y,
    width,
    height,
    strip: "",
    axisX: [],
    axisY: [],
    grid: { x: [], y: [], minorX: [], minorY: [] },
  };
}

function sceneWithYTitle(gridLeft: number, yTitleOffset?: number): Scene {
  return {
    width: 640,
    height: 400,
    panels: [panelAt(gridLeft)],
    batches: [],
    axes: {
      x: { ticks: [], title: "" },
      y: {
        ticks: [],
        title: "Y axis",
        ...(yTitleOffset !== undefined && { titleOffset: yTitleOffset }),
      },
    },
    grid: { x: [], y: [] },
    legends: [],
    theme: resolveTheme(),
    title: "",
    subtitle: "",
    caption: "",
  };
}

function yTitleTranslateX(svgFragment: string): number {
  const match = svgFragment.match(/class="gg-axis-title"[^>]*transform="translate\(([\d.]+),/);
  expect(match).not.toBeNull();
  return Number(match![1]);
}

describe("y-axis title placement (#1570)", () => {
  it("places the y title relative to gridLeft, not a fixed SVG x=12", () => {
    const gridLeft = 100;
    const html = renderAxisTitles(sceneWithYTitle(gridLeft));
    const titleX = yTitleTranslateX(html);
    // Default offset mirrors the x-axis title's 32px clearance past tick chrome.
    expect(titleX).toBe(gridLeft - 32);
    expect(titleX).not.toBe(12);
  });

  it("honours axes.y.titleOffset when the tick-label band is wider than the default", () => {
    const gridLeft = 120;
    const titleOffset = 72;
    const html = renderAxisTitles(sceneWithYTitle(gridLeft, titleOffset));
    expect(yTitleTranslateX(html)).toBe(gridLeft - titleOffset);
  });

  it("tracks the panel on the full render path (not a fixed SVG x=12)", () => {
    // Short numeric y labels: title sits near gridLeft with ~default clearance.
    const rows = Array.from({ length: 20 }, (_, i) => ({ x: i, y: i * 10 }));
    const spec: SpecInput = {
      data: { values: rows },
      layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
      labs: { y: "Miles per gallon" },
      theme: "classic",
    };
    const svg = renderToSVGString(spec, { width: 640, height: 400 });
    const panelX = Number(svg.match(/class="gg-panel"[^>]*transform="translate\(([\d.]+)/)?.[1]);
    const titleX = yTitleTranslateX(svg);
    expect(panelX).toBeGreaterThan(32);
    // Title tracks the panel (gridLeft - offset), not absolute x=12.
    expect(titleX).not.toBe(12);
    expect(titleX).toBeLessThan(panelX);
    const offset = panelX - titleX;
    expect(offset).toBeGreaterThanOrEqual(32);
    expect(offset).toBeLessThanOrEqual(48);
  });

  it("clears wide y tick labels via axes.y.titleOffset on the full path", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      x: i,
      y: (i + 1) * 1_000_000,
    }));
    const spec: SpecInput = {
      data: { values: rows },
      layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
      labs: { y: "Population" },
      theme: "classic",
    };
    const svg = renderToSVGString(spec, { width: 640, height: 400 });
    const panelX = Number(svg.match(/class="gg-panel"[^>]*transform="translate\(([\d.]+)/)?.[1]);
    const titleX = yTitleTranslateX(svg);
    expect(panelX).toBeGreaterThan(60);
    // Wide labels raise titleOffset past the default 32 so the title stays clear.
    expect(panelX - titleX).toBeGreaterThan(32);
    expect(titleX).toBeLessThan(panelX);
    expect(titleX).toBeGreaterThanOrEqual(0);
  });

  it("does not inflate titleOffset when y tick labels are hidden", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      x: i,
      y: (i + 1) * 1_000_000,
    }));
    const spec: SpecInput = {
      data: { values: rows },
      layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
      labs: { y: "Population" },
      theme: "classic",
      guides: { y: { type: "axis", showLabels: false } },
    };
    const svg = renderToSVGString(spec, { width: 640, height: 400 });
    const panelX = Number(svg.match(/class="gg-panel"[^>]*transform="translate\(([\d.]+)/)?.[1]);
    const titleX = yTitleTranslateX(svg);
    // Labels hidden → default 32 (or clamp), not the wide-label band.
    expect(panelX - titleX).toBeLessThanOrEqual(32);
    expect(titleX).toBeGreaterThanOrEqual(0);
  });

  it("floors a synthetic titleOffset so rotated glyphs stay on-canvas", () => {
    const html = renderAxisTitles(sceneWithYTitle(40, 80));
    // Half of default axisTitleSize (11) keeps rotate(-90) ink inside the viewBox.
    expect(yTitleTranslateX(html)).toBe(resolveTheme().axisTitleSize / 2);
  });
});
