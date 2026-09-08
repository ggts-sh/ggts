/**
 * geom_qq + geom_qq_line (#804).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg, normalize, validate } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch, PointsBatch } from "../../src/scene.ts";

const size = { width: 200, height: 100 };

describe("geom_qq schema (#804)", () => {
  it("accepts qq with sample channel", () => {
    const result = validate(
      {
        data: { values: [{ y: 1 }, { y: 2 }, { y: 3 }] },
        layers: [{ geom: "qq", aes: { sample: { field: "y" } } }],
      },
      {},
    );
    expect(result.ok).toBe(true);
  });

  it("builder sugar emits qq + qq_line", () => {
    const data = { y: [1, 2, 3, 4, 5] };
    expect(
      gg(data, aes({ sample: "y" }))
        .geomQq()
        .spec().layers[0]?.geom,
    ).toBe("qq");
    expect(
      gg(data, aes({ sample: "y" }))
        .geomQqLine()
        .spec().layers[0]?.geom,
    ).toBe("qq_line");
  });

  it("normalize stamps qq / qq_line stats", () => {
    const qq = normalize({
      data: { values: [{ y: 1 }] },
      layers: [{ geom: "qq", aes: { sample: { field: "y" } } }],
    });
    expect(qq.layers[0]?.stat).toBe("qq");
    const line = normalize({
      data: { values: [{ y: 1 }] },
      layers: [{ geom: "qq_line", aes: { sample: { field: "y" } } }],
    });
    expect(line.layers[0]?.stat).toBe("qq_line");
  });
});

describe("geom_qq geometry (#804)", () => {
  it("qq emits one point per finite sample", () => {
    const model = runPipeline(
      gg({ y: [1, 2, 3, 4, 5] }, aes({ sample: "y" }))
        .geomQq({ size: 3 })
        .spec(),
      size,
    );
    const points = model.scene.batches.filter((b): b is PointsBatch => b.kind === "points");
    expect(points).toHaveLength(1);
    expect(points[0]!.positions.length / 2).toBe(5);
    expect(points[0]!.size).toBe(3);
  });

  it("qq_line emits a two-vertex path", () => {
    const model = runPipeline(
      gg({ y: [1, 2, 3, 4, 5] }, aes({ sample: "y" }))
        .geomQqLine({ linewidth: 2 })
        .spec(),
      size,
    );
    const paths = model.scene.batches.filter((b): b is PathsBatch => b.kind === "paths");
    expect(paths.length).toBeGreaterThanOrEqual(1);
    // One subpath with 2 vertices (4 floats) or positions covering 2 points
    const path = paths[0]!;
    const nVerts = path.positions.length / 2;
    expect(nVerts).toBe(2);
    expect(path.linewidth).toBe(2);
  });

  it("rejects missing sample at pipeline", () => {
    expect(() =>
      runPipeline(
        gg({ y: [1, 2, 3] }, aes({ y: "y" }))
          .geomQq()
          .spec(),
        size,
      ),
    ).toThrow(/sample/i);
  });

  it("trains y scale on sample quantiles (not unit [0,1] fallback)", () => {
    // Regression for Devin review on #884: qq frames set yNumeric to samples
    // without aes.y; collectAxisInputsY must still train continuous y.
    const samples = [150, 160, 170, 180, 190];
    const model = runPipeline(
      gg({ y: samples }, aes({ sample: "y" }))
        .geomQq()
        .spec(),
      { width: 400, height: 300 },
    );
    const lo = model.scales.y.domain[0];
    const hi = model.scales.y.domain[1];
    if (typeof lo !== "number" || typeof hi !== "number") {
      throw new TypeError("expected continuous y domain for qq sample axis");
    }
    expect(lo).toBeLessThanOrEqual(Math.min(...samples));
    expect(hi).toBeGreaterThanOrEqual(Math.max(...samples));
    // Points must land inside the plot height (broken training puts them off-panel).
    const points = model.scene.batches.filter((b): b is PointsBatch => b.kind === "points");
    expect(points).toHaveLength(1);
    const ys: number[] = [];
    const pos = points[0]!.positions;
    for (let i = 1; i < pos.length; i += 2) ys.push(pos[i]!);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(300);
    }
  });
});
