import { describe, expect, it } from "bun:test";

import { CATEGORICAL_SCHEME_NAMES } from "@ggts-sh/spec";

import {
  CATEGORICAL_SCHEMES,
  CATEGORICAL_PALETTE_10,
  COLORBLIND_PALETTE,
  FLEXOKI_PALETTE,
  IPSUM_PALETTE,
  niceLinearDomain,
  trainBand,
  trainColor,
  trainLinear,
} from "../src/scales/train.ts";

describe("niceLinearDomain", () => {
  it("expands to tick-aligned bounds", () => {
    expect(niceLinearDomain(0.13, 9.87)).toEqual([0, 10]);
    expect(niceLinearDomain(-3, 103)).toEqual([-10, 110]);
  });

  it("pads zero-variance domains (ggplot2-style)", () => {
    const [lo, hi] = niceLinearDomain(5, 5);
    expect(lo).toBeLessThan(5);
    expect(hi).toBeGreaterThan(5);
  });

  it("defaults to [0, 1] for non-finite input", () => {
    expect(niceLinearDomain(NaN, NaN)).toEqual([0, 1]);
  });
});

describe("trainLinear", () => {
  it("computes the finite extent across arrays and normalizes into [0,1]", () => {
    const { scale, empty } = trainLinear([
      new Float64Array([1, NaN, 9.5]),
      new Float64Array([3, 4]),
    ]);
    expect(empty).toBe(false);
    expect(scale.domain).toEqual([1, 10]);
    expect(scale.normalize(1)).toBe(0);
    expect(scale.normalize(5.5)).toBe(0.5);
    expect(scale.normalize(10)).toBe(1);
  });

  it("reports empty domains and still yields a usable scale", () => {
    const { scale, empty } = trainLinear([new Float64Array([NaN])]);
    expect(empty).toBe(true);
    expect(scale.domain).toEqual([0, 1]);
  });
});

describe("trainBand", () => {
  it("assigns first-seen band positions (centers)", () => {
    const scale = trainBand([["b", "a", "c", "a"]]);
    expect(scale.domain).toEqual(["b", "a", "c"]);
    expect(scale.rawDomain).toEqual(["b", "a", "c"]);
    expect(scale.indexOf("b")).toBe(0);
    expect(scale.normalize("b")).toBeCloseTo(1 / 6);
    expect(scale.normalize("a")).toBeCloseTo(3 / 6);
    expect(scale.normalize("zzz")).toBeUndefined();
  });

  it("preserves typed categories even when their display labels collide", () => {
    const date = new Date("2025-01-02T00:00:00.000Z");
    const scale = trainBand([[1, "1", true, "true", false, null, date]]);

    expect(scale.domain).toEqual(["1", "1", "true", "true", "false", "(null)", date.toISOString()]);
    expect(scale.rawDomain).toEqual([1, "1", true, "true", false, null, date]);
    expect(scale.indexOf(1)).toBe(0);
    expect(scale.indexOf("1")).toBe(1);
    expect(scale.indexOf(true)).toBe(2);
    expect(scale.indexOf("true")).toBe(3);
    expect(scale.indexOf(false)).toBe(4);
    expect(scale.indexOf(null)).toBe(5);
    expect(scale.indexOf(new Date(date))).toBe(6);
  });
});

describe("trainColor (value-stable, decision 0002)", () => {
  it("matches the audited hrbrthemes and ggthemes categorical palettes exactly", () => {
    expect(IPSUM_PALETTE).toEqual([
      "#d18975",
      "#8fd175",
      "#3f2d54",
      "#75b8d1",
      "#2d543d",
      "#c9d175",
      "#d1ab75",
      "#d175b8",
      "#758bd1",
    ]);
    expect(FLEXOKI_PALETTE).toEqual([
      "#D14D41",
      "#DA702C",
      "#D0A215",
      "#879A39",
      "#3AA99F",
      "#4385BE",
      "#8B7EC8",
      "#CE5D97",
    ]);
    expect(COLORBLIND_PALETTE).toEqual([
      "#000000",
      "#E69F00",
      "#56B4E9",
      "#009E73",
      "#F0E442",
      "#0072B2",
      "#D55E00",
      "#CC79A7",
    ]);
  });

  it("implements every categorical scheme advertised by the spec registry", () => {
    expect(Object.keys(CATEGORICAL_SCHEMES)).toEqual(CATEGORICAL_SCHEME_NAMES);
  });

  it("resolves every named categorical scheme in source order", () => {
    for (const [scheme, palette] of Object.entries(CATEGORICAL_SCHEMES)) {
      const values = palette.map((_, i) => `category-${i}`);
      const scale = trainColor(values, null, { scheme });
      expect(values.map((value) => scale.colorOf(value))).toEqual(palette);
    }
  });

  it("reverses named schemes and gives reversed state a distinct identity", () => {
    const normal = trainColor(["a", "b"], null, { scheme: "ipsum" });
    const reversed = trainColor(["a", "b"], normal.state, { scheme: "ipsum", reverse: true });
    expect(reversed.colorOf("a")).toBe(IPSUM_PALETTE.at(-1));
    expect(reversed.colorOf("b")).toBe(IPSUM_PALETTE.at(-2));
    expect(reversed.warnings.map((warning) => warning.code)).toContain("fingerprint-mismatch");
  });

  it("assigns palette colors first-seen and keeps them across data changes", () => {
    const first = trainColor(["a", "b", "c"]);
    expect(first.colorOf("a")).toBe(CATEGORICAL_PALETTE_10[0]);
    expect(first.colorOf("b")).toBe(CATEGORICAL_PALETTE_10[1]);

    // remove "b": a and c keep their colors
    const second = trainColor(["a", "c"], first.state);
    expect(second.colorOf("a")).toBe(first.colorOf("a"));
    expect(second.colorOf("c")).toBe(first.colorOf("c"));

    // re-add "b": it gets its OLD color back
    const third = trainColor(["a", "b", "c"], second.state);
    expect(third.colorOf("b")).toBe(CATEGORICAL_PALETTE_10[1]);
  });

  it("round-trips state through JSON (SSR adoption path)", () => {
    const first = trainColor(["x", "y"]);
    const revived = JSON.parse(JSON.stringify(first.state)) as typeof first.state;
    const second = trainColor(["y", "z"], revived);
    expect(second.colorOf("y")).toBe(first.colorOf("y"));
  });

  it("exposes O(1) indexOf keyed like color assignment (encodeKey)", () => {
    // Rank must match palette assignment: 1 and "1" are distinct categories.
    const scale = trainColor([1, "1", true, "true"]);
    expect(scale.indexOf(1)).toBe(0);
    expect(scale.indexOf("1")).toBe(1);
    expect(scale.indexOf(true)).toBe(2);
    expect(scale.indexOf("true")).toBe(3);
    expect(scale.indexOf("missing")).toBeUndefined();
    // Value-stable: removed series keep assignment ranks for survivors.
    const afterDrop = trainColor([1, true], scale.state);
    expect(afterDrop.indexOf(1)).toBe(0);
    expect(afterDrop.indexOf(true)).toBe(2);
    expect(afterDrop.indexOf("1")).toBe(1); // still in assignment map
  });
});
