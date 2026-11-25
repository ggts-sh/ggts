/**
 * Pure stat_bindot — histodot binning + stack positions (#803).
 */
import { describe, expect, it } from "bun:test";

import { statBindot } from "../src/stats/bindot.ts";

describe("statBindot (histodot)", () => {
  it("stacks up with ranks 1..k at bin centers", () => {
    // x in (0.5, 1.5] → bin center 1; (1.5, 2.5] → center 2 (right-closed, boundary 0.5)
    const x = Float64Array.from([1, 1, 1, 2, 2]);
    const result = statBindot({
      x,
      groups: [0, 0, 0, 0, 0],
      params: { binwidth: 1, boundary: 0.5, stackdir: "up", stackratio: 1 },
    });
    expect(result.dropped).toBe(0);
    expect(result.x.length).toBe(5);
    expect([...result.x]).toEqual([1, 1, 1, 2, 2]);
    expect([...result.stackpos]).toEqual([1, 2, 3, 1, 2]);
    expect([...result.count]).toEqual([3, 3, 3, 2, 2]);
  });

  it("stackdir down uses negative ranks", () => {
    const x = Float64Array.from([1, 1, 1]);
    const result = statBindot({
      x,
      groups: [0, 0, 0],
      params: { binwidth: 1, boundary: 0.5, stackdir: "down", stackratio: 1 },
    });
    expect([...result.stackpos]).toEqual([-1, -2, -3]);
  });

  it("stackdir center centers stack on 0", () => {
    const x = Float64Array.from([1, 1, 1]);
    const result = statBindot({
      x,
      groups: [0, 0, 0],
      params: { binwidth: 1, boundary: 0.5, stackdir: "center", stackratio: 1 },
    });
    // ranks 1,2,3; offset (k+1)/2 = 2 → -1, 0, 1
    expect([...result.stackpos]).toEqual([-1, 0, 1]);
  });

  it("stackdir centerwhole uses integer mid for even k", () => {
    const x = Float64Array.from([1, 1, 1, 1]);
    const result = statBindot({
      x,
      groups: [0, 0, 0, 0],
      params: { binwidth: 1, boundary: 0.5, stackdir: "centerwhole", stackratio: 1 },
    });
    // k=4, ceil(k/2)=2 → ranks-2 → -1, 0, 1, 2
    expect([...result.stackpos]).toEqual([-1, 0, 1, 2]);
  });

  it("stackratio scales spacing", () => {
    const x = Float64Array.from([1, 1]);
    const result = statBindot({
      x,
      groups: [0, 0],
      params: { binwidth: 1, boundary: 0.5, stackdir: "up", stackratio: 0.5 },
    });
    expect([...result.stackpos]).toEqual([0.5, 1]);
  });

  it("drops non-finite x and out-of-range after break construction", () => {
    const x = Float64Array.from([1, NaN, Infinity, 2]);
    const result = statBindot({
      x,
      groups: [0, 0, 0, 0],
      params: { binwidth: 1, boundary: 0.5, stackdir: "up" },
    });
    expect(result.dropped).toBe(2);
    expect(result.x.length).toBe(2);
  });

  it("stacks groups separately on shared breaks", () => {
    const x = Float64Array.from([1, 1, 1, 1]);
    const result = statBindot({
      x,
      groups: [0, 0, 1, 1],
      params: { binwidth: 1, boundary: 0.5, stackdir: "up" },
    });
    expect([...result.groups]).toEqual([0, 0, 1, 1]);
    expect([...result.stackpos]).toEqual([1, 2, 1, 2]);
    expect([...result.count]).toEqual([2, 2, 2, 2]);
  });

  it("preserves source row indices for aesthetics", () => {
    const x = Float64Array.from([1, 2, 1]);
    const result = statBindot({
      x,
      groups: [0, 0, 0],
      params: { binwidth: 1, boundary: 0.5, stackdir: "up" },
    });
    // Emission order: by (group, bin, input order) — bin of 1 first, then bin of 2
    expect([...result.sourceRows]).toEqual([0, 2, 1]);
  });

  it("emits sparse bins in group and bin order with original stack order", () => {
    const result = statBindot({
      x: Float64Array.from([8, 0, 0, 8, 4, 8, NaN]),
      groups: [-0, 0, 0, 2, NaN, 2, 0],
      carried: { label: ["a", "b", "c", "d", "e", "f", "g"] },
      params: { bins: 128 },
      range: [0, 8],
    });

    expect(result.groups).toEqual([-0, -0, -0, 2, 2, NaN]);
    expect(result.sourceRows).toEqual([1, 2, 0, 3, 5, 4]);
    expect(result.carried.label).toEqual(["b", "c", "a", "d", "f", "e"]);
    expect([...result.stackpos]).toEqual([1, 2, 1, 1, 2, 1]);
    expect(result.dropped).toBe(1);
  });

  it("k=1 yields a single stack position", () => {
    const x = Float64Array.from([1]);
    const result = statBindot({
      x,
      groups: [0],
      params: { binwidth: 1, boundary: 0.5, stackdir: "up" },
    });
    expect([...result.stackpos]).toEqual([1]);
    expect([...result.count]).toEqual([1]);
  });

  it("empty finite input yields empty result", () => {
    const x = Float64Array.from([NaN, Infinity]);
    const result = statBindot({
      x,
      groups: [0, 0],
      params: { binwidth: 1, stackdir: "up" },
    });
    expect(result.x.length).toBe(0);
    expect(result.dropped).toBe(2);
  });

  it("reports usedDefaultBins when neither bins nor binwidth set", () => {
    const x = Float64Array.from([0, 1, 2, 3, 4]);
    const result = statBindot({
      x,
      groups: [0, 0, 0, 0, 0],
      params: { stackdir: "up" },
    });
    expect(result.usedDefaultBins).toBe(true);
    expect(result.x.length).toBe(5);
  });
});
