/**
 * Size area / radius rescaling (#830).
 */
import { describe, expect, it } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";

import type { PortableSpec } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.js";

const viewport = { width: 640, height: 400 };

function sizesFor(amounts: readonly number[], sizeScale: Record<string, unknown>): number[] {
  const spec = fromAny({
    data: {
      values: amounts.map((amount, i) => ({ x: i, y: 1, amount })),
    },
    aes: {
      x: { field: "x" },
      y: { field: "y" },
      size: { field: "amount" },
    },
    layers: [{ geom: "point" }],
    scales: { size: sizeScale },
  }) as PortableSpec;
  const model = runPipeline(spec, viewport);
  const points = model.scene.batches.find((batch) => batch.kind === "points");
  if (points?.kind !== "points") throw new Error("expected points batch");
  return [...points.sizes!];
}

describe("size area / radius mapping (#830)", () => {
  it("scale_size_area maps zero to zero radius and max to max radius", () => {
    const out = sizesFor([0, 25, 100], {
      type: "sequential",
      sizeUnit: "area_zero",
      range: [0, 10],
    });
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[2]).toBeCloseTo(10, 5);
    expect(out[1]).toBeCloseTo(5, 5);
  });

  it("scale_radius maps linearly between range endpoints", () => {
    const out = sizesFor([0, 50, 100], {
      type: "sequential",
      sizeUnit: "radius",
      range: [1, 5],
    });
    expect(out[0]).toBeCloseTo(1, 5);
    expect(out[1]).toBeCloseTo(3, 5);
    expect(out[2]).toBeCloseTo(5, 5);
  });

  it("default continuous size still interpolates by area between range ends", () => {
    const out = sizesFor([0, 50, 100], { type: "sequential", range: [2, 10] });
    expect(out[0]).toBeCloseTo(2, 5);
    expect(out[2]).toBeCloseTo(10, 5);
    expect(out[1]).toBeCloseTo(Math.sqrt(52), 5);
  });

  it("area_zero with reverse does not collapse every bubble to zero", () => {
    const out = sizesFor([0, 25, 100], {
      type: "sequential",
      sizeUnit: "area_zero",
      range: [0, 10],
      reverse: true,
    });
    // reverse swaps range to [10, 0] → max·√(1−t): domain min is largest radius
    expect(out[0]).toBeCloseTo(10, 5);
    expect(out[2]).toBeCloseTo(0, 5);
    // t=0.25 → 10·√0.75
    expect(out[1]).toBeCloseTo(10 * Math.sqrt(0.75), 5);
  });
});
