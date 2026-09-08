/**
 * M2 pipeline — geom_violin mirrored y-density polygons.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { mulberry32 } from "../../src/stats/numeric.ts";

const size = { width: 640, height: 400 };

function rows(): { cat: string; v: number }[] {
  const rnd = mulberry32(11);
  const out: { cat: string; v: number }[] = [];
  for (const cat of ["a", "b", "c"]) {
    for (let i = 0; i < 30; i++) {
      out.push({ cat, v: rnd() * 10 + (cat === "b" ? 5 : 0) });
    }
  }
  return out;
}

describe("geom_violin", () => {
  it("emits one closed path subpath per category", () => {
    const model = runPipeline(
      gg(rows(), aes({ x: "cat", y: "v" }))
        .geomViolin({ n: 64, scale: "width" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.closed).toBe(true);
    expect(batch.fills).toBeDefined();
    expect(batch.pathOffsets.length - 1).toBe(3);
  });

  it("dodges filled groups at the same x", () => {
    const data = rows().map((r, i) => ({
      ...r,
      side: i % 2 === 0 ? "L" : "R",
    }));
    const model = runPipeline(
      gg(data, aes({ x: "cat", y: "v", fill: "side" }))
        .geomViolin({ n: 32, scale: "width" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    // 3 cats × 2 fill groups
    expect(batch.pathOffsets.length - 1).toBe(6);
    expect(new Set(batch.fills).size).toBe(2);
  });

  it("trains the y scale from the data values, not the violin width", () => {
    const model = runPipeline(
      gg(rows(), aes({ x: "cat", y: "v" }))
        .geomViolin({ n: 32 })
        .spec(),
      size,
    );
    // ydensity stashes violinwidth (0-1) in frame ymin/ymax for the geometry.
    // The y axis must still describe v, or every polygon is drawn far off-panel.
    const [lo, hi] = model.scales.y.domain;
    expect(hi).toBeGreaterThan(3);
    const batch = model.scene.batches[0] as PathsBatch;
    const ys = Array.from(batch.positions).filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThan(-size.height);
    expect(Math.max(...ys)).toBeLessThan(size.height * 2);
    expect(lo).toBeLessThan(hi);
  });

  it("uses exact auto hit mode (#1528)", () => {
    const model = runPipeline(
      gg(rows(), aes({ x: "cat", y: "v" }))
        .geomViolin({ n: 32 })
        .spec(),
      size,
    );
    // Discrete-band distribution: freescrolling x guides cut the density body.
    expect(model.candidates.candidate(0)?.autoMode).toBe("exact");
  });
});
