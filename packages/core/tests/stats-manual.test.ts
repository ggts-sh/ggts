/**
 * Pure stat_manual named registry (#814).
 */
import { describe, expect, it, spyOn } from "bun:test";

import { isManualFun, statManual } from "../src/stats/manual.ts";

describe("statManual", () => {
  const groups = [0, 0, 1, 1];
  const x = Float64Array.from([1, 2, 3, 4]);
  const y = Float64Array.from([10, 20, 30, 40]);

  it("first keeps first row per group", () => {
    const result = statManual({ groups, x, y, fun: "first" });
    expect(result.kind).toBe("keep");
    if (result.kind !== "keep") return;
    expect(result.keep).toEqual([0, 2]);
    expect(result.groups).toEqual([0, 1]);
  });

  it("last keeps last row per group", () => {
    const result = statManual({ groups, x, y, fun: "last" });
    expect(result.kind).toBe("keep");
    if (result.kind !== "keep") return;
    expect(result.keep).toEqual([1, 3]);
  });

  it("keeps one source row per group without building row lists", () => {
    const keys = [-0, NaN, 2, 0, NaN, 2, 2, 0];
    const values = Float64Array.from(keys, (_, i) => (i === 0 ? NaN : i));
    const input = { groups: keys, x: values, y: values };
    const set = spyOn(Map.prototype, "set");
    let first: ReturnType<typeof statManual>;
    let last: ReturnType<typeof statManual>;
    let membershipWrites: number;
    try {
      first = statManual({ ...input, fun: "first" });
      last = statManual({ ...input, fun: "last" });
      membershipWrites = set.mock.calls.filter(([, value]) => Array.isArray(value)).length;
    } finally {
      set.mockRestore();
    }

    expect(first).toEqual({ kind: "keep", keep: [0, 1, 2], groups: [-0, NaN, 2] });
    expect(last).toEqual({ kind: "keep", keep: [7, 4, 6], groups: [-0, NaN, 2] });
    expect(Object.is(first.groups[0], -0)).toBe(true);
    expect(Object.is(last.groups[0], -0)).toBe(true);
    expect(membershipWrites).toBe(0);
  });

  it("mean aggregates x and y independently", () => {
    const result = statManual({ groups, x, y, fun: "mean" });
    expect(result.kind).toBe("aggregate");
    if (result.kind !== "aggregate") return;
    expect([...result.x]).toEqual([1.5, 3.5]);
    expect([...result.y]).toEqual([15, 35]);
    expect(result.sampleRows).toEqual([0, 2]);
  });

  it("median aggregates with sort", () => {
    const result = statManual({
      groups: [0, 0, 0],
      x: Float64Array.from([1, 3, 5]),
      y: Float64Array.from([9, 1, 5]),
      fun: "median",
    });
    expect(result.kind).toBe("aggregate");
    if (result.kind !== "aggregate") return;
    expect(result.x[0]!).toBe(3);
    expect(result.y[0]!).toBe(5);
  });

  it("sum aggregates", () => {
    const result = statManual({ groups, x, y, fun: "sum" });
    expect(result.kind).toBe("aggregate");
    if (result.kind !== "aggregate") return;
    expect([...result.x]).toEqual([3, 7]);
    expect([...result.y]).toEqual([30, 70]);
  });

  it("skips non-finite values when aggregating", () => {
    const result = statManual({
      groups: [0, 0, 0],
      x: Float64Array.from([1, Number.NaN, 3]),
      y: Float64Array.from([10, 20, Number.NaN]),
      fun: "mean",
    });
    expect(result.kind).toBe("aggregate");
    if (result.kind !== "aggregate") return;
    expect(result.x[0]!).toBe(2);
    expect(result.y[0]!).toBe(15);
  });

  it("drops groups with no finite x or y under aggregate funs", () => {
    const result = statManual({
      groups: [0, 0],
      x: Float64Array.from([Number.NaN, Number.NaN]),
      y: Float64Array.from([Number.NaN, Number.NaN]),
      fun: "mean",
    });
    expect(result.kind).toBe("aggregate");
    if (result.kind !== "aggregate") return;
    expect(result.x.length).toBe(0);
    expect(result.droppedGroups).toBe(1);
  });

  it("isManualFun validates the closed registry", () => {
    expect(isManualFun("mean")).toBe(true);
    expect(isManualFun("first")).toBe(true);
    expect(isManualFun("identity")).toBe(false);
    expect(isManualFun(null)).toBe(false);
  });
});
