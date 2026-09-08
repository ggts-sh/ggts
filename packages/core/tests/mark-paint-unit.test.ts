/**
 * Pure unit tests for mark-paint helpers (#591).
 * Pipeline/SVG coverage lives in mark-paint.test.ts; this file locks
 * radial resolve/defs, canvas gradient mapping, and subpath AABB math.
 */
import { describe, expect, it } from "bun:test";
import type { GradientPaint, GlowSpec } from "@ggts-sh/spec";

import {
  canvasGradientStyle,
  layerPaintFromParams,
  paintDefsSvg,
  paintResourceId,
  resolveGlow,
  resolveGradientPaint,
  subpathBounds,
  type ResolvedGradientPaint,
} from "../src/mark-paint.ts";

const linearPaint: GradientPaint = {
  type: "linear",
  x1: 0,
  y1: 0,
  x2: 1,
  y2: 0,
  space: "mark",
  stops: [
    { offset: 0, color: "#112233", opacity: 1 },
    { offset: 1, color: "#aabbcc", opacity: 0.5 },
  ],
  fallback: "#112233",
};

const radialPaint: GradientPaint = {
  type: "radial",
  cx: 0.5,
  cy: 0.5,
  r: 0.5,
  space: "mark",
  stops: [
    { offset: 0, color: "#fff" },
    { offset: 1, color: "#000", opacity: 0.25 },
  ],
  fallback: "#888888",
};

function gradientRecordingContext() {
  const gradients: {
    kind: "linear" | "radial";
    args: number[];
    stops: { offset: number; color: string }[];
  }[] = [];
  const ctx = {
    createLinearGradient(...args: number[]) {
      const stops: { offset: number; color: string }[] = [];
      gradients.push({ kind: "linear", args: [...args], stops });
      return {
        addColorStop(offset: number, color: string) {
          stops.push({ offset, color });
        },
      };
    },
    createRadialGradient(...args: number[]) {
      const stops: { offset: number; color: string }[] = [];
      gradients.push({ kind: "radial", args: [...args], stops });
      return {
        addColorStop(offset: number, color: string) {
          stops.push({ offset, color });
        },
      };
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, gradients };
}

describe("layerPaintFromParams", () => {
  it("returns null paints for non-record params", () => {
    expect(layerPaintFromParams(null)).toEqual({
      fillPaint: null,
      strokePaint: null,
      glow: null,
    });
    expect(layerPaintFromParams("nope")).toEqual({
      fillPaint: null,
      strokePaint: null,
      glow: null,
    });
  });

  it("rejects glow bags missing color, radius, or opacity", () => {
    const incomplete = layerPaintFromParams({
      glow: { color: "#00aaff", radius: 4 },
    });
    expect(incomplete.glow).toBeNull();

    const wrongType = layerPaintFromParams({
      glow: { color: "#00aaff", radius: "wide", opacity: 0.5 },
    });
    expect(wrongType.glow).toBeNull();
  });

  it("extracts validated fillPaint, strokePaint, and glow", () => {
    const glow: GlowSpec = { color: "#00aaff", radius: 6, opacity: 0.4 };
    const got = layerPaintFromParams({
      fillPaint: linearPaint,
      strokePaint: radialPaint,
      glow,
    });
    expect(got.fillPaint).toEqual(linearPaint);
    expect(got.strokePaint).toEqual(radialPaint);
    expect(got.glow).toEqual(glow);
  });
});

describe("resolveGradientPaint / resolveGlow", () => {
  it("resolves radial paint with stable id and default mark space", () => {
    const noSpace: GradientPaint = {
      type: "radial",
      cx: 0.25,
      cy: 0.75,
      r: 0.4,
      stops: [{ offset: 0, color: "#abc" }],
      fallback: "#abc",
    };
    const resolved = resolveGradientPaint(noSpace, 2, "fill", 1);
    expect(resolved).toMatchObject({
      kind: "radial",
      space: "mark",
      cx: 0.25,
      cy: 0.75,
      r: 0.4,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      id: paintResourceId(2, "fill", 1),
      fallback: "#abc",
    });
    expect(resolved.stops[0]).toEqual({ offset: 0, color: "#abc", opacity: 1 });
  });

  it("resolves linear paint and glow resource ids", () => {
    const linear = resolveGradientPaint(linearPaint, 0, "stroke");
    expect(linear.kind).toBe("linear");
    expect(linear.id).toBe("gg-paint-l0-p0-stroke");
    expect(linear.stops[1]?.opacity).toBe(0.5);

    const glow = resolveGlow({ color: "#ff0", radius: 3, opacity: 1 }, 4, 2);
    expect(glow).toEqual({
      color: "#ff0",
      radius: 3,
      opacity: 1,
      id: "gg-paint-l4-p2-glow",
    });
  });
});

describe("paintDefsSvg", () => {
  it("emits radialGradient, stop-opacity only when opacity < 1, and glow filter", () => {
    const radial = resolveGradientPaint(radialPaint, 0, "fill");
    const linear = resolveGradientPaint({ ...linearPaint, space: "panel" }, 0, "stroke");
    const glow = resolveGlow({ color: "#00aaff", radius: 4, opacity: 0.5 }, 0);
    const svg = paintDefsSvg([radial, linear], [glow]);

    expect(svg).toContain(`id="${radial.id}"`);
    expect(svg).toContain("radialGradient");
    expect(svg).toContain('gradientUnits="objectBoundingBox"');
    expect(svg).toContain(`cx="${String(radial.cx)}"`);
    expect(svg).toContain(`r="${String(radial.r)}"`);
    // Full-opacity stop omits stop-opacity; partial keeps it.
    expect(svg).toContain('stop-color="#fff"');
    expect(svg).not.toMatch(/stop-color="#fff"[^>]*stop-opacity/);
    expect(svg).toContain('stop-opacity="0.25"');
    expect(svg).toContain('gradientUnits="userSpaceOnUse"');
    expect(svg).toContain(`id="${glow.id}"`);
    expect(svg).toContain("feGaussianBlur");
    expect(svg).toContain(`flood-color="${glow.color}"`);
  });
});

describe("canvasGradientStyle", () => {
  const bounds = { x: 10, y: 20, width: 100, height: 50 };

  it("maps mark-space linear coords through bounds", () => {
    const { ctx, gradients } = gradientRecordingContext();
    const paint = resolveGradientPaint(linearPaint, 0, "fill");
    const style = canvasGradientStyle(ctx, paint, bounds);
    expect(style).not.toBeTypeOf("string");
    expect(gradients).toHaveLength(1);
    expect(gradients[0]).toMatchObject({
      kind: "linear",
      args: [10, 20, 110, 20],
    });
    expect(gradients[0]!.stops).toEqual([
      { offset: 0, color: "#112233" },
      { offset: 1, color: "rgba(170,187,204,0.5)" },
    ]);
  });

  it("maps mark-space radial coords and radius, baking short hex opacity", () => {
    const { ctx, gradients } = gradientRecordingContext();
    const paint = resolveGradientPaint(radialPaint, 0, "fill");
    canvasGradientStyle(ctx, paint, bounds);
    expect(gradients[0]).toMatchObject({
      kind: "radial",
      // r * max(width, height) = 0.5 * 100 = 50
      args: [60, 45, 0, 60, 45, 50],
    });
    expect(gradients[0]!.stops[1]?.color).toBe("rgba(0,0,0,0.25)");
  });

  it("uses absolute panel-space coords without remapping", () => {
    const { ctx, gradients } = gradientRecordingContext();
    const panel: ResolvedGradientPaint = {
      kind: "linear",
      space: "panel",
      x1: 3,
      y1: 4,
      x2: 5,
      y2: 6,
      cx: 0,
      cy: 0,
      r: 0,
      stops: [{ offset: 0, color: "#ff0000", opacity: 1 }],
      fallback: "#ff0000",
      id: "gg-paint-l0-p0-stroke",
    };
    canvasGradientStyle(ctx, panel, bounds);
    expect(gradients[0]?.args).toEqual([3, 4, 5, 6]);
    expect(gradients[0]?.stops).toEqual([{ offset: 0, color: "#ff0000" }]);
  });
});

describe("subpathBounds", () => {
  it("returns axis-aligned bounds for a vertex range", () => {
    const positions = Float32Array.from([0, 0, 10, 2, 4, 8, 1, 1]);
    expect(subpathBounds(positions, 1, 3)).toEqual({
      x: 4,
      y: 2,
      width: 6,
      height: 6,
    });
  });

  it("returns unit box when the range is empty", () => {
    const positions = Float32Array.from([1, 2]);
    expect(subpathBounds(positions, 0, 0)).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });
});
