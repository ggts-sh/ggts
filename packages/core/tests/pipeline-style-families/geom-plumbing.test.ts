import { describe, expect, it } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";

import type { PortableSpec } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.js";
import { sceneToSVGString } from "../../src/render-svg-scene.js";

import { viewport } from "./fixtures.ts";

function pointStylesSpec(): PortableSpec {
  return fromAny({
    data: {
      values: [
        { x: 1, y: 1, amount: 0, opacity: 0, group: "a" },
        { x: 2, y: 2, amount: 50, opacity: 50, group: "b" },
        { x: 3, y: 3, amount: 100, opacity: 100, group: "c" },
      ],
    },
    aes: {
      x: { field: "x" },
      y: { field: "y" },
      size: { field: "amount" },
      alpha: { field: "opacity" },
      shape: { field: "group" },
    },
    layers: [{ geom: "point" }],
    scales: {
      size: { type: "sequential", range: [2, 10] },
      alpha: { type: "sequential", range: [0.2, 1] },
      shape: { type: "ordinal" },
    },
  });
}

describe("mapped style geom plumbing", () => {
  it("maps point size by area, alpha, and finite shapes into per-mark vectors", () => {
    const model = runPipeline(pointStylesSpec(), viewport);
    const points = model.scene.batches.find((batch) => batch.kind === "points");
    if (points?.kind !== "points") throw new Error("expected points batch");

    expect([...points.sizes!]).toEqual([2, Math.fround(Math.sqrt(52)), 10]);
    expect([...points.alphas!]).toEqual([Math.fround(0.2), Math.fround(0.6), 1]);
    expect([...points.shapeIndexes!]).toEqual([0, 1, 2]);

    const shapePlan = model.guidePlans.find((plan) => plan.aesthetic === "shape");
    if (shapePlan?.type !== "discrete") throw new Error("expected shape guide plan");
    expect(shapePlan.entries.map((entry) => entry.shape)).toEqual(["circle", "triangle", "square"]);
    expect(Object.isFrozen(shapePlan)).toBe(true);

    const svg = sceneToSVGString(model.scene);
    expect(svg).toContain('r="2"');
    expect(svg).toContain('opacity="0.2"');
    expect(svg).toContain("gg-shape-triangle");
    expect(svg).toContain("gg-shape-square");
    expect(svg).toContain('width="20" height="20"');
    expect(model.candidates.candidate(0)).toMatchObject({
      sizeValue: 0,
      alphaValue: 0,
      shapeValue: "a",
    });
  });

  it("maps linewidth, alpha, and linetype per subpath without reordering", () => {
    const model = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, series: "a", width: 1, opacity: 0.3 },
            { x: 2, y: 2, series: "a", width: 1, opacity: 0.3 },
            { x: 1, y: 2, series: "b", width: 5, opacity: 0.9 },
            { x: 2, y: 3, series: "b", width: 5, opacity: 0.9 },
          ],
        },
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          group: { field: "series" },
          linewidth: { field: "width" },
          alpha: { field: "opacity" },
          linetype: { field: "series" },
        },
        layers: [{ geom: "line" }],
        scales: {
          linewidth: { type: "identity" },
          alpha: { type: "identity" },
          linetype: { type: "ordinal" },
        },
      }),
      viewport,
    );
    const paths = model.scene.batches.find((batch) => batch.kind === "paths");
    if (paths?.kind !== "paths") throw new Error("expected paths batch");

    expect([...paths.linewidths!]).toEqual([1, 5]);
    expect([...paths.alphas!]).toEqual([Math.fround(0.3), Math.fround(0.9)]);
    expect([...paths.linetypeIndexes!]).toEqual([0, 1]);

    const svg = sceneToSVGString(model.scene);
    expect(svg).toContain('stroke-width="1"');
    expect(svg).toContain('stroke-width="5"');
    expect(svg).toContain('stroke-dasharray="6 4"');
    expect(svg).toContain('opacity="0.3"');
    expect(svg).toContain('opacity="0.9"');

    const varying = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, width: 1 },
            { x: 2, y: 2, width: 3 },
            { x: 3, y: 3, width: 2 },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, linewidth: { field: "width" } },
        layers: [{ geom: "line" }],
        scales: { linewidth: { type: "sequential", domain: [1, 3], range: [1, 5] } },
      }),
      viewport,
    );
    const varyingPaths = varying.scene.batches.find((batch) => batch.kind === "paths");
    if (varyingPaths?.kind !== "paths") throw new Error("expected varying paths");
    expect([...varyingPaths.pathOffsets]).toEqual([0, 2, 4]);
    expect([...varyingPaths.linewidths!]).toEqual([1, 5]);
    expect([...varyingPaths.frameRowIndex!]).toEqual([0, 1, 1, 2]);

    const afterStat = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 4 },
          ],
        },
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          linewidth: { stat: "y" },
        },
        layers: [{ geom: "smooth", params: { method: "lm", se: false } }],
        scales: { linewidth: { type: "identity" } },
      }),
      viewport,
    );
    const first = afterStat.candidates.candidate(1);
    const duplicate = afterStat.candidates.candidate(2);
    expect(first?.x).toBeCloseTo(duplicate?.x ?? Number.NaN);
    expect(duplicate?.xValue).toBe(first?.xValue);
    expect(duplicate?.linewidthValue).toBe(first?.linewidthValue);
  });

  it("uses mapped point radii for candidate hit regions", () => {
    const model = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, radius: 2 },
            { x: 2, y: 2, radius: 10 },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, size: { field: "radius" } },
        layers: [{ geom: "point" }],
        scales: { size: { type: "identity" } },
      }),
      viewport,
    );
    const points = model.scene.batches.find((batch) => batch.kind === "points");
    if (points?.kind !== "points") throw new Error("expected points batch");
    const smallX = points.positions[0]! + model.scene.panels[0]!.x;
    const smallY = points.positions[1]! + model.scene.panels[0]!.y;
    const largeX = points.positions[2]! + model.scene.panels[0]!.x;
    const largeY = points.positions[3]! + model.scene.panels[0]!.y;

    expect(model.candidates.hitTest(smallX + 6, smallY)).toBeNull();
    expect(model.candidates.hitTest(largeX + 6, largeY)?.rowIndex).toBe(1);

    const plus = runPipeline(
      fromAny({
        data: { values: [{ x: 1, y: 1, radius: 20 }] },
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          size: { field: "radius" },
          shape: { value: "plus" },
        },
        layers: [{ geom: "point" }],
        scales: { size: { type: "identity" } },
      }),
      viewport,
    );
    const plusPoints = plus.scene.batches.find((batch) => batch.kind === "points");
    if (plusPoints?.kind !== "points") throw new Error("expected plus point");
    const plusPanel = plus.scene.panels[0]!;
    expect(
      plus.candidates.hitTest(
        plusPanel.x + plusPoints.positions[0]! + 24,
        plusPanel.y + plusPoints.positions[1]!,
      )?.rowIndex,
    ).toBe(0);
  });

  it("maps alpha through rectangles and size/alpha through text glyphs", () => {
    const bars = runPipeline(
      fromAny({
        data: {
          values: [
            { x: "a", y: 1, opacity: 0.2 },
            { x: "b", y: 2, opacity: 0.8 },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, alpha: { field: "opacity" } },
        layers: [{ geom: "col" }],
        scales: { alpha: { type: "identity" } },
      }),
      viewport,
    );
    const rects = bars.scene.batches.find((batch) => batch.kind === "rects");
    if (rects?.kind !== "rects") throw new Error("expected rects batch");
    expect([...rects.alphas!]).toEqual([Math.fround(0.2), Math.fround(0.8)]);

    const mappedOverridesParam = runPipeline(
      fromAny({
        data: { values: [{ x: 1, y: 1, opacity: 0.8 }] },
        aes: { x: { field: "x" }, y: { field: "y" }, alpha: { field: "opacity" } },
        layers: [{ geom: "point", params: { alpha: 0.1 } }],
        scales: { alpha: { type: "identity" } },
      }),
      viewport,
    );
    const mappedPoint = mappedOverridesParam.scene.batches.find((batch) => batch.kind === "points");
    if (mappedPoint?.kind !== "points") throw new Error("expected mapped point");
    expect(mappedPoint.alpha).toBe(1);
    expect([...mappedPoint.alphas!]).toEqual([Math.fround(0.8)]);

    const text = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, label: "small", size: 8, opacity: 0.25 },
            { x: 2, y: 2, label: "large", size: 18, opacity: 0.75 },
          ],
        },
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          label: { field: "label" },
          size: { field: "size" },
          alpha: { field: "opacity" },
        },
        layers: [{ geom: "text" }],
        scales: { size: { type: "identity" }, alpha: { type: "identity" } },
      }),
      viewport,
    );
    const glyphs = text.scene.batches.find((batch) => batch.kind === "glyphs");
    if (glyphs?.kind !== "glyphs") throw new Error("expected glyph batch");
    expect([...glyphs.sizes!]).toEqual([8, 18]);
    expect([...glyphs.alphas!]).toEqual([Math.fround(0.25), Math.fround(0.75)]);
    expect(sceneToSVGString(text.scene)).toContain('font-size="18"');
  });

  it("maps rule stroke styles and uses mapped widths for stroke hit regions", () => {
    const model = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, width: 1, opacity: 0.3, kind: "solid" },
            { x: 2, width: 8, opacity: 0.9, kind: "dashed" },
          ],
        },
        aes: {
          x: { field: "x" },
          linewidth: { field: "width" },
          alpha: { field: "opacity" },
          linetype: { field: "kind" },
        },
        layers: [{ geom: "rule" }],
        scales: {
          linewidth: { type: "identity" },
          alpha: { type: "identity" },
          linetype: { type: "identity" },
        },
      }),
      viewport,
    );
    const segments = model.scene.batches.find((batch) => batch.kind === "segments");
    if (segments?.kind !== "segments") throw new Error("expected segments batch");
    expect([...segments.linewidths!]).toEqual([1, 8]);
    expect([...segments.linetypeIndexes!]).toEqual([0, 1]);
    expect([...segments.alphas!]).toEqual([Math.fround(0.3), Math.fround(0.9)]);
    const panel = model.scene.panels[0]!;
    const wideX = panel.x + segments.segments[4]!;
    const wideY = panel.y + (segments.segments[5]! + segments.segments[7]!) / 2;
    expect(model.candidates.hitTest(wideX + 5, wideY)?.rowIndex).toBe(1);
  });

  it("carries stroke styles through area, smooth, errorbar, and boxplot composite batches", () => {
    const sharedScales = {
      linewidth: { type: "ordinal", range: [1, 4] },
      alpha: { type: "ordinal", range: [0.4, 1] },
      linetype: { type: "ordinal", range: ["solid", "dashed"] },
    };
    const styleAes = {
      linewidth: { field: "group" },
      alpha: { field: "group" },
      linetype: { field: "group" },
    };
    const area = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, group: "a" },
            { x: 2, y: 2, group: "a" },
            { x: 1, y: 2, group: "b" },
            { x: 2, y: 3, group: "b" },
          ],
        },
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          alpha: { field: "group" },
        },
        layers: [{ geom: "area", position: "identity" }],
        scales: { alpha: sharedScales.alpha },
      }),
      viewport,
    );
    const areaPaths = area.scene.batches.find((batch) => batch.kind === "paths");
    if (areaPaths?.kind !== "paths") throw new Error("expected area paths");
    expect(areaPaths.alphas).toBeDefined();

    const smooth = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, group: "a" },
            { x: 2, y: 2, group: "a" },
            { x: 1, y: 2, group: "b" },
            { x: 2, y: 4, group: "b" },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, ...styleAes },
        layers: [{ geom: "smooth", params: { method: "lm", se: false } }],
        scales: sharedScales,
      }),
      viewport,
    );
    const smoothPaths = smooth.scene.batches.find((batch) => batch.kind === "paths");
    if (smoothPaths?.kind !== "paths") throw new Error("expected smooth paths");
    expect(smoothPaths.linewidths).toBeDefined();
    expect(smoothPaths.alphas).toBeDefined();
    expect(smoothPaths.linetypeIndexes).toBeDefined();

    const errorbar = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 2, ymin: 1, ymax: 3, group: "a" },
            { x: 2, y: 3, ymin: 2, ymax: 4, group: "b" },
          ],
        },
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          ymin: { field: "ymin" },
          ymax: { field: "ymax" },
          ...styleAes,
        },
        layers: [{ geom: "errorbar" }],
        scales: sharedScales,
      }),
      viewport,
    );
    const errorSegments = errorbar.scene.batches.find((batch) => batch.kind === "segments");
    if (errorSegments?.kind !== "segments") throw new Error("expected errorbar segments");
    expect(errorSegments.linewidths).toBeDefined();
    expect(errorSegments.alphas).toBeDefined();
    expect(errorSegments.linetypeIndexes).toBeDefined();

    const boxplot = runPipeline(
      fromAny({
        data: {
          values: [
            { x: "a", y: 1, group: "a" },
            { x: "a", y: 2, group: "a" },
            { x: "a", y: 3, group: "a" },
            { x: "b", y: 2, group: "b" },
            { x: "b", y: 3, group: "b" },
            { x: "b", y: 5, group: "b" },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, ...styleAes },
        layers: [{ geom: "boxplot" }],
        scales: sharedScales,
      }),
      viewport,
    );
    const boxSegments = boxplot.scene.batches.find((batch) => batch.kind === "segments");
    const boxRects = boxplot.scene.batches.find((batch) => batch.kind === "rects");
    if (boxSegments?.kind !== "segments" || boxRects?.kind !== "rects") {
      throw new Error("expected boxplot composite batches");
    }
    expect(boxSegments.linewidths).toBeDefined();
    expect(boxSegments.alphas).toBeDefined();
    expect(boxSegments.linetypeIndexes).toBeDefined();
    expect(boxRects.alphas).toBeDefined();
    expect(boxRects.strokeWidths).toBeDefined();
    expect(boxRects.linetypeIndexes).toBeDefined();
  });

  it("applies literal and scaled styles to annotation rules and boxplot outlines", () => {
    const annotation = runPipeline(
      fromAny({
        data: { values: [{ x: 1, y: 1 }] },
        layers: [
          {
            geom: "rule",
            aes: {
              linewidth: { value: 5, scale: true },
              alpha: { value: 0.4, scale: true },
              linetype: { value: "dashed", scale: true },
            },
            params: { yintercept: 0.5 },
          },
        ],
        scales: {
          linewidth: { type: "identity" },
          alpha: { type: "identity" },
          linetype: { type: "identity" },
        },
      }),
      viewport,
    );
    const rule = annotation.scene.batches.find((batch) => batch.kind === "segments");
    if (rule?.kind !== "segments") throw new Error("expected annotation rule");
    expect([...rule.linewidths!]).toEqual([5]);
    expect([...rule.alphas!]).toEqual([Math.fround(0.4)]);
    expect([...rule.linetypeIndexes!]).toEqual([1]);

    const boxplot = runPipeline(
      fromAny({
        data: {
          values: [
            { x: "a", y: 1 },
            { x: "a", y: 2 },
            { x: "a", y: 3 },
          ],
        },
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          linetype: { value: "dashed" },
        },
        layers: [{ geom: "boxplot" }],
      }),
      viewport,
    );
    const segments = boxplot.scene.batches.filter((batch) => batch.kind === "segments");
    const rects = boxplot.scene.batches.find((batch) => batch.kind === "rects");
    if (segments.length === 0 || rects?.kind !== "rects") {
      throw new Error("expected boxplot segments and rects");
    }
    for (const batch of segments) {
      if (batch.kind !== "segments") continue;
      expect(batch.linetype).toBe("dashed");
    }
    expect(rects.linetype).toBe("dashed");
  });
});
