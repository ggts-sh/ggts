/**
 * Pure unit tests for stat_bin_2d (#799).
 */
import { describe, expect, it } from "bun:test";

import { statBin2d } from "../../src/stats/bin-2d.ts";

describe("statBin2d (#799)", () => {
  it("bins four corner points into four cells with drop=true", () => {
    // Points at corners of [0,2]×[0,2] with bins=2 → one point each corner cell
    const result = statBin2d({
      x: Float64Array.from([0.25, 1.75, 0.25, 1.75]),
      y: Float64Array.from([0.25, 0.25, 1.75, 1.75]),
      groups: [0, 0, 0, 0],
      params: { bins: 2, drop: true },
    });
    expect(result.count.length).toBe(4);
    expect([...result.count].every((c) => c === 1)).toBe(true);
    expect(result.dropped).toBe(0);
  });

  it("drop=false keeps zero-count bins", () => {
    // Span both axes so bins=2 yields a full 2×2 grid.
    const result = statBin2d({
      x: Float64Array.from([0, 2]),
      y: Float64Array.from([0, 2]),
      groups: [0, 0],
      params: { bins: 2, drop: false },
    });
    // 2×2 grid → 4 cells; only two corners occupied (diagonal points)
    expect(result.count.length).toBe(4);
    expect([...result.count].filter((c) => c === 0).length).toBe(2);
    expect([...result.count].filter((c) => c === 1).length).toBe(2);
  });

  it("drop=true (default) omits empty bins", () => {
    const result = statBin2d({
      x: Float64Array.from([0.1]),
      y: Float64Array.from([0.1]),
      groups: [0],
      params: { bins: 3 },
    });
    expect(result.count.length).toBe(1);
    expect(result.count[0]).toBe(1);
  });

  it("drops non-finite coordinates", () => {
    const result = statBin2d({
      x: Float64Array.from([1, NaN, 2]),
      y: Float64Array.from([1, 1, Infinity]),
      groups: [0, 0, 0],
      params: { bins: 2, drop: true },
    });
    expect(result.dropped).toBe(2);
    expect(result.count.length).toBe(1);
  });

  it("weights sum into count", () => {
    const result = statBin2d({
      x: Float64Array.from([0.5, 0.5]),
      y: Float64Array.from([0.5, 0.5]),
      groups: [0, 0],
      weights: Float64Array.from([2, 3]),
      params: { bins: 2, drop: true },
    });
    expect(result.count.length).toBe(1);
    expect(result.count[0]).toBe(5);
  });

  it("uses only occupied storage for a fine grid with dropped cells", () => {
    const input = {
      x: Float64Array.of(8, 0, 0, 8, 0, 4, NaN),
      y: Float64Array.of(8, 0, 0, 0, 8, 4, 1),
      groups: [9, 9, 9, 3, 3, 9, 3],
      weights: Float64Array.of(2, 7, -7, -3, 4, 1, 0.5),
      carried: { label: ["a", "a", "a", "b", "b", "a", "b"] },
      params: { bins: 128 },
    };
    const dense = statBin2d({ ...input, params: { ...input.params, drop: false } });
    expect(dense.count).toHaveLength(2 * 128 ** 2);
    const occupied = Array.from(dense.count.keys()).filter((i) => dense.count[i] !== 0);
    expect(occupied).toHaveLength(4);

    const NativeFloat64Array = globalThis.Float64Array;
    let largestAllocation = 0;
    globalThis.Float64Array = new Proxy(NativeFloat64Array, {
      construct(target, args: unknown[]) {
        const length = args[0];
        if (typeof length === "number") largestAllocation = Math.max(largestAllocation, length);
        return Reflect.construct(target, args) as Float64Array;
      },
    });
    let sparse: ReturnType<typeof statBin2d>;
    try {
      sparse = statBin2d(input);
    } finally {
      globalThis.Float64Array = NativeFloat64Array;
    }

    for (const field of [
      "x",
      "y",
      "xmin",
      "xmax",
      "ymin",
      "ymax",
      "count",
      "density",
      "ncount",
      "ndensity",
    ] as const) {
      expect([...sparse[field]]).toEqual(occupied.map((i) => dense[field][i]));
    }
    expect(sparse.groups).toEqual(occupied.map((i) => dense.groups[i]));
    expect(sparse.carried.label).toEqual(occupied.map((i) => dense.carried.label![i]));
    expect(sparse.dropped).toBe(dense.dropped);
    expect(largestAllocation).toBe(occupied.length);
  });

  it("emits xmin/xmax/ymin/ymax edges consistent with centers", () => {
    const result = statBin2d({
      x: Float64Array.from([0.5]),
      y: Float64Array.from([0.5]),
      groups: [0],
      params: { bins: 2, drop: true },
    });
    expect(result.x[0]).toBeCloseTo((result.xmin[0]! + result.xmax[0]!) / 2, 10);
    expect(result.y[0]).toBeCloseTo((result.ymin[0]! + result.ymax[0]!) / 2, 10);
    expect(result.xmax[0]! - result.xmin[0]!).toBeGreaterThan(0);
    expect(result.ymax[0]! - result.ymin[0]!).toBeGreaterThan(0);
  });
});
