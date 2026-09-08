/**
 * geom_bin_2d + stat_bin_2d (#799).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg, normalize, validate } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";

const size = { width: 200, height: 100 };

describe("geom_bin_2d schema (#799)", () => {
  it("accepts bin_2d with continuous x/y", () => {
    const result = validate(
      {
        data: { values: [{ x: 1, y: 2 }] },
        aes: { x: { field: "x" }, y: { field: "y" } },
        layers: [{ geom: "bin_2d", params: { bins: 5 } }],
      },
      {},
    );
    expect(result.ok).toBe(true);
  });

  it("normalize defaults fill to after_stat count", () => {
    const spec = normalize({
      data: { values: [{ x: 1, y: 2 }] },
      aes: { x: { field: "x" }, y: { field: "y" } },
      layers: [{ geom: "bin_2d" }],
    });
    expect(spec.layers[0]?.geom).toBe("bin_2d");
    expect(spec.layers[0]?.stat).toBe("bin_2d");
    expect(spec.layers[0]?.aes?.fill).toEqual({ stat: "count" });
  });

  it("builder sugar emits bin_2d + params", () => {
    const spec = gg({ x: [1, 2], y: [3, 4] }, aes({ x: "x", y: "y" }))
      .geomBin2d({ bins: 10, drop: false })
      .spec();
    expect(spec.layers[0]?.geom).toBe("bin_2d");
    expect(spec.layers[0]?.params).toMatchObject({ bins: 10, drop: false });
  });
});

describe("geom_bin_2d geometry (#799)", () => {
  it("emits rects with fill from count", () => {
    // Four points in distinct quadrants of [0,2]x[0,2]
    const model = runPipeline(
      gg({ x: [0.25, 1.75, 0.25, 1.75], y: [0.25, 0.25, 1.75, 1.75] }, aes({ x: "x", y: "y" }))
        .geomBin2d({ bins: 2 })
        .spec(),
      size,
    );
    const rects = model.scene.batches.filter((b) => b.kind === "rects");
    expect(rects.length).toBe(1);
    // drop=true keeps only non-empty cells → 4
    expect(rects[0]!.rects.length / 4).toBe(4);
    expect(rects[0]!.fills).toBeDefined();
    expect(rects[0]!.fills!.length).toBe(4);
  });

  it("drop=false keeps empty cells", () => {
    const model = runPipeline(
      gg({ x: [0, 2], y: [0, 2] }, aes({ x: "x", y: "y" }))
        .geomBin2d({ bins: 2, drop: false })
        .spec(),
      size,
    );
    const rects = model.scene.batches.find((b) => b.kind === "rects");
    expect(rects?.kind).toBe("rects");
    // Full 2×2 grid including empty off-diagonal cells
    expect(rects!.rects.length / 4).toBe(4);
  });

  it("more bins produce more occupied cells when points fill space", () => {
    // Scatter of many points across unit square
    const n = 40;
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      x.push(i / (n - 1));
      y.push(((i * 7) % n) / (n - 1));
    }
    const sparse = runPipeline(
      gg({ x, y }, aes({ x: "x", y: "y" }))
        .geomBin2d({ bins: 4 })
        .spec(),
      size,
    );
    const dense = runPipeline(
      gg({ x, y }, aes({ x: "x", y: "y" }))
        .geomBin2d({ bins: 8 })
        .spec(),
      size,
    );
    const sparseRects = sparse.scene.batches.find((b) => b.kind === "rects");
    const denseRects = dense.scene.batches.find((b) => b.kind === "rects");
    expect(sparseRects?.kind).toBe("rects");
    expect(denseRects?.kind).toBe("rects");
    expect(denseRects!.rects.length).toBeGreaterThan(sparseRects!.rects.length);
  });
});
