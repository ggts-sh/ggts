/**
 * Parameterized suite over all declaration-only Geom* components.
 * Mounts each under GGPlot, asserts layer registration via the assembled
 * PortableSpec (toLayerInput path), and checks a representative param
 * forwards into layer.params.
 */
import { describe, expect, it } from "vitest";

import type { AesInput, GeomName } from "@ggts-sh/spec";

import type { PortableSpec } from "../../src/lib/index.js";
import GeomArea from "../../src/lib/geoms/GeomArea.svelte";
import GeomBar from "../../src/lib/geoms/GeomBar.svelte";
import GeomBoxplot from "../../src/lib/geoms/GeomBoxplot.svelte";
import GeomCol from "../../src/lib/geoms/GeomCol.svelte";
import GeomDensity from "../../src/lib/geoms/GeomDensity.svelte";
import GeomDotplot from "../../src/lib/geoms/GeomDotplot.svelte";
import GeomErrorbar from "../../src/lib/geoms/GeomErrorbar.svelte";
import GeomHistogram from "../../src/lib/geoms/GeomHistogram.svelte";
import GeomHline from "../../src/lib/geoms/GeomHline.svelte";
import GeomJitter from "../../src/lib/geoms/GeomJitter.svelte";
import GeomLine from "../../src/lib/geoms/GeomLine.svelte";
import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
import GeomRaster from "../../src/lib/geoms/GeomRaster.svelte";
import GeomRect from "../../src/lib/geoms/GeomRect.svelte";
import GeomRule from "../../src/lib/geoms/GeomRule.svelte";
import GeomSegment from "../../src/lib/geoms/GeomSegment.svelte";
import GeomViolin from "../../src/lib/geoms/GeomViolin.svelte";
import GeomFunction from "../../src/lib/geoms/GeomFunction.svelte";
import GeomPolygon from "../../src/lib/geoms/GeomPolygon.svelte";
import GeomSmooth from "../../src/lib/geoms/GeomSmooth.svelte";
import GeomStep from "../../src/lib/geoms/GeomStep.svelte";
import GeomText from "../../src/lib/geoms/GeomText.svelte";
import GeomLabel from "../../src/lib/geoms/GeomLabel.svelte";
import GeomTile from "../../src/lib/geoms/GeomTile.svelte";
import GeomVline from "../../src/lib/geoms/GeomVline.svelte";
import SingleGeomPlot from "../fixtures/SingleGeomPlot.svelte";
import { render } from "../helpers/render.js";

type GeomCase = {
  readonly name: string;
  readonly Component: typeof GeomPoint;
  readonly geom: GeomName;
  /** After normalize(), histogram becomes bar — expect the wire geom name. */
  readonly assembledGeom?: string;
  readonly data: readonly Record<string, unknown>[];
  readonly aes: AesInput;
  readonly geomProps: Record<string, unknown>;
  readonly paramKey: string;
  readonly paramValue: unknown;
  /** DOM smoke: at least one mark/path/text should appear when registration works. */
  readonly markSelector: string;
};

const xy = [
  { x: 1, y: 10, label: "a" },
  { x: 2, y: 20, label: "b" },
  { x: 3, y: 15, label: "c" },
  { x: 4, y: 25, label: "d" },
];

const cat = [
  { cat: "a", v: 3 },
  { cat: "b", v: 5 },
  { cat: "a", v: 1 },
  { cat: "b", v: 7 },
];

const box = [
  { cat: "a", v: 1 },
  { cat: "a", v: 2 },
  { cat: "a", v: 3 },
  { cat: "b", v: 4 },
  { cat: "b", v: 6 },
  { cat: "b", v: 9 },
];

const err = [
  { x: "a", ymin: 1, ymax: 3 },
  { x: "b", ymin: 2, ymax: 5 },
];

const cases: readonly GeomCase[] = [
  {
    name: "GeomPoint",
    Component: GeomPoint,
    geom: "point",
    data: xy,
    aes: { x: "x", y: "y" },
    geomProps: { size: 5, alpha: 0.8 },
    paramKey: "size",
    paramValue: 5,
    markSelector: ".gg-points circle",
  },
  {
    name: "GeomLine",
    Component: GeomLine,
    geom: "line",
    data: xy,
    aes: { x: "x", y: "y" },
    geomProps: { linewidth: 2, alpha: 0.9 },
    paramKey: "linewidth",
    paramValue: 2,
    markSelector: ".gg-paths path",
  },
  {
    name: "GeomCol",
    Component: GeomCol,
    geom: "col",
    data: cat,
    aes: { x: "cat", y: "v" },
    geomProps: { width: 0.7, alpha: 0.85 },
    paramKey: "width",
    paramValue: 0.7,
    markSelector: ".gg-rects rect",
  },
  {
    name: "GeomBar",
    Component: GeomBar,
    geom: "bar",
    data: cat,
    aes: { x: "cat" },
    geomProps: { width: 0.6, alpha: 0.7 },
    paramKey: "width",
    paramValue: 0.6,
    markSelector: ".gg-rects rect",
  },
  {
    name: "GeomArea",
    Component: GeomArea,
    geom: "area",
    data: xy,
    aes: { x: "x", y: "y" },
    geomProps: { alpha: 0.4 },
    paramKey: "alpha",
    paramValue: 0.4,
    markSelector: ".gg-areas path",
  },
  {
    name: "GeomRule",
    Component: GeomRule,
    geom: "rule",
    data: xy,
    aes: { x: "x", y: "y" },
    geomProps: { yintercept: 15, linewidth: 1.5 },
    paramKey: "yintercept",
    paramValue: 15,
    markSelector: ".gg-segments line",
  },
  {
    name: "GeomHline",
    Component: GeomHline,
    geom: "hline",
    assembledGeom: "rule",
    data: xy,
    aes: { x: "x", y: "y" },
    geomProps: { yintercept: 12, linewidth: 1.25 },
    paramKey: "yintercept",
    paramValue: 12,
    markSelector: ".gg-segments line",
  },
  {
    name: "GeomVline",
    Component: GeomVline,
    geom: "vline",
    assembledGeom: "rule",
    data: xy,
    aes: { x: "x", y: "y" },
    geomProps: { xintercept: 2, linewidth: 1.1 },
    paramKey: "xintercept",
    paramValue: 2,
    markSelector: ".gg-segments line",
  },
  {
    name: "GeomJitter",
    Component: GeomJitter,
    geom: "jitter",
    assembledGeom: "point",
    data: xy,
    aes: { x: "x", y: "y" },
    geomProps: { size: 4, alpha: 0.7, width: 0.15, seed: 3 },
    paramKey: "size",
    paramValue: 4,
    markSelector: ".gg-points circle",
  },
  {
    name: "GeomText",
    Component: GeomText,
    geom: "text",
    data: xy,
    aes: { x: "x", y: "y", label: "label" },
    geomProps: { size: 12, alpha: 0.95 },
    paramKey: "size",
    paramValue: 12,
    markSelector: ".gg-glyphs text",
  },
  {
    name: "GeomLabel",
    Component: GeomLabel,
    geom: "label",
    data: xy,
    aes: { x: "x", y: "y", label: "label" },
    geomProps: { size: 12, padding: 4, radius: 2 },
    paramKey: "padding",
    paramValue: 4,
    // Label chrome paints rounded rects before text (Batch.svelte parity
    // with the SVG-string serializer).
    markSelector: ".gg-glyphs rect",
  },
  {
    name: "GeomHistogram",
    Component: GeomHistogram,
    geom: "histogram",
    assembledGeom: "bar",
    data: xy,
    aes: { x: "x" },
    geomProps: { bins: 4, alpha: 0.6 },
    paramKey: "bins",
    paramValue: 4,
    markSelector: ".gg-rects rect",
  },
  {
    name: "GeomSmooth",
    Component: GeomSmooth,
    geom: "smooth",
    data: xy,
    aes: { x: "x", y: "y" },
    geomProps: { method: "lm", level: 0.9, alpha: 0.3 },
    paramKey: "method",
    paramValue: "lm",
    markSelector: ".gg-areas path, .gg-paths path",
  },
  {
    name: "GeomBoxplot",
    Component: GeomBoxplot,
    geom: "boxplot",
    data: box,
    aes: { x: "cat", y: "v" },
    geomProps: { width: 0.5, alpha: 0.8 },
    paramKey: "width",
    paramValue: 0.5,
    markSelector: ".gg-rects rect",
  },
  {
    name: "GeomDotplot",
    Component: GeomDotplot,
    geom: "dotplot",
    data: xy,
    aes: { x: "x" },
    geomProps: { binwidth: 1, stackdir: "up", alpha: 0.85 },
    paramKey: "binwidth",
    paramValue: 1,
    markSelector: ".gg-points circle",
  },
  {
    name: "GeomDensity",
    Component: GeomDensity,
    geom: "density",
    data: xy,
    aes: { x: "x" },
    geomProps: { n: 64, alpha: 0.35 },
    paramKey: "n",
    paramValue: 64,
    markSelector: ".gg-areas path",
  },
  {
    name: "GeomErrorbar",
    Component: GeomErrorbar,
    geom: "errorbar",
    data: err,
    aes: { x: "x", ymin: "ymin", ymax: "ymax" },
    geomProps: { width: 0.2, linewidth: 1.2 },
    paramKey: "width",
    paramValue: 0.2,
    markSelector: ".gg-segments line",
  },
  {
    name: "GeomRect",
    Component: GeomRect,
    geom: "rect",
    data: [
      { xmin: 0, xmax: 1, ymin: 0, ymax: 2 },
      { xmin: 1, xmax: 2, ymin: 1, ymax: 3 },
    ],
    aes: { xmin: "xmin", xmax: "xmax", ymin: "ymin", ymax: "ymax" },
    geomProps: { alpha: 0.6 },
    paramKey: "alpha",
    paramValue: 0.6,
    markSelector: ".gg-rects rect",
  },
  {
    name: "GeomTile",
    Component: GeomTile,
    geom: "tile",
    data: [
      { x: "a", y: "low", z: 1 },
      { x: "a", y: "high", z: 2 },
      { x: "b", y: "low", z: 3 },
      { x: "b", y: "high", z: 4 },
    ],
    aes: { x: "x", y: "y", fill: "z" },
    geomProps: { alpha: 0.9 },
    paramKey: "alpha",
    paramValue: 0.9,
    markSelector: ".gg-rects rect",
  },
  {
    name: "GeomRaster",
    Component: GeomRaster,
    geom: "raster",
    data: [
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 2 },
      { x: 0, y: 1, z: 3 },
      { x: 1, y: 1, z: 4 },
    ],
    aes: { x: "x", y: "y", fill: "z" },
    geomProps: { alpha: 0.85 },
    paramKey: "alpha",
    paramValue: 0.85,
    markSelector: ".gg-rects rect",
  },
  {
    name: "GeomSegment",
    Component: GeomSegment,
    geom: "segment",
    data: [
      { x: 0, y: 0, xend: 1, yend: 1 },
      { x: 1, y: 2, xend: 2, yend: 0 },
    ],
    aes: { x: "x", y: "y", xend: "xend", yend: "yend" },
    geomProps: { linewidth: 2, lineend: "round" },
    paramKey: "linewidth",
    paramValue: 2,
    markSelector: ".gg-segments line",
  },
  {
    name: "GeomViolin",
    Component: GeomViolin,
    geom: "violin",
    data: [
      { cat: "a", v: 1 },
      { cat: "a", v: 2 },
      { cat: "a", v: 3 },
      { cat: "b", v: 4 },
      { cat: "b", v: 5 },
      { cat: "b", v: 6 },
    ],
    aes: { x: "cat", y: "v" },
    geomProps: { alpha: 0.7, scale: "width", n: 32 },
    paramKey: "alpha",
    paramValue: 0.7,
    markSelector: ".gg-areas path",
  },
  {
    name: "GeomFunction",
    Component: GeomFunction,
    geom: "function",
    data: [{ dummy: 0 }],
    aes: {},
    geomProps: { fun: "dnorm", n: 21, xlim: [-2, 2], linewidth: 2 },
    paramKey: "fun",
    paramValue: "dnorm",
    markSelector: ".gg-paths path",
  },
  {
    name: "GeomPolygon",
    Component: GeomPolygon,
    geom: "polygon",
    data: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.5, y: 1 },
    ],
    aes: { x: "x", y: "y" },
    geomProps: { alpha: 0.7, linewidth: 1.5 },
    paramKey: "alpha",
    paramValue: 0.7,
    markSelector: ".gg-areas path",
  },
  {
    name: "GeomStep",
    Component: GeomStep,
    geom: "step",
    data: xy,
    aes: { x: "x", y: "y" },
    geomProps: { direction: "hv", linewidth: 2 },
    paramKey: "direction",
    paramValue: "hv",
    markSelector: ".gg-paths path",
  },
];

describe("Geom* declaration components (parameterized)", () => {
  it.each(cases)(
    "$name registers layer and forwards $paramKey into assembled layer params",
    (c) => {
      let assembled: PortableSpec | undefined;
      const { container } = render(SingleGeomPlot, {
        Geom: c.Component,
        geomProps: c.geomProps,
        data: c.data,
        aes: c.aes,
        onrender: (_model: unknown, spec: PortableSpec) => {
          assembled = spec;
        },
      });

      expect(assembled).toBeDefined();
      expect(assembled.layers).toHaveLength(1);
      const layer = assembled.layers[0];
      expect(layer.geom).toBe(c.assembledGeom ?? c.geom);
      expect(layer.params?.[c.paramKey]).toBe(c.paramValue);

      // Registration produced marks (not just a silent empty plot).
      expect(container.querySelector(c.markSelector)).not.toBeNull();
    },
  );
});

describe("GeomLabel box chrome (Svelte scene parity)", () => {
  it("paints rounded rects before text for geom_label", () => {
    const { container } = render(SingleGeomPlot, {
      Geom: GeomLabel,
      geomProps: {
        size: 12,
        padding: 4,
        radius: 3,
        linewidth: 1.5,
        aes: { fill: { value: "#b8c9e0" }, color: { value: "#0f172a" } },
      },
      data: xy,
      aes: { x: "x", y: "y", label: "label" },
    });

    const boxes = container.querySelectorAll(".gg-glyphs rect");
    const texts = container.querySelectorAll(".gg-glyphs text");
    expect(boxes.length).toBe(xy.length);
    expect(texts.length).toBe(xy.length);
    const first = boxes.item(0);
    expect(first).not.toBeNull();
    expect(first.getAttribute("fill")).toBe("#b8c9e0");
    expect(first.getAttribute("stroke")).toBe("#0f172a");
    expect(first.getAttribute("rx")).toBe("3");
  });

  it("does not paint label boxes for geom_text", () => {
    const { container } = render(SingleGeomPlot, {
      Geom: GeomText,
      geomProps: { size: 12 },
      data: xy,
      aes: { x: "x", y: "y", label: "label" },
    });

    expect(container.querySelectorAll(".gg-glyphs text").length).toBe(xy.length);
    expect(container.querySelectorAll(".gg-glyphs rect").length).toBe(0);
  });
});
