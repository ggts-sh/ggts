import { describe, expect, it } from "bun:test";

import { bwNRD0, statDensity } from "../../src/stats/density.ts";

import { load, maxRelDiff } from "./fixtures.ts";

interface DensityFixture {
  data: { x: number[] };
  expected: {
    bw: number;
    from: number;
    to: number;
    x: number[];
    density: number[];
    count: number[];
    scaled: number[];
  };
}

describe("density stat — R stats::density parity (fixtures)", () => {
  const cases: [string, { n?: number; bw?: number }][] = [
    ["50-density-basic.json", {}],
    ["51-density-bw-adjust.json", { n: 256, bw: 0.3 }],
    ["52-density-group2.json", {}],
  ];
  for (const [name, params] of cases) {
    it(`${name} (direct summation vs R's FFT: rel tol 5e-4)`, () => {
      const fixture = load<DensityFixture>(name);
      const x = Float64Array.from(fixture.data.x);
      const result = statDensity({
        x,
        groups: Array.from({ length: x.length }, () => 0),
        params,
      });
      const expected = fixture.expected;
      expect(result.x.length).toBe(expected.x.length);
      // Bandwidth + grid endpoints are exact.
      if (params.bw === undefined) {
        expect(bwNRD0(Float64Array.from(x).toSorted())).toBeCloseTo(expected.bw, 9);
      }
      expect(result.x[0]!).toBeCloseTo(expected.from, 9);
      expect(result.x.at(-1)!).toBeCloseTo(expected.to, 9);
      // The KDE itself: R approximates by binned FFT; ggts is exact.
      expect(maxRelDiff(expected.density, result.density)).toBeLessThan(5e-4);
      expect(maxRelDiff(expected.count, result.count)).toBeLessThan(5e-4);
      expect(maxRelDiff(expected.scaled, result.scaled)).toBeLessThan(5e-4);
    });
  }
});
