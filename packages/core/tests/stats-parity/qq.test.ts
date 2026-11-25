/**
 * Pure Q–Q stat tests (#804).
 */
import { describe, expect, it, spyOn } from "bun:test";

import { ppoints, qnorm, statQq, statQqLine } from "../../src/stats/qq.ts";

describe("qnorm / ppoints (#804)", () => {
  it("qnorm(0.5) is ~0", () => {
    expect(qnorm(0.5)).toBeCloseTo(0, 10);
  });

  it("qnorm is antisymmetric around 0.5", () => {
    expect(qnorm(0.9)).toBeCloseTo(-qnorm(0.1), 8);
  });

  it("ppoints length and bounds", () => {
    const p = ppoints(5);
    expect(p.length).toBe(5);
    expect(p[0]!).toBeGreaterThan(0);
    expect(p[4]!).toBeLessThan(1);
    // Monotone
    for (let i = 1; i < p.length; i++) expect(p[i]!).toBeGreaterThan(p[i - 1]!);
  });
});

describe("statQq (#804)", () => {
  it("emits one row per finite sample value, sorted on sample", () => {
    const result = statQq({
      sample: Float64Array.from([3, 1, 2, NaN]),
      groups: [0, 0, 0, 0],
    });
    expect(result.dropped).toBe(1);
    expect(result.sample.length).toBe(3);
    expect([...result.sample]).toEqual([1, 2, 3]);
    // Theoretical increases with ppoints order
    expect(result.theoretical[0]!).toBeLessThan(result.theoretical[1]!);
    expect(result.theoretical[1]!).toBeLessThan(result.theoretical[2]!);
  });

  it("computes groups separately", () => {
    const result = statQq({
      sample: Float64Array.from([1, 2, 10, 20]),
      groups: [0, 0, 1, 1],
    });
    expect(result.sample.length).toBe(4);
    expect(result.groups.filter((g) => g === 0).length).toBe(2);
    expect(result.groups.filter((g) => g === 1).length).toBe(2);
  });
});

describe("statQqLine (#804)", () => {
  it("computes only the two theoretical tails needed for the line span", () => {
    const size = 1_000;
    const input = {
      sample: Float64Array.from({ length: size }, (_, i) => i),
      groups: Array.from({ length: size }, () => 0),
    };
    const cloud = statQq(input);
    const log = spyOn(Math, "log");
    let line: ReturnType<typeof statQqLine>;
    let tailEvaluations: number;
    try {
      line = statQqLine(input);
      tailEvaluations = log.mock.calls.length;
    } finally {
      log.mockRestore();
    }

    expect([...line.theoretical]).toEqual([cloud.theoretical[0], cloud.theoretical.at(-1)]);
    expect(tailEvaluations).toBe(2);
  });

  it("emits two endpoints per group", () => {
    const result = statQqLine({
      sample: Float64Array.from([1, 2, 3, 4, 5]),
      groups: [0, 0, 0, 0, 0],
    });
    expect(result.theoretical.length).toBe(2);
    expect(result.sample.length).toBe(2);
    // Line spans theoretical range (endpoints ordered)
    expect(result.theoretical[0]!).toBeLessThan(result.theoretical[1]!);
  });

  it("drops groups with fewer than two finite values", () => {
    const result = statQqLine({
      sample: Float64Array.from([1, NaN]),
      groups: [0, 0],
    });
    expect(result.theoretical.length).toBe(0);
  });
});
