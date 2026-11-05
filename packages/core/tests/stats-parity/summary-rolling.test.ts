/**
 * summary_rolling stat — centered rolling-window summaries over continuous x.
 *
 * Contract (see src/stats/summary-rolling.ts): one output row per (group,
 * unique x); each row summarizes y over the window |x − center| ≤ window/2.
 * Partial windows at the series ends are kept (divergence from zoo's default
 * NA padding — a running line should reach both ends of the data).
 */
import { describe, expect, it } from "bun:test";

import { statSummaryRolling } from "../../src/stats/summary-rolling.ts";
import { applySummaryFun, type SummaryFunName } from "../../src/stats/summary.ts";

const FUNS: readonly SummaryFunName[] = ["mean", "median", "sum", "min", "max"];

/** The contract with no sliding state: every window is evaluated from scratch. */
function naiveRolling(
  x: Float64Array,
  y: Float64Array,
  groups: readonly number[],
  window: number,
  fun: SummaryFunName,
): number[] {
  const out: number[] = [];
  for (const group of new Set(groups)) {
    const rows = [...x.keys()].filter((row) => groups[row] === group);
    const centers = [...new Set(rows.map((row) => x[row]!))].toSorted((a, b) => a - b);
    for (const center of centers) {
      const values = rows
        .filter((row) => x[row]! >= center - window / 2 && x[row]! <= center + window / 2)
        .map((row) => y[row]!)
        .toSorted((a, b) => a - b);
      out.push(applySummaryFun(fun, values, true));
    }
  }
  return out;
}

function seededSeries(rowCount: number, xOf: (row: number) => number, seed: number) {
  let state = seed;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  return {
    x: Float64Array.from({ length: rowCount }, (_, row) => xOf(row)),
    // Rounded so windows hold ties, and centered so sums cross zero.
    // `+ 0` turns the -0 that Math.round can return into +0.
    y: Float64Array.from({ length: rowCount }, () => Math.round((next() - 0.5) * 40) / 2 + 0),
  };
}

const SERIES = [
  { name: "dense x", rowCount: 300, xOf: (row: number) => row, window: 25 },
  { name: "duplicate x", rowCount: 300, xOf: (row: number) => Math.floor(row / 3), window: 7 },
  {
    name: "gaps wider than the window",
    rowCount: 300,
    xOf: (row: number) => Math.floor(row / 20) * 1000 + (row % 20),
    window: 9,
  },
  { name: "window wider than the span", rowCount: 60, xOf: (row: number) => row, window: 1000 },
  { name: "tiny window", rowCount: 60, xOf: (row: number) => Math.floor(row / 2), window: 1e-9 },
  { name: "shuffled x", rowCount: 200, xOf: (row: number) => (row * 37) % 200, window: 15 },
];

describe("statSummaryRolling", () => {
  for (const { name, rowCount, xOf, window } of SERIES) {
    for (const fun of FUNS) {
      it(`matches a from-scratch evaluation of every window: ${name}, ${fun}`, () => {
        for (const groupCount of [1, 3]) {
          const { x, y } = seededSeries(rowCount, xOf, 7);
          const groups = Array.from({ length: rowCount }, (_, row) => row % groupCount);
          const result = statSummaryRolling({ x, y, groups, params: { window, fun } });
          const expected = naiveRolling(x, y, groups, window, fun);
          expect(result.y.length).toBe(expected.length);
          for (const [index, value] of expected.entries()) {
            if (fun === "mean" || fun === "sum") expect(result.y[index]).toBeCloseTo(value, 9);
            else expect(result.y[index]).toBe(value);
          }
        }
      });
    }
  }

  for (const fun of ["mean", "median"] as const) {
    it(`does not sort every window of a long series: ${fun}`, () => {
      // 70 days of minute data with a one-day window. Sorting every window takes
      // about 10 s here; the sliding window takes about 20 ms.
      const { x, y } = seededSeries(100_000, (row) => row, 11);
      const groups = Array.from<number>({ length: x.length }).fill(0);
      const started = performance.now();
      statSummaryRolling({ x, y, groups, params: { window: 1440, fun } });
      expect(performance.now() - started).toBeLessThan(2000);
    }, 30_000);
  }

  it("keeps +0 when a window sums to zero from -0 values", () => {
    const x = Float64Array.from([1, 2]);
    const y = Float64Array.from([-0, -0]);
    const groups = [0, 0];
    for (const fun of ["mean", "sum"] as const) {
      const result = statSummaryRolling({ x, y, groups, params: { window: 1, fun } });
      expect([...result.y]).toEqual([0, 0]);
    }
  });

  it("forgets an outlier as soon as it leaves the window", () => {
    // A running or prefix sum fails here: (1e300 + 1) - 1e300 is 0, so the ones
    // added while the outlier was in the window would be lost.
    const rowCount = 40;
    const x = Float64Array.from({ length: rowCount }, (_, row) => row);
    for (let outlier = 0; outlier < rowCount; outlier++) {
      const y = new Float64Array(rowCount).fill(1);
      y[outlier] = 1e300;
      const result = statSummaryRolling({
        x,
        y,
        groups: Array.from<number>({ length: rowCount }).fill(0),
        params: { window: 6, fun: "mean" },
      });
      for (let center = 0; center < rowCount; center++) {
        if (Math.abs(center - outlier) > 3) expect(result.y[center]).toBe(1);
      }
    }
  });

  it("centers the window on each unique x and keeps partial edge windows", () => {
    // window 2 → half-width 1; y = 10x on x = 1..5.
    const x = Float64Array.from([1, 2, 3, 4, 5]);
    const y = Float64Array.from([10, 20, 30, 40, 50]);
    const result = statSummaryRolling({
      x,
      y,
      groups: [0, 0, 0, 0, 0],
      params: { window: 2, fun: "mean" },
    });
    expect([...result.x]).toEqual([1, 2, 3, 4, 5]);
    expect([...result.y]).toEqual([15, 20, 30, 40, 45]);
    expect([...result.groups]).toEqual([0, 0, 0, 0, 0]);
    expect(result.dropped).toBe(0);
  });

  it("median averages the two middle values of an even-sized window", () => {
    const x = Float64Array.from([1, 2, 3]);
    const y = Float64Array.from([1, 2, 100]);
    const result = statSummaryRolling({
      x,
      y,
      groups: [0, 0, 0],
      params: { window: 2, fun: "median" },
    });
    // center 1 → {1, 2} → 1.5; center 2 → {1, 2, 100} → 2; center 3 → {2, 100} → 51.
    expect([...result.y]).toEqual([1.5, 2, 51]);
  });

  it("includes every row at a duplicated x inside the window", () => {
    const x = Float64Array.from([1, 2, 2, 3]);
    const y = Float64Array.from([10, 20, 40, 60]);
    const result = statSummaryRolling({
      x,
      y,
      groups: [0, 0, 0, 0],
      params: { window: 2, fun: "mean" },
    });
    expect([...result.x]).toEqual([1, 2, 3]);
    // center 1 → {10,20,40} = 70/3; center 2 → all four = 32.5; center 3 → {20,40,60} = 40.
    expect(result.y[0]).toBeCloseTo(70 / 3, 9);
    expect(result.y[1]).toBe(32.5);
    expect(result.y[2]).toBe(40);
  });

  it("never lets a window cross groups, even at overlapping x", () => {
    const x = Float64Array.from([1, 2, 3, 1, 2, 3]);
    const y = Float64Array.from([10, 20, 30, 100, 200, 300]);
    const result = statSummaryRolling({
      x,
      y,
      groups: [0, 0, 0, 1, 1, 1],
      params: { window: 2, fun: "mean" },
    });
    expect([...result.x]).toEqual([1, 2, 3, 1, 2, 3]);
    expect([...result.y]).toEqual([15, 20, 25, 150, 200, 250]);
    expect([...result.groups]).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it("sorts unsorted x internally and drops rows with missing x or y", () => {
    const x = Float64Array.from([3, 1, 2]);
    const y = Float64Array.from([30, 10, Number.NaN]);
    const result = statSummaryRolling({
      x,
      y,
      groups: [0, 0, 0],
      params: { window: 2, fun: "mean" },
    });
    expect(result.dropped).toBe(1);
    expect([...result.x]).toEqual([1, 3]);
    // center 1 → {10}; center 3 → {30} (the dropped row never joins a window).
    expect([...result.y]).toEqual([10, 30]);
  });

  it("carries constant-per-group columns onto the output rows", () => {
    const x = Float64Array.from([1, 2, 3]);
    const y = Float64Array.from([1, 2, 3]);
    const result = statSummaryRolling({
      x,
      y,
      groups: [0, 0, 0],
      carried: { series: ["a", "a", "a"] },
      params: { window: 2, fun: "max" },
    });
    expect(result.carried["series"]).toEqual(["a", "a", "a"]);
  });

  it("fun defaults to mean", () => {
    const x = Float64Array.from([1, 2]);
    const y = Float64Array.from([4, 8]);
    const result = statSummaryRolling({ x, y, groups: [0, 0], params: { window: 2 } });
    expect([...result.y]).toEqual([6, 6]);
  });

  it("throws loudly when window is missing or non-positive", () => {
    const x = Float64Array.from([1, 2]);
    const y = Float64Array.from([4, 8]);
    expect(() => statSummaryRolling({ x, y, groups: [0, 0], params: {} })).toThrow(/window/);
    expect(() => statSummaryRolling({ x, y, groups: [0, 0], params: { window: 0 } })).toThrow(
      /window/,
    );
  });

  it("throws loudly for a manual keep fun instead of aliasing max", () => {
    // first|last are stat manual's row-keep transforms; on a summary stat
    // they must fail, not fall through applySummaryFun's default to max.
    const x = Float64Array.from([1, 2]);
    const y = Float64Array.from([4, 8]);
    expect(() =>
      statSummaryRolling({ x, y, groups: [0, 0], params: { window: 2, fun: "first" as never } }),
    ).toThrow(/summary fun/);
    expect(() =>
      statSummaryRolling({ x, y, groups: [0, 0], params: { window: 2, fun: "last" as never } }),
    ).toThrow(/summary fun/);
  });
});
