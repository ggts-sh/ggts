/**
 * Byte lock for the pure SVG renderer.
 *
 * Originally captured before the renderer split and deliberately refreshed
 * when public mark classes expand. Kitchen-sink covers every batch kind and
 * panel chrome so markup changes remain explicit.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { renderToSVGString } from "../src/render-svg-full.ts";

const goldenPath = join(import.meta.dirname, "fixtures/render-svg-golden.svg");

const rows = [
  { x: 1, y: 10, ymin: 8, ymax: 12, g: "a", cls: "u", label: "A" },
  { x: 2, y: 20, ymin: 16, ymax: 24, g: "a", cls: "v", label: "B" },
  { x: 1, y: 15, ymin: 12, ymax: 18, g: "b", cls: "u", label: "C" },
  { x: 2, y: 25, ymin: 20, ymax: 30, g: "b", cls: "v", label: "D" },
  { x: 3, y: 18, ymin: 14, ymax: 22, g: "a", cls: "u", label: "E" },
  { x: 3, y: 22, ymin: 18, ymax: 26, g: "b", cls: "v", label: "F" },
];

function kitchenSink() {
  return gg(rows, aes({ x: "x", y: "y", color: "cls", label: "label", ymin: "ymin", ymax: "ymax" }))
    .geomPoint({ size: 3, shape: "square", alpha: 0.9 })
    .geomLine({ curve: "step" })
    .geomArea({ alpha: 0.2 })
    .geomCol({ alpha: 0.35 })
    .geomErrorbar()
    .geomText({ size: 10 })
    .facet({ wrap: "g", ncol: 2 })
    .labs({
      title: "Golden kitchen-sink",
      subtitle: "covers marks+chrome",
      caption: "fixture v1",
      x: "X axis",
      y: "Y axis",
    });
}

describe("render-svg golden fixture (byte lock)", () => {
  it("matches the kitchen-sink SVG byte-for-byte", () => {
    const expected = readFileSync(goldenPath, "utf8");
    const actual = renderToSVGString(kitchenSink(), { width: 640, height: 400 });
    expect(actual).toBe(expected);
  });

  it("kitchen-sink still exercises all batch kinds and chrome surfaces", () => {
    const svg = renderToSVGString(kitchenSink(), { width: 640, height: 400 });
    for (const needle of [
      "gg-points",
      "gg-paths",
      "gg-areas",
      "gg-rects",
      "gg-segments",
      "gg-glyphs",
      "gg-strip",
      "gg-legend",
      "gg-title",
      "gg-subtitle",
      "gg-caption",
      "gg-axis",
      "gg-grid",
      "gg-clip-0",
    ]) {
      expect(svg).toContain(needle);
    }
  });
});
