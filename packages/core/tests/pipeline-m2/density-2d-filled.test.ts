/**
 * M2 pipeline — geom_density_2d_filled closed rings (#802 phase 2).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { isClosedRing } from "../../src/stats/density-2d.ts";
import { size } from "./fixtures.ts";

function cloud(n: number): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = ((i * 37 + 11) % 1000) / 1000 + 1e-6;
    const v = ((i * 91 + 17) % 1000) / 1000 + 1e-6;
    const r = Math.sqrt(-2 * Math.log(u));
    const th = 2 * Math.PI * v;
    x.push(r * Math.cos(th));
    y.push(r * Math.sin(th));
  }
  return { x, y };
}

describe("isClosedRing", () => {
  it("detects closed and open polylines", () => {
    expect(
      isClosedRing([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ]),
    ).toBe(true);
    expect(
      isClosedRing([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBe(false);
  });
});

describe("density_2d_filled geom (#802 phase 2)", () => {
  it("emits closed filled paths for a scatter cloud", () => {
    const data = cloud(80);
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomDensity2dFilled({ n: 30, bins: 5 })
        .spec(),
      size,
    );
    // May be empty if all rings open on this sample — still must not throw.
    if (model.scene.batches.length === 0) {
      expect(model.warnings.some((w) => w.code === "density-2d-filled-open-dropped")).toBe(true);
      return;
    }
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.closed).toBe(true);
    expect(batch.fills).toBeDefined();
    expect(batch.positions.length / 2).toBeGreaterThan(0);
  });

  it("defaults fill to after_stat(level)", () => {
    const spec = gg(cloud(20), aes({ x: "x", y: "y" }))
      .geomDensity2dFilled({ n: 15, bins: 3 })
      .spec();
    expect(spec.layers[0]?.stat).toBe("density_2d_filled");
    expect(spec.layers[0]?.aes?.fill).toEqual({ stat: "level" });
  });

  /**
   * A filled band hit must report the vertex it actually landed on. Ring
   * vertices keep authored winding, so resolving them through the x-sorted
   * band reconstruction reported a neighbouring ring's row and with it the
   * wrong after_stat level/density (#916). Semantic x is a monotone function
   * of pixel x, so correct resolution makes the two orders agree.
   */
  it("resolves filled-ring hits to their own vertex (#916)", () => {
    const data = cloud(80);
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomDensity2dFilled({ n: 30, bins: 5 })
        .spec(),
      size,
    );
    if (model.scene.batches.length === 0) return;
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.closedFrameRows).toBeDefined();
    expect(batch.semanticIndex).toBeUndefined(); // no coord transform in this spec

    const hits: { x: number; xValue: number }[] = [];
    for (let id = 0; id < model.candidates.size; id++) {
      const candidate = model.candidates.candidate(id);
      if (candidate === null || typeof candidate.xValue !== "number") continue;
      hits.push({ x: candidate.x, xValue: candidate.xValue });
    }
    expect(hits.length).toBeGreaterThan(1);

    hits.sort((a, b) => a.x - b.x);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i]!.xValue).toBeGreaterThanOrEqual(hits[i - 1]!.xValue - 1e-9);
    }
  });

  it("uses exact auto hit mode", () => {
    const data = cloud(80);
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomDensity2dFilled({ n: 30, bins: 5 })
        .spec(),
      size,
    );
    if (model.scene.batches.length === 0) return;
    expect(model.candidates.candidate(0)?.autoMode).toBe("exact");
  });
});
