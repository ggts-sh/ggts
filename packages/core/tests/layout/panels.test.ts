/**
 * Direct tests for layoutPanels — the single owner of panel placement,
 * chrome, and axis guides (#1076). No runPipeline; no scene assembly
 * except the one end-to-end call-count check.
 */
import { describe, expect, it, spyOn } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";
import type { PortableSpec } from "@ggts-sh/spec";

import {
  layoutPanels,
  type FacetScaleFreedom,
  type PanelLayout,
  type PanelLayoutInput,
  type PanelPlacement,
} from "../../src/layout/panels.ts";
import * as guideConfig from "../../src/pipeline/guide-config.ts";
import type { AxisGuideAppearance } from "../../src/pipeline/guide-config.ts";
import { runPipeline } from "../../src/pipeline.ts";
import { trainLinear } from "../../src/scales/train.ts";
import { resolveTheme } from "../../src/theme.ts";

const guide = (over: Partial<AxisGuideAppearance> = {}): AxisGuideAppearance => ({
  visible: true,
  showTicks: true,
  showLabels: true,
  collision: "auto",
  ...over,
});

function linearScale(min = 0, max = 10) {
  return trainLinear([new Float64Array([min, max])]).scale;
}

function baseInput(over: Partial<PanelLayoutInput> = {}): PanelLayoutInput {
  const xScale = linearScale();
  const yScale = linearScale(0, 100);
  const labs: NonNullable<PortableSpec["labs"]> = {
    x: "X",
    y: "Y",
    ...over.labs,
  };
  return {
    flip: false,
    faceted: false,
    freedom: { freeX: false, freeY: false },
    nrow: 1,
    ncol: 1,
    facetPanels: [],
    panelScales: [{ x: xScale, y: yScale }],
    allFrames: [],
    hGuide: guide(),
    vGuide: guide(),
    scalesConfig: {},
    xScale,
    yScale,
    xTemporalKind: null,
    yTemporalKind: null,
    xTemporalPrecision: null,
    yTemporalPrecision: null,
    legendInputs: [],
    legendOrder: "stable-domain",
    theme: resolveTheme("default"),
    layoutAxisTitleSize: 12,
    layoutAxisTextSize: 10,
    options: { width: 640, height: 400 },
    warnings: [],
    ...over,
    labs,
  };
}

describe("layoutPanels", () => {
  it("is callable with a hand-built input (no runPipeline, no scene)", () => {
    const freedom: FacetScaleFreedom = { freeX: false, freeY: false };
    const result: PanelLayout = layoutPanels(baseInput({ freedom }));
    const panel: PanelPlacement = result.placements[0]!;
    expect(result.placements).toHaveLength(1);
    expect(panel.width).toBeGreaterThan(200);
    expect(panel.height).toBeGreaterThan(150);
    expect(result.guides.h.visible).toBe(true);
    expect(result.guides.v.visible).toBe(true);
    expect(result.hTitle).toBe("X");
    expect(result.vTitle).toBe("Y");
    expect(result.freeH).toBe(false);
    expect(result.freeV).toBe(false);
    expect(result.degraded).toBe(false);
  });

  it("swaps titles, free flags, formatters, and guide assignment under coord flip", () => {
    const xGuide = guide({ title: "guide-x" });
    const yGuide = guide({ title: "guide-y" });
    // Display guides are already flipped by the caller (finalize-layout-pass).
    const result = layoutPanels(
      baseInput({
        flip: true,
        freedom: { freeX: true, freeY: false },
        labs: { x: "X", y: "Y" },
        hGuide: yGuide,
        vGuide: xGuide,
        scalesConfig: {
          x: { labels: ".1f" },
          y: { labels: ".3f" },
        },
      }),
    );
    expect(result.hTitle).toBe("Y");
    expect(result.vTitle).toBe("X");
    // freeX true, freeY false + flip → freeH = freeY = false, freeV = freeX = true
    expect(result.freeH).toBe(false);
    expect(result.freeV).toBe(true);
    expect(result.guides.h).toBe(yGuide);
    expect(result.guides.v).toBe(xGuide);
    // Aesthetic formatters stay on formatX/Y; display formatters flip with the coord.
    expect(result.formatters.h).toBe(result.formatY);
    expect(result.formatters.v).toBe(result.formatX);
    expect(typeof result.formatters.h).toBe("function");
    expect(typeof result.formatters.v).toBe("function");
    expect(result.formatters.h?.(1, 0.001)).toBe(result.formatY?.(1, 0.001));
    expect(result.formatters.v?.(1, 0.1)).toBe(result.formatX?.(1, 0.1));
  });

  it("carries free_x freedom into display free flags without flip", () => {
    const result = layoutPanels(
      baseInput({
        freedom: { freeX: true, freeY: false },
      }),
    );
    expect(result.freeH).toBe(true);
    expect(result.freeV).toBe(false);
  });

  it("fits the largest exact centred fixed-aspect rectangle", () => {
    // Equal scale-space spans so ratio:1 yields a square data rectangle.
    const xScale = linearScale(0, 10);
    const yScale = linearScale(0, 10);
    const result = layoutPanels(
      baseInput({
        xScale,
        yScale,
        panelScales: [{ x: xScale, y: yScale }],
        coordFixed: { type: "fixed", ratio: 1 },
        options: { width: 640, height: 400 },
      }),
    );
    const panel = result.placements[0]!;
    expect(panel.allocation).toBeDefined();
    const allocation = panel.allocation!;
    expect(panel.height / panel.width).toBeCloseTo(1, 10);
    expect(panel.x).toBeCloseTo(allocation.x + (allocation.width - panel.width) / 2, 10);
    expect(panel.y).toBeCloseTo(allocation.y + (allocation.height - panel.height) / 2, 10);
    expect(result.degraded).toBe(false);
  });

  it("marks degraded when the fixed-aspect rectangle falls below 64px readable minimum", () => {
    const warnings: { code: string }[] = [];
    const result = layoutPanels(
      baseInput({
        coordFixed: { type: "fixed", ratio: 1 },
        // Tiny plot → chrome leaves a sub-64px data rectangle.
        options: { width: 80, height: 80 },
        warnings: warnings as never,
      }),
    );
    expect(result.degraded).toBe(true);
    expect(warnings.some((w) => w.code === "coord-fixed-degraded")).toBe(true);
  });

  it("resolveAxisGuide is called once per axis per runPipeline (not again in scene assembly)", () => {
    const spy = spyOn(guideConfig, "resolveAxisGuide");
    try {
      runPipeline(
        gg(
          [
            { x: 1, y: 10 },
            { x: 2, y: 20 },
          ],
          aes({ x: "x", y: "y" }),
        )
          .geomPoint()
          .spec(),
        { width: 640, height: 400 },
      );
      const xCalls = spy.mock.calls.filter((call) => call[0] === "x");
      const yCalls = spy.mock.calls.filter((call) => call[0] === "y");
      expect(xCalls).toHaveLength(1);
      expect(yCalls).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});
