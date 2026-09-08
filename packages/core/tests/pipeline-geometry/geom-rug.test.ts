/**
 * geom_rug — marginal ticks along panel edges (#806).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg, validate } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import type { SegmentsBatch } from "../../src/scene.ts";

const size = { width: 200, height: 100 };

function rugBatch(
  data: Record<string, number[]>,
  mapping: { x?: string; y?: string },
  params?: { sides?: string; length?: number },
): SegmentsBatch {
  const model = runPipeline(
    gg(data, aes(mapping))
      .geomRug(params ?? {})
      .spec(),
    size,
  );
  const batch = model.scene.batches.find((b) => b.kind === "segments");
  if (batch?.kind !== "segments") throw new Error("expected segments batch");
  return batch;
}

function segmentTuples(batch: SegmentsBatch): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < batch.segments.length; i += 4) {
    out.push([
      batch.segments[i]!,
      batch.segments[i + 1]!,
      batch.segments[i + 2]!,
      batch.segments[i + 3]!,
    ]);
  }
  return out;
}

describe("geom_rug schema (#806)", () => {
  it("accepts rug with x only and sides b", () => {
    const result = validate({
      data: { values: [{ x: 1 }] },
      aes: { x: { field: "x" } },
      layers: [{ geom: "rug", params: { sides: "b" } }],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects invalid sides characters", () => {
    const result = validate({
      data: { values: [{ x: 1 }] },
      aes: { x: { field: "x" } },
      layers: [{ geom: "rug", params: { sides: "bx" } }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects empty sides", () => {
    const result = validate({
      data: { values: [{ x: 1 }] },
      aes: { x: { field: "x" } },
      layers: [{ geom: "rug", params: { sides: "" } }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects length outside (0, 1]", () => {
    const zero = validate({
      data: { values: [{ x: 1 }] },
      aes: { x: { field: "x" } },
      layers: [{ geom: "rug", params: { sides: "b", length: 0 } }],
    });
    expect(zero.ok).toBe(false);
    const over = validate({
      data: { values: [{ x: 1 }] },
      aes: { x: { field: "x" } },
      layers: [{ geom: "rug", params: { sides: "b", length: 1.5 } }],
    });
    expect(over.ok).toBe(false);
  });

  it("errors when default sides bl need y but only x is mapped", () => {
    // Tier-2 structural checks are opt-in via options argument.
    const result = validate(
      {
        data: { values: [{ x: 1 }] },
        aes: { x: { field: "x" } },
        layers: [{ geom: "rug" }],
      },
      {},
    );
    expect(result.ok).toBe(false);
  });

  it("builder geomRug emits rug layer", () => {
    const spec = gg({ x: [1, 2] }, aes({ x: "x" }))
      .geomRug({ sides: "b" })
      .spec();
    expect(spec.layers[0]?.geom).toBe("rug");
    expect(spec.layers[0]?.params).toMatchObject({ sides: "b" });
  });
});

describe("geom_rug geometry (#806)", () => {
  it("emits vertical bottom ticks for sides b", () => {
    const batch = rugBatch({ x: [0, 1] }, { x: "x" }, { sides: "b", length: 0.1 });
    const segs = segmentTuples(batch);
    expect(segs).toHaveLength(2);
    // Panel height is less than outer height; ticks start at bottom and go up.
    for (const [x0, y0, x1, y1] of segs) {
      expect(x0).toBeCloseTo(x1, 5);
      expect(y0).toBeGreaterThan(y1); // bottom → inward (y decreases in SVG)
    }
    const len0 = Math.abs(segs[0]![1] - segs[0]![3]);
    const len1 = Math.abs(segs[1]![1] - segs[1]![3]);
    expect(len0).toBeCloseTo(len1, 5);
    // Length is ~0.1 of panel height — not full panel.
    expect(len0).toBeGreaterThan(0);
    expect(len0).toBeLessThan(size.height * 0.5);
  });

  it("emits only top and right for sides tr", () => {
    const batch = rugBatch(
      { x: [0, 1], y: [0, 1] },
      { x: "x", y: "y" },
      { sides: "tr", length: 0.1 },
    );
    const segs = segmentTuples(batch);
    // 2 top (vertical) + 2 right (horizontal)
    expect(segs).toHaveLength(4);
    const vertical = segs.filter(([x0, , x1]) => Math.abs(x0 - x1) < 1e-6);
    const horizontal = segs.filter(([, y0, , y1]) => Math.abs(y0 - y1) < 1e-6);
    expect(vertical).toHaveLength(2);
    expect(horizontal).toHaveLength(2);
    // Top ticks start near y=0 and go down (y increases).
    for (const [, y0, , y1] of vertical) {
      expect(y1).toBeGreaterThan(y0);
    }
    // Right ticks start near right edge and go left.
    for (const [x0, , x1] of horizontal) {
      expect(x0).toBeGreaterThan(x1);
    }
  });

  it("skips left tick for null y but still emits bottom for finite x", () => {
    // Use PortableSpec directly so null cells reach the pipeline (builder
    // reject NaN/non-JSON numbers).
    const model = runPipeline(
      {
        data: {
          values: [
            { x: 0, y: 10 },
            { x: 1, y: null },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" } },
        layers: [{ geom: "rug", params: { sides: "bl", length: 0.1 } }],
      },
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "segments");
    if (batch?.kind !== "segments") throw new Error("expected segments");
    // 2 bottom + 1 left (only first row has finite y)
    expect(batch.segments.length / 4).toBe(3);
  });

  it("trains x domain from data, not tick geometry; y-only sides train y", () => {
    const model = runPipeline(
      gg({ x: [2, 8] }, aes({ x: "x" }))
        .geomRug({ sides: "b" })
        .spec(),
      size,
    );
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[0]).toBeLessThanOrEqual(2);
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(8);
    }
    // y is default/placeholder domain — tick length must not expand it to data-like range
    if (model.scales.y.type !== "band") {
      const span = model.scales.y.domain[1] - model.scales.y.domain[0];
      expect(span).toBeLessThan(20);
    }
  });

  it("does not dedupe coincident x values", () => {
    const batch = rugBatch({ x: [1, 1] }, { x: "x" }, { sides: "b" });
    expect(batch.segments.length / 4).toBe(2);
  });

  it("uses exact auto hit mode (edge chrome, not axis grouping)", () => {
    const model = runPipeline(
      gg({ x: [0, 1] }, aes({ x: "x" }))
        .geomRug({ sides: "b" })
        .spec(),
      size,
    );
    expect(model.candidates.candidate(0)?.autoMode).toBe("exact");
  });
});
