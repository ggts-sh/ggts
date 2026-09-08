/**
 * M2 pipeline — jitter / nudge positions.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { PointsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

describe("jitter / nudge positions", () => {
  const rows = {
    cat: ["a", "a", "a", "b", "b", "b"],
    v: [1, 2, 3, 2, 3, 4],
  };
  const jittered = (seed?: number) =>
    gg(rows, aes({ x: "cat", y: "v" }))
      .geomPoint({ position: "jitter", ...(seed !== undefined && { positionParams: { seed } }) })
      .spec();

  it("is deterministic: same spec, same pixels, and emits the seeded advisory", () => {
    const a = runPipeline(jittered(), size);
    const b = runPipeline(jittered(), size);
    expect((a.scene.batches[0] as PointsBatch).positions).toEqual(
      (b.scene.batches[0] as PointsBatch).positions,
    );
    const advisory = a.advisories.find((adv) => adv.code === "jitter-seeded");
    expect(advisory).toBeDefined();
    expect(advisory!.chosen).toContain("seed 42");
    expect(advisory!.howToOverride).toContain("positionParams.seed");
  });

  it("a different seed moves the points; offsets stay inside the band", () => {
    const a = runPipeline(jittered(), size);
    const b = runPipeline(jittered(7), size);
    const pa = (a.scene.batches[0] as PointsBatch).positions;
    const pb = (b.scene.batches[0] as PointsBatch).positions;
    expect(pa).not.toEqual(pb);
    // Default width = 0.4 band fractions: x offsets < half a band step.
    const plain = runPipeline(
      gg(rows, aes({ x: "cat", y: "v" }))
        .geomPoint()
        .spec(),
      size,
    );
    const pc = (plain.scene.batches[0] as PointsBatch).positions;
    const panelWidth = plain.scene.panels[0]!.width;
    const step = panelWidth / 2; // two bands
    for (let i = 0; i < pa.length / 2; i++) {
      expect(Math.abs(pa[i * 2]! - pc[i * 2]!)).toBeLessThan(step * 0.4 + 1e-6);
    }
  });

  it("nudge shifts text labels by fixed offsets", () => {
    const base = gg(rows, aes({ x: "cat", y: "v", label: "cat" }));
    const plain = runPipeline(base.geomText().spec(), size);
    const nudged = runPipeline(
      base.layer({ geom: "text", position: "nudge", positionParams: { y: 0.5 } }).spec(),
      size,
    );
    const p0 = (plain.scene.batches[0] as { positions: Float32Array }).positions;
    const p1 = (nudged.scene.batches[0] as { positions: Float32Array }).positions;
    expect(p1[0]).toBeCloseTo(p0[0]!, 3);
    expect(p1[1]!).toBeLessThan(p0[1]!); // +0.5 data units = up in pixels
  });
});

// ---------------------------------------------------------------------------
// render determinism across the whole M2 surface
// ---------------------------------------------------------------------------
