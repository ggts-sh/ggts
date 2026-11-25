/**
 * Pure stat_density_2d (#802).
 */
import { describe, expect, it, spyOn } from "bun:test";

import { bandwidthNRD, productKdeGrid, statDensity2d } from "../src/stats/density-2d.ts";

describe("bandwidthNRD", () => {
  it("returns positive bandwidth for a spread sample", () => {
    const x = Float64Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(bandwidthNRD(x)).toBeGreaterThan(0);
  });
});

/**
 * Direct-product KDE (unsorted scan) — independent reference for the public
 * productKdeGrid surface. Same ±8σ window and invN scaling as production.
 */
function naiveProductKdeGrid(
  xs: Float64Array,
  ys: Float64Array,
  gx: Float64Array,
  gy: Float64Array,
  hx: number,
  hy: number,
): number[][] {
  const invSqrt2pi = 1 / Math.sqrt(2 * Math.PI);
  const dnorm = (u: number) => invSqrt2pi * Math.exp(-0.5 * u * u);
  const nx = xs.length;
  const wx = 8 * hx;
  const wy = 8 * hy;
  const invN = 1 / (nx * hx * hy);
  const z: number[][] = Array.from({ length: gy.length }, () =>
    Array.from({ length: gx.length }, () => 0),
  );
  for (let j = 0; j < gy.length; j++) {
    const yj = gy[j]!;
    for (let i = 0; i < gx.length; i++) {
      const xi = gx[i]!;
      let s = 0;
      for (let k = 0; k < nx; k++) {
        const dx = xi - xs[k]!;
        if (Math.abs(dx) > wx) continue;
        const dy = yj - ys[k]!;
        if (Math.abs(dy) > wy) continue;
        s += dnorm(dx / hx) * dnorm(dy / hy);
      }
      z[j]![i] = s * invN;
    }
  }
  return z;
}

/**
 * Sorted-order reference: same admitted set AND the same addend order as
 * production (ascending x, ties by original index), so equality can be exact.
 * `naiveProductKdeGrid` above sums in input order instead, which is why it only
 * agrees to 1e-12.
 *
 * Both windows reject with `> w` rather than admitting with `<= w`, so a NaN
 * coordinate is admitted rather than dropped — the contract production keeps.
 */
function sortedProductKdeGrid(
  xs: Float64Array,
  ys: Float64Array,
  gx: Float64Array,
  gy: Float64Array,
  hx: number,
  hy: number,
): { z: number[][]; pairs: number } {
  const invSqrt2pi = 1 / Math.sqrt(2 * Math.PI);
  const dnorm = (u: number) => invSqrt2pi * Math.exp(-0.5 * u * u);
  const nx = xs.length;
  const wx = 8 * hx;
  const wy = 8 * hy;
  const invN = 1 / (nx * hx * hy);
  const order = Array.from({ length: nx }, (_, i) => i).toSorted(
    (a, b) => xs[a]! - xs[b]! || a - b,
  );
  const z: number[][] = Array.from({ length: gy.length }, () =>
    Array.from({ length: gx.length }, () => 0),
  );
  let pairs = 0;
  for (let j = 0; j < gy.length; j++) {
    const yj = gy[j]!;
    for (let i = 0; i < gx.length; i++) {
      const xi = gx[i]!;
      let s = 0;
      for (let o = 0; o < nx; o++) {
        const k = order[o]!;
        const dx = xi - xs[k]!;
        if (Math.abs(dx) > wx) continue;
        const dy = yj - ys[k]!;
        if (Math.abs(dy) > wy) continue;
        pairs++;
        s += dnorm(dx / hx) * dnorm(dy / hy);
      }
      z[j]![i] = s * invN;
    }
  }
  return { z, pairs };
}

/** Deterministic pseudo-normal cloud (Box-Muller-lite), as used downstream. */
function normalCloud(n: number): { xs: Float64Array; ys: Float64Array } {
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
  return { xs: Float64Array.from(x), ys: Float64Array.from(y) };
}

function evenGrid(from: number, to: number, n: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = from + ((to - from) * i) / (n - 1);
  return out;
}

describe("productKdeGrid", () => {
  it("matches the direct-product reference surface on a small cloud", () => {
    // Irregular x spacing so sorted-window order differs from input order.
    const xs = Float64Array.from([0.4, -1.2, 2.1, 0.0, 1.5, -0.3, 0.8, -1.8, 1.1, 0.2]);
    const ys = Float64Array.from([0.1, 0.9, -0.4, 1.2, 0.0, -0.8, 0.5, 0.3, -1.0, 0.7]);
    const gx = Float64Array.from([-2, -1, 0, 1, 2]);
    const gy = Float64Array.from([-1.5, -0.5, 0.5, 1.5]);
    const hx = 0.4;
    const hy = 0.35;
    const got = productKdeGrid(xs, ys, gx, gy, hx, hy);
    const want = naiveProductKdeGrid(xs, ys, gx, gy, hx, hy);
    expect(got.length).toBe(want.length);
    for (let j = 0; j < want.length; j++) {
      expect(got[j]!.length).toBe(want[j]!.length);
      for (let i = 0; i < want[j]!.length; i++) {
        // Sum order may differ after the x-sort; stay well under isoline sensitivity.
        expect(Math.abs(got[j]![i]! - want[j]![i]!)).toBeLessThan(1e-12);
      }
    }
  });

  it("visits fewer point-cell pairs than a full G²·n scan when bandwidth is local", () => {
    // Wide scatter, tight bandwidth: sliding window must skip far x cells.
    const n = 200;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = (i / (n - 1)) * 20 - 10;
      ys[i] = Math.sin(i) * 2;
    }
    const G = 40;
    const gx = new Float64Array(G);
    const gy = new Float64Array(G);
    for (let i = 0; i < G; i++) {
      gx[i] = (i / (G - 1)) * 20 - 10;
      gy[i] = (i / (G - 1)) * 6 - 3;
    }
    const hx = 0.15;
    const hy = 0.15;
    const full = G * G * n;
    const { examinations } = productKdeGrid(xs, ys, gx, gy, hx, hy, { countExaminations: true });
    // Local bandwidth should examine far fewer than the naive full product.
    expect(examinations).toBeLessThan(full * 0.25);
    expect(examinations).toBeGreaterThan(0);
  });

  it.each([
    ["packed rows", 0.5, 9, 12],
    ["all-sample rows", 3, 18, 24],
  ] as const)("reuses only the y factors reached by x windows in %s", (_, hy, visits, calls) => {
    const xs = Float64Array.of(-100, -1, 0, 1, 100);
    const ys = new Float64Array(xs.length);
    const gx = Float64Array.of(-1, 0, 1);
    const gy = Float64Array.of(0, 20);
    const exp = spyOn(Math, "exp");
    try {
      const { examinations } = productKdeGrid(xs, ys, gx, gy, 1, hy, {
        countExaminations: true,
      });
      expect(examinations).toBe(visits);
      expect(exp).toHaveBeenCalledTimes(calls);
    } finally {
      exp.mockRestore();
    }
  });

  it("sums in ascending-x order, bit for bit", () => {
    const { xs, ys } = normalCloud(400);
    const gx = evenGrid(-3, 3, 32);
    const gy = evenGrid(-3, 3, 32);
    const got = productKdeGrid(xs, ys, gx, gy, 0.3, 0.25);
    const { z: want } = sortedProductKdeGrid(xs, ys, gx, gy, 0.3, 0.25);
    for (let j = 0; j < want.length; j++) {
      for (let i = 0; i < want[j]!.length; i++) {
        expect(got[j]![i]!).toBe(want[j]![i]!);
      }
    }
  });

  it("visits only the pairs inside both windows", () => {
    // The measured regression case: NRD-scale bandwidth, default grid size.
    const { xs, ys } = normalCloud(4000);
    const gx = evenGrid(-4, 4, 100);
    const gy = evenGrid(-4, 4, 100);
    const hx = 0.12;
    const hy = 0.12;
    const { pairs } = sortedProductKdeGrid(xs, ys, gx, gy, hx, hy);
    const { examinations } = productKdeGrid(xs, ys, gx, gy, hx, hy, {
      countExaminations: true,
    });
    expect(examinations).toBe(pairs);
  });

  it("zeroes a row whose samples all fall outside the y window", () => {
    const xs = Float64Array.from([-1, 0, 1]);
    const ys = Float64Array.from([0, 0, 0]);
    const gx = evenGrid(-1, 1, 5);
    const gy = Float64Array.from([-50, 0, 50]);
    const z = productKdeGrid(xs, ys, gx, gy, 0.5, 0.5);
    for (const value of z[0]!) expect(value).toBe(0);
    for (const value of z[2]!) expect(value).toBe(0);
    expect(z[1]!.some((value) => value > 0)).toBe(true);
  });

  it("stays exact when the y window covers every row", () => {
    // Wide bandwidth: no row can exclude a sample, so production reads the
    // sorted arrays directly instead of gathering. That choice is invisible
    // from outside, so this pins the surface, not which branch ran.
    const { xs, ys } = normalCloud(300);
    const gx = evenGrid(-3, 3, 24);
    const gy = evenGrid(-3, 3, 24);
    const got = productKdeGrid(xs, ys, gx, gy, 0.4, 40);
    const { z: want } = sortedProductKdeGrid(xs, ys, gx, gy, 0.4, 40);
    for (let j = 0; j < want.length; j++) {
      for (let i = 0; i < want[j]!.length; i++) {
        expect(got[j]![i]!).toBe(want[j]![i]!);
      }
    }
  });

  it("admits a non-finite y the same way the x window does", () => {
    // `!(|dy| > wy)` keeps a NaN sample in, matching the pre-existing contract.
    const xs = Float64Array.from([0, 0.1]);
    const ys = Float64Array.from([0, Number.NaN]);
    const gx = Float64Array.from([0]);
    const gy = Float64Array.from([0]);
    expect(Number.isNaN(productKdeGrid(xs, ys, gx, gy, 0.5, 0.5)[0]![0]!)).toBe(true);
  });
});

describe("statDensity2d", () => {
  function cloud(n: number, cx = 0, cy = 0, s = 1): { x: Float64Array; y: Float64Array } {
    // Deterministic pseudo-normal-ish samples (Box-Muller-lite)
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const u = ((i * 37 + 11) % 1000) / 1000 + 1e-6;
      const v = ((i * 91 + 17) % 1000) / 1000 + 1e-6;
      const r = Math.sqrt(-2 * Math.log(u));
      const th = 2 * Math.PI * v;
      x.push(cx + s * r * Math.cos(th));
      y.push(cy + s * r * Math.sin(th));
    }
    return { x: Float64Array.from(x), y: Float64Array.from(y) };
  }

  it("emits isoline vertices for a unimodal cloud", () => {
    const { x, y } = cloud(80);
    const result = statDensity2d({
      x,
      y,
      groups: Array.from({ length: x.length }, () => 0),
      params: { n: 25, bins: 4 },
    });
    expect(result.dropped).toBe(0);
    expect(result.x.length).toBeGreaterThan(0);
    expect(result.level.length).toBe(result.x.length);
  });

  it("drops groups with fewer than 2 points", () => {
    const result = statDensity2d({
      x: Float64Array.from([1]),
      y: Float64Array.from([2]),
      groups: [0],
      params: { n: 10, bins: 3 },
    });
    expect(result.droppedGroups).toBe(1);
    expect(result.x.length).toBe(0);
  });

  it("drops non-finite rows", () => {
    const { x, y } = cloud(20);
    const xx = Float64Array.from([...x, Number.NaN]);
    const yy = Float64Array.from([...y, 0]);
    const result = statDensity2d({
      x: xx,
      y: yy,
      groups: Array.from({ length: xx.length }, () => 0),
      params: { n: 20, bins: 3 },
    });
    expect(result.dropped).toBe(1);
  });

  it("keeps groups separate", () => {
    const a = cloud(40, -2, 0, 0.5);
    const b = cloud(40, 2, 0, 0.5);
    const x = Float64Array.from([...a.x, ...b.x]);
    const y = Float64Array.from([...a.y, ...b.y]);
    const groups = [
      ...Array.from({ length: a.x.length }, () => 0),
      ...Array.from({ length: b.x.length }, () => 1),
    ];
    const result = statDensity2d({
      x,
      y,
      groups,
      params: { n: 20, bins: 3 },
    });
    expect(new Set(result.groups).size).toBe(2);
  });

  it("accepts explicit h pair", () => {
    const { x, y } = cloud(30);
    const result = statDensity2d({
      x,
      y,
      groups: Array.from({ length: x.length }, () => 0),
      params: { h: [1, 1], n: 15, bins: 3 },
    });
    expect(result.x.length).toBeGreaterThan(0);
  });
});
