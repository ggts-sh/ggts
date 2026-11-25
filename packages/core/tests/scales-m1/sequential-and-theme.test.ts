/**
 * Sequential color ramps (M1 scale surface companions).
 */
import { describe, expect, it, spyOn } from "bun:test";

import {
  buildRampLut,
  rampColor,
  RAMP_LUT_STEPS,
  sampleRampLut,
  trainSequential,
  VIRIDIS_RAMP_10,
} from "../../src/scales/color.ts";

describe("sequential color", () => {
  it("reuses the lookup table for equal normalized stops and isolates later ranges", () => {
    const range = ["#123", "#abc", "#fed"];
    const original = trainSequential([0, 1], { range });
    const round = spyOn(Math, "round");
    let normalized: ReturnType<typeof trainSequential>;
    let tableRounding: number;
    try {
      normalized = trainSequential([1, 100], {
        range: ["#112233", "#AABBCC", "#ffeedd"],
        transform: "log10",
      });
      tableRounding = round.mock.calls.length;
    } finally {
      round.mockRestore();
    }

    expect(tableRounding).toBe(0);
    expect(original.at(0.5)).toBe("#aabbcc");
    expect(normalized.at(0.5)).toBe("#aabbcc");

    Object.defineProperty(normalized.stops, 1, { value: "#000000" });
    range[1] = "#456";
    const changed = trainSequential([0, 1], { range, reverse: true });
    expect(changed.at(0)).toBe("#ffeedd");
    expect(changed.at(0.5)).toBe("#445566");
    expect(original.at(0.5)).toBe("#aabbcc");
    expect(normalized.at(0.5)).toBe("#aabbcc");
  });

  it("rejects an empty range even after training a one-slot sparse range", () => {
    const sparse: string[] = [];
    sparse.length = 1;
    trainSequential([0, 1], { range: sparse });
    expect(() => trainSequential([0, 1], { range: [] })).toThrow(
      "Ramp LUT needs at least one color stop.",
    );
  });

  it("interpolates the viridis ramp deterministically", () => {
    expect(rampColor(VIRIDIS_RAMP_10, 0)).toBe("#440154");
    expect(rampColor(VIRIDIS_RAMP_10, 1)).toBe("#fde725");
    expect(rampColor(["#000000", "#ffffff"], 0.5)).toBe("#808080");
  });

  it("maps the data extent, returns undefined for non-finite values", () => {
    const scale = trainSequential([0, 10]);
    expect(scale.colorOf(0)).toBe("#440154");
    expect(scale.colorOf(10)).toBe("#fde725");
    expect(scale.colorOf(null)).toBeUndefined();
    expect(scale.colorOf(Number.NaN)).toBeUndefined();
  });

  it("normalizes three-digit hex stops before interpolation", () => {
    const scale = trainSequential([0, 1], { range: ["#f00", "#00F"] });

    expect(scale.stops).toEqual(["#ff0000", "#0000ff"]);
    expect(scale.colorOf(0)).toBe("#ff0000");
    expect(scale.colorOf(0.5)).toBe("#800080");
    expect(scale.colorOf(1)).toBe("#0000ff");
  });

  it("refuses unsupported custom stops instead of emitting malformed colors", () => {
    expect(() => trainSequential([0, 1], { range: ["red", "blue"] })).toThrow(
      'Sequential color stops must use #rgb or #rrggbb syntax (got "red").',
    );
  });

  it("supports explicit domain, custom range, and reverse", () => {
    const scale = trainSequential([0, 1], {
      domain: [0, 100],
      range: ["#000000", "#ffffff"],
      reverse: true,
    });
    expect(scale.colorOf(0)).toBe("#ffffff");
    expect(scale.colorOf(100)).toBe("#000000");
    expect(scale.colorOf(50)).toBe("#808080");
  });

  it("trains a dense ramp LUT whose mid/endpoints match continuous rampColor", () => {
    const stops = ["#000000", "#ffffff"] as const;
    const lut = buildRampLut(stops, RAMP_LUT_STEPS);
    expect(lut).toHaveLength(RAMP_LUT_STEPS + 1);
    expect(sampleRampLut(lut, 0)).toBe(rampColor(stops, 0));
    expect(sampleRampLut(lut, 1)).toBe(rampColor(stops, 1));
    // 1024 steps → t=0.5 lands on an exact entry (same #808080 as continuous).
    expect(sampleRampLut(lut, 0.5)).toBe(rampColor(stops, 0.5));
    expect(sampleRampLut(lut, 0.5)).toBe("#808080");
  });

  it("uses the trained LUT for sequential colorOf at fixture midpoints", () => {
    const scale = trainSequential([0, 1], { range: ["#f00", "#00F"] });
    expect(scale.colorOf(0.5)).toBe("#800080");
    // Log-spaced endpoints and interior match the continuous log10 fixtures.
    const logScale = trainSequential([1, 1000], {
      transform: "log10",
      range: ["#000000", "#ffffff"],
    });
    expect(logScale.colorOf(1)).toBe("#000000");
    expect(logScale.colorOf(10)).toBe("#555555");
    expect(logScale.colorOf(100)).toBe("#aaaaaa");
    expect(logScale.colorOf(1000)).toBe("#ffffff");
  });
});
