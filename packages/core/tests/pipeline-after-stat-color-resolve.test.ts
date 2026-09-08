/**
 * after_stat color/fill resolution outside density_2d (#953).
 *
 * Stats already publish count/density/… columns; frame builders must wire
 * them into colorValues/fillValues so continuous scales train and legends
 * reflect the after-stat domain.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../src/pipeline.ts";
import type { PathsBatch, RectsBatch } from "../src/scene.ts";

const size = { width: 400, height: 300 };

function statChannelWarnings(warnings: readonly { code: string; message: string }[]): string[] {
  return warnings.filter((w) => w.code === "stat-channel-unsupported").map((w) => w.message);
}

describe("after_stat color/fill resolution (#953)", () => {
  it("maps fill = after_stat(count) on geom_histogram and trains a continuous fill scale", () => {
    const model = runPipeline(
      gg({ x: [1, 2, 2, 3, 3, 3, 4, 4, 4, 4] }, aes({ x: "x", fill: { stat: "count" } }))
        .geomHistogram({ binwidth: 1, boundary: 0.5 })
        .spec(),
      size,
    );
    expect(statChannelWarnings(model.warnings)).toEqual([]);
    expect(model.scales.fill?.kind).toBe("sequential");
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.kind).toBe("rects");
    expect(batch.fills).toBeDefined();
    // Uneven counts → more than one painted fill colour.
    expect(new Set(batch.fills).size).toBeGreaterThan(1);
    // Legend trains on the after-stat domain (continuous ramp for fill).
    const fillLegend = model.scene.legends.find((l) => l.scale === "fill");
    expect(fillLegend).toBeDefined();
    expect(fillLegend?.type).toBe("ramp");
  });

  it("resolves fill = after_stat(density) on geom_histogram", () => {
    const model = runPipeline(
      gg({ x: [1, 2, 2, 3, 3, 3] }, aes({ x: "x", fill: { stat: "density" } }))
        .geomHistogram({ binwidth: 1, boundary: 0.5 })
        .spec(),
      size,
    );
    expect(statChannelWarnings(model.warnings)).toEqual([]);
    expect(model.scales.fill?.kind).toBe("sequential");
    const batch = model.scene.batches[0] as RectsBatch;
    expect(new Set(batch.fills ?? []).size).toBeGreaterThan(1);
  });

  it("resolves fill = after_stat(ncount) and ndensity on geom_histogram", () => {
    // Histogram is bar geom: data colouring is fill, not outline color.
    for (const col of ["ncount", "ndensity"] as const) {
      const model = runPipeline(
        gg({ x: [1, 2, 2, 3, 3, 3, 4] }, aes({ x: "x", fill: { stat: col } }))
          .geomHistogram({ binwidth: 1, boundary: 0.5 })
          .spec(),
        size,
      );
      expect(statChannelWarnings(model.warnings)).toEqual([]);
      expect(model.scales.fill?.kind).toBe("sequential");
      const batch = model.scene.batches[0] as RectsBatch;
      expect(new Set(batch.fills ?? []).size).toBeGreaterThan(1);
    }
  });

  it("maps fill = after_stat(count) on geom_bar (stat count)", () => {
    const model = runPipeline(
      gg({ x: ["a", "a", "b", "c", "c", "c"] }, aes({ x: "x", fill: { stat: "count" } }))
        .geomBar()
        .spec(),
      size,
    );
    expect(statChannelWarnings(model.warnings)).toEqual([]);
    expect(model.scales.fill?.kind).toBe("sequential");
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.kind).toBe("rects");
    expect(new Set(batch.fills ?? []).size).toBeGreaterThan(1);
  });

  it("maps fill = after_stat(density) on geom_density", () => {
    const x = Array.from({ length: 80 }, (_, i) => Math.sin(i) * 2 + i * 0.05);
    const model = runPipeline(
      gg({ x }, aes({ x: "x", fill: { stat: "density" } }))
        .geomDensity()
        .spec(),
      size,
    );
    expect(statChannelWarnings(model.warnings)).toEqual([]);
    expect(model.scales.fill?.kind).toBe("sequential");
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.fills).toBeDefined();
    // Density area is one path; fill is still scaled from after_stat density.
    expect(batch.fills!.some((f) => f !== null && f !== undefined)).toBe(true);
  });
});
