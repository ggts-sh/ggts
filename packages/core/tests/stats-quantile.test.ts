/**
 * Pure stat_quantile / linear RQ unit tests (#805).
 */
import { describe, expect, it, spyOn } from "bun:test";

import {
  empiricalQuantileOrderStat,
  fitLinearQuantileRegression,
  pinballLoss,
  statQuantile,
} from "../src/stats/quantile.js";

describe("empiricalQuantileOrderStat", () => {
  it("returns the ceil(τn)-th order statistic (pinball-minimizing)", () => {
    // sorted would be 1,2,3,4,5; τ=0.5, n=5 → ceil(2.5)=3 → 3rd = 3
    expect(empiricalQuantileOrderStat([5, 1, 3, 2, 4], 0.5)).toBe(3);
  });

  it("handles τ near 0 and 1", () => {
    expect(empiricalQuantileOrderStat([10, 20, 30], 0.01)).toBe(10);
    expect(empiricalQuantileOrderStat([10, 20, 30], 0.99)).toBe(30);
  });
});

describe("pinballLoss", () => {
  it("is zero for exact residuals at any τ when residuals are zero", () => {
    expect(pinballLoss([0, 0, 0], 0.5)).toBe(0);
  });

  it("penalizes under- and over-prediction asymmetrically", () => {
    // residual +1 at τ=0.25 → 0.25; residual -1 → 0.75
    expect(pinballLoss([1], 0.25)).toBeCloseTo(0.25, 10);
    expect(pinballLoss([-1], 0.25)).toBeCloseTo(0.75, 10);
  });
});

describe("empiricalQuantileOrderStat at every rank", () => {
  function killer(n: number): number[] {
    // Musser's input that defeats a middle-element median-of-three pivot.
    const half = n >> 1;
    const values = Array.from({ length: n }, () => 0);
    for (let i = 1; i <= half; i++) {
      if (i % 2 === 1) {
        values[i - 1] = i;
        values[i] = half + i;
      }
      values[half + i - 1] = 2 * i;
    }
    return values;
  }

  const n = 64;
  const SHAPES: Record<string, number[]> = {
    sorted: Array.from({ length: n }, (_, i) => i),
    reversed: Array.from({ length: n }, (_, i) => n - i),
    equal: Array.from({ length: n }, () => 3),
    "organ pipe": Array.from({ length: n }, (_, i) => Math.min(i, n - i)),
    sawtooth: Array.from({ length: n }, (_, i) => i % 7),
    killer: killer(n),
    "two values": Array.from({ length: n }, (_, i) => (i % 3 === 0 ? -1 : 1)),
    random: Array.from({ length: n }, (_, i) => Math.sin(i * 12.9898) * 43758.5453),
  };

  for (const [name, values] of Object.entries(SHAPES)) {
    it(`matches a full sort: ${name}`, () => {
      const sorted = values.toSorted((a, b) => a - b);
      for (let rank = 0; rank < n; rank++) {
        // ceil(tau * n) - 1 === rank for a tau inside the rank's interval.
        const tau = (rank + 0.5) / n;
        expect(empiricalQuantileOrderStat(values, tau)).toBe(sorted[rank]!);
      }
    });
  }

  it("returns NaN for no values", () => {
    expect(empiricalQuantileOrderStat([], 0.5)).toBeNaN();
  });

  it("clamps the rank at tau 0 and 1, and handles one value", () => {
    expect(empiricalQuantileOrderStat([3, 1, 2], 0)).toBe(1);
    expect(empiricalQuantileOrderStat([3, 1, 2], 1)).toBe(3);
    expect(empiricalQuantileOrderStat([7], 0.5)).toBe(7);
  });

  it("orders infinite values", () => {
    const values = [Infinity, 2, -Infinity, 1];
    expect(empiricalQuantileOrderStat(values, 0.1)).toBe(-Infinity);
    expect(empiricalQuantileOrderStat(values, 0.9)).toBe(Infinity);
    expect(empiricalQuantileOrderStat(values, 0.5)).toBe(1);
  });

  it("falls back to a native sort on an input built against the pivot rule", () => {
    // McIlroy's adversary run over a copy of the selection loop. It names the
    // values only when a comparison forces it, so each round removes few rows.
    // If the pivot rule changes, this copy must change too.
    function adversarialValues(size: number, rank: number): number[] {
      const unset = size;
      const assigned = Array.from({ length: size }, () => unset);
      let next = 0;
      let candidate = 0;
      const compare = (left: number, right: number): number => {
        if (assigned[left] === unset && assigned[right] === unset) {
          if (left === candidate) assigned[left] = next++;
          else assigned[right] = next++;
        }
        if (assigned[left] === unset) candidate = left;
        else if (assigned[right] === unset) candidate = right;
        return assigned[left]! - assigned[right]!;
      };
      const order = Array.from({ length: size }, (_, i) => i);
      let lo = 0;
      let hi = size - 1;
      while (lo < hi) {
        const a = order[lo]!;
        const b = order[(lo + hi) >>> 1]!;
        const c = order[hi]!;
        const pivot =
          compare(a, b) < 0
            ? compare(b, c) < 0
              ? b
              : compare(a, c) < 0
                ? c
                : a
            : compare(a, c) < 0
              ? a
              : compare(b, c) < 0
                ? c
                : b;
        let i = lo;
        let j = hi;
        while (i <= j) {
          while (compare(order[i]!, pivot) < 0) i++;
          while (compare(order[j]!, pivot) > 0) j--;
          if (i <= j) {
            const swapped = order[i]!;
            order[i] = order[j]!;
            order[j] = swapped;
            i++;
            j--;
          }
        }
        if (rank <= j) hi = j;
        else if (rank >= i) lo = i;
        else break;
      }
      return assigned.map((value) => (value === unset ? next++ : value));
    }

    const size = 2000;
    const values = adversarialValues(size, size / 2 - 1);
    const expected = values.toSorted((a, b) => a - b)[size / 2 - 1]!;
    const sort = spyOn(Float64Array.prototype, "sort");
    try {
      expect(empiricalQuantileOrderStat(values, 0.5)).toBe(expected);
      expect(sort).toHaveBeenCalledTimes(1);
    } finally {
      sort.mockRestore();
    }
  });

  it("does not reorder its input", () => {
    const values = [5, 1, 3, 2, 4];
    empiricalQuantileOrderStat(values, 0.5);
    expect(values).toEqual([5, 1, 3, 2, 4]);
  });
});

describe("fitLinearQuantileRegression", () => {
  it("does not sort the residuals for every slope of a long series", () => {
    // Sorting at each slope takes about 8 s here; selection takes about 0.2 s.
    const n = 100_000;
    const x = Float64Array.from({ length: n }, (_, row) => (row * 37) % 1009);
    const y = Float64Array.from(x, (value, row) => 2 * value + 5 + ((row * 73) % 101));
    const rows = Array.from({ length: n }, (_, row) => row);
    const started = performance.now();
    for (const tau of [0.25, 0.5, 0.75]) fitLinearQuantileRegression(x, y, tau, rows);
    expect(performance.now() - started).toBeLessThan(2000);
  }, 60_000);

  it("recovers exact collinear y = 1 + 2x for every τ", () => {
    const x = Float64Array.from([0, 1, 2, 3, 4]);
    const y = Float64Array.from([1, 3, 5, 7, 9]);
    for (const tau of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const fit = fitLinearQuantileRegression(x, y, tau);
      expect(fit).not.toBeNull();
      expect(fit!.intercept).toBeCloseTo(1, 8);
      expect(fit!.slope).toBeCloseTo(2, 8);
    }
  });

  it("satisfies the QR residual subgradient condition", () => {
    // Slight noise around y = x
    const x = Float64Array.from([0, 1, 2, 3, 4, 5, 6, 7]);
    const y = Float64Array.from([0.1, 0.9, 2.2, 2.8, 4.1, 4.9, 6.0, 7.2]);
    const tau = 0.5;
    const fit = fitLinearQuantileRegression(x, y, tau)!;
    let below = 0;
    let equal = 0;
    let above = 0;
    for (let i = 0; i < x.length; i++) {
      const r = y[i]! - (fit.intercept + fit.slope * x[i]!);
      if (r < -1e-9) below++;
      else if (r > 1e-9) above++;
      else equal++;
    }
    const n = x.length;
    // #{r < 0} ≤ τn ≤ #{r ≤ 0}
    expect(below).toBeLessThanOrEqual(tau * n + 1e-9);
    expect(below + equal).toBeGreaterThanOrEqual(tau * n - 1e-9);
  });

  it("returns null for n < 2 or constant x", () => {
    expect(fitLinearQuantileRegression(Float64Array.from([1]), Float64Array.from([2]), 0.5)).toBe(
      null,
    );
    expect(
      fitLinearQuantileRegression(Float64Array.from([3, 3, 3]), Float64Array.from([1, 2, 3]), 0.5),
    ).toBe(null);
  });

  it("y-shift equivariance: intercept shifts, slope unchanged", () => {
    const x = Float64Array.from([0, 1, 2, 3]);
    const y = Float64Array.from([0, 1, 2, 4]);
    const base = fitLinearQuantileRegression(x, y, 0.5)!;
    const shiftedY = Float64Array.from(y, (v) => v + 10);
    const shifted = fitLinearQuantileRegression(x, shiftedY, 0.5)!;
    expect(shifted.slope).toBeCloseTo(base.slope, 8);
    expect(shifted.intercept).toBeCloseTo(base.intercept + 10, 8);
  });

  // n > PAIRWISE_CAP (150) forces the bisection path (not pairwise LP vertices).
  it("large-n collinear recovers y = 1 + 2x on the bisection path", () => {
    const n = 300;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = i;
      y[i] = 1 + 2 * i;
    }
    for (const tau of [0.25, 0.5, 0.75]) {
      const fit = fitLinearQuantileRegression(x, y, tau);
      expect(fit).not.toBeNull();
      expect(fit!.intercept).toBeCloseTo(1, 6);
      expect(fit!.slope).toBeCloseTo(2, 6);
    }
  });

  it("large-n steep collinear recovers y = 1 + 500x (expand from default bracket)", () => {
    const n = 300;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = i;
      y[i] = 1 + 500 * i;
    }
    const fit = fitLinearQuantileRegression(x, y, 0.5);
    expect(fit).not.toBeNull();
    expect(fit!.intercept).toBeCloseTo(1, 4);
    expect(fit!.slope).toBeCloseTo(500, 4);
  });

  it("large-n steep negative collinear recovers y = 1 - 200x", () => {
    const n = 300;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = i;
      y[i] = 1 - 200 * i;
    }
    const fit = fitLinearQuantileRegression(x, y, 0.5);
    expect(fit).not.toBeNull();
    expect(fit!.intercept).toBeCloseTo(1, 4);
    expect(fit!.slope).toBeCloseTo(-200, 4);
  });
});

describe("fitLinearQuantileRegression on the pairwise path", () => {
  /** Every pairwise slope in pair order, with the rule the fit must keep. */
  function scanEveryPair(x: Float64Array, y: Float64Array, tau: number) {
    const evaluate = (slope: number) => {
      const intercept = empiricalQuantileOrderStat(
        Array.from(x, (xv, i) => y[i]! - slope * xv),
        tau,
      );
      const residuals = Array.from(x, (xv, i) => y[i]! - slope * xv - intercept);
      return { intercept, loss: pinballLoss(residuals, tau) };
    };
    let best = evaluate(0);
    let bestSlope = 0;
    for (let i = 0; i < x.length; i++) {
      for (let j = i + 1; j < x.length; j++) {
        const dx = x[j]! - x[i]!;
        if (dx === 0) continue;
        const slope = (y[j]! - y[i]!) / dx;
        const cand = evaluate(slope);
        if (cand.loss < best.loss - 1e-15) {
          best = cand;
          bestSlope = slope;
        }
      }
    }
    return { intercept: best.intercept, slope: bestSlope };
  }

  const random = (seed: number) => {
    let state = seed;
    return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  };
  const shapes: Record<string, (next: () => number) => readonly [number, number]> = {
    noise: (next) => {
      const xv = next() * 100;
      return [xv, xv * 0.5 + (next() - 0.5) * 30];
    },
    "integer grid with exact ties": (next) => [Math.floor(next() * 6), Math.floor(next() * 6)],
    "two x values": (next) => [Math.floor(next() * 2), Math.floor(next() * 9)],
    "x in a tiny span near 1": (next) => [1 + next() * 1e-15, next()],
    "x far from zero": (next) => [1e15 + Math.floor(next() * 1000), next()],
    "constant y": (next) => [next() * 10, 3],
    "on one line": (next) => {
      const xv = Math.floor(next() * 50);
      return [xv, 1 + 2 * xv];
    },
    "steep trend": (next) => {
      const xv = next();
      return [xv, 1e9 * xv + 1e-3 * next()];
    },
    "values near the double limit": (next) => [next() * 1e300, next() * 1e300],
  };

  for (const [name, row] of Object.entries(shapes)) {
    it(`keeps the slope of a scan of every pair: ${name}`, () => {
      for (const [n, seeds] of [
        [8, 150],
        [9, 20],
        [24, 60],
        [60, 4],
      ] as const) {
        for (const tau of [0.1, 0.25, 0.5, 0.9]) {
          for (let seed = 1; seed <= seeds; seed++) {
            const next = random(seed * n);
            const rows = Array.from({ length: n }, () => row(next));
            const x = Float64Array.from(rows, (r) => r[0]);
            const y = Float64Array.from(rows, (r) => r[1]);
            const fit = fitLinearQuantileRegression(x, y, tau);
            if (fit === null) continue;
            expect(fit).toEqual(scanEveryPair(x, y, tau));
          }
        }
      }
    });
  }

  it("keeps the slope of a scan of every pair at the row limit, with x in a tiny span", () => {
    const next = random(11);
    const rows = Array.from({ length: 150 }, () => shapes["x in a tiny span near 1"]!(next));
    const x = Float64Array.from(rows, (r) => r[0]);
    const y = Float64Array.from(rows, (r) => r[1]);
    for (const tau of [0.25, 0.9]) {
      expect(fitLinearQuantileRegression(x, y, tau)).toEqual(scanEveryPair(x, y, tau));
    }
  });

  it("does not evaluate every pairwise slope", () => {
    const n = 150;
    const readsOfX = (shape: string) => {
      const next = random(3);
      const rows = Array.from({ length: n }, () => shapes[shape]!(next));
      let reads = 0;
      const x = new Proxy(
        Float64Array.from(rows, (r) => r[0]),
        {
          get(target, key) {
            reads++;
            return Reflect.get(target, key) as unknown;
          },
        },
      );
      const y = Float64Array.from(rows, (r) => r[1]);
      expect(fitLinearQuantileRegression(x, y, 0.5)).not.toBeNull();
      return reads;
    };
    // Evaluating all 11,175 slopes reads x about 3,350,000 times.
    for (const shape of ["noise", "constant y", "on one line"]) {
      expect(readsOfX(shape)).toBeLessThan(n * n * 4);
    }
  });
});

describe("statQuantile", () => {
  it("emits one series per quantile with n grid points", () => {
    const result = statQuantile({
      x: Float64Array.from([0, 1, 2, 3, 4]),
      y: Float64Array.from([1, 3, 5, 7, 9]),
      groups: [0, 0, 0, 0, 0],
      quantiles: [0.25, 0.5, 0.75],
      n: 5,
      carried: {},
    });
    // 3 quantiles × 5 grid points
    expect(result.x.length).toBe(15);
    expect(new Set(result.groups).size).toBe(3);
    expect(result.droppedGroups).toBe(0);
    // All fits recover the line → y values at grid match 1+2x
    for (let i = 0; i < result.x.length; i++) {
      expect(result.y[i]!).toBeCloseTo(1 + 2 * result.x[i]!, 6);
    }
  });

  it("drops degenerate groups", () => {
    const result = statQuantile({
      x: Float64Array.from([1, 1]),
      y: Float64Array.from([0, 1]),
      groups: [0, 0],
      quantiles: [0.5],
      n: 2,
      carried: {},
    });
    expect(result.x.length).toBe(0);
    expect(result.droppedGroups).toBe(1);
  });
});

describe("fitLinearQuantileRegression output is pinned", () => {
  function seeded(seed: number) {
    let state = seed;
    return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  }

  const SHAPES: Record<string, (n: number) => { x: number[]; y: number[] }> = {
    "noisy line": (n) => {
      const next = seeded(11);
      const x = Array.from({ length: n }, () => next() * 100);
      return { x, y: x.map((v) => 2 * v + 5 + (next() - 0.5) * 30) };
    },
    "integer grid with non-unique optima": (n) => {
      const next = seeded(23);
      return {
        x: Array.from({ length: n }, () => Math.floor(next() * 10)),
        y: Array.from({ length: n }, () => Math.floor(next() * 10)),
      };
    },
    "duplicate x": (n) => {
      const next = seeded(31);
      const x = Array.from({ length: n }, (_, row) => row % 4);
      return { x, y: x.map((v) => v * 3 + next()) };
    },
    "constant y": (n) => ({
      x: Array.from({ length: n }, (_, row) => row),
      y: Array.from({ length: n }, () => 7),
    }),
    outlier: (n) => {
      const x = Array.from({ length: n }, (_, row) => row);
      return { x, y: x.map((v, row) => (row === 3 ? 1e9 : v * 0.5 + 1)) };
    },
    "negative x": (n) => {
      const next = seeded(47);
      const x = Array.from({ length: n }, () => -next() * 1000);
      return { x, y: x.map((v) => 1 - 0.25 * v + next() * 50) };
    },
  };

  for (const [name, shape] of Object.entries(SHAPES)) {
    for (const n of [12, 120, 150, 151, 400]) {
      it(`${name}, n = ${n}`, () => {
        const data = shape(n);
        const x = Float64Array.from(data.x);
        const y = Float64Array.from(data.y);
        const fits = [0.1, 0.5, 0.9].map((tau) => fitLinearQuantileRegression(x, y, tau));
        expect(fits).toMatchSnapshot();
      });
    }
  }
});
