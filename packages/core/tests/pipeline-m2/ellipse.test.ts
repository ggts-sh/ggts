/**
 * M2 pipeline — stat ellipse on path (#812).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

function cloud(n: number, mx: number, my: number, seed = 1): { x: number[]; y: number[] } {
  // Simple LCG
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    // Box-Muller
    const u = Math.max(1e-12, rnd());
    const v = rnd();
    const r = Math.sqrt(-2 * Math.log(u));
    const th = 2 * Math.PI * v;
    x.push(mx + r * Math.cos(th));
    y.push(my + r * Math.sin(th));
  }
  return { x, y };
}

describe("stat ellipse (#812)", () => {
  it("draws one closed path ring per group", () => {
    const a = cloud(40, 0, 0, 1);
    const b = cloud(40, 5, 5, 2);
    const model = runPipeline(
      gg(
        {
          x: [...a.x, ...b.x],
          y: [...a.y, ...b.y],
          g: [...Array.from({ length: 40 }, () => "a"), ...Array.from({ length: 40 }, () => "b")],
        },
        aes({ x: "x", y: "y", color: "g" }),
      )
        .geomPath({ stat: "ellipse", level: 0.95, segments: 20 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    // 2 groups → 2 subpaths
    expect(batch.pathOffsets.length).toBe(3);
    // Each ring: 20 samples + closing = 21 vertices
    expect(batch.pathOffsets[1]! - batch.pathOffsets[0]!).toBe(21);
    expect(batch.pathOffsets[2]! - batch.pathOffsets[1]!).toBe(21);
    expect(new Set(batch.strokes).size).toBe(2);
  });

  it("expands domain beyond cloud means via ellipse tips", () => {
    const c = cloud(30, 0, 0, 3);
    const model = runPipeline(
      gg({ x: c.x, y: c.y }, aes({ x: "x", y: "y" }))
        .geomPath({ stat: "ellipse", level: 0.95, segments: 24 })
        .spec(),
      size,
    );
    if (model.scales.x.type !== "band") {
      // Ellipse should extend past ±1 for unit-ish cloud at 95%
      const domain = model.scales.x.domain;
      expect(domain[1] - domain[0]).toBeGreaterThan(2);
    }
  });

  it("rejects stat ellipse on point (path-only)", () => {
    expect(() =>
      gg({ x: [0, 1, 2], y: [0, 1, 2] }, aes({ x: "x", y: "y" }))
        .layer({
          geom: "point",
          stat: "ellipse" as "identity",
          aes: { x: "x", y: "y" },
        })
        .spec(),
    ).toThrow();
  });

  it("singleton groups warn ellipse-group-dropped only (not false missing)", () => {
    // One viable group + one finite singleton — must not claim "missing x/y".
    const model = runPipeline(
      gg(
        {
          x: [0, 1, 2, 9],
          y: [0, 1, 0, 9],
          g: ["a", "a", "a", "b"],
        },
        aes({ x: "x", y: "y", color: "g" }),
      )
        .geomPath({ stat: "ellipse", level: 0.95, segments: 12 })
        .spec(),
      size,
    );
    expect(model.warnings.some((w) => w.code === "ellipse-group-dropped")).toBe(true);
    expect(model.warnings.some((w) => w.code === "removed-missing")).toBe(false);
  });
});
