import { describe, expect, it } from "bun:test";

import { plan } from "./fixtures.ts";

const vertical = {
  aesthetic: "y" as const,
  orient: "vertical" as const,
};

describe("planBandAxis: vertical bands (#1846)", () => {
  it("thins a crowded category axis and reports the overlap pressure", () => {
    const categories = Array.from({ length: 20 }, (_, i) => `Category ${i}`);
    const result = plan(categories, 200, vertical);

    expect(result.mode).toBe("single-line");
    expect(result.labelEvery).toBe(2);
    expect(result.ticks.filter((tick) => tick.labeled).map((tick) => tick.label)).toEqual(
      categories.filter((_, i) => i % 2 === 0),
    );
    expect(result.overlap).toBe(false);
    expect(result.degraded).toContain("band-label-overlap");
  });

  it("keeps and flags every label below the thinning cardinality floor", () => {
    const categories = Array.from({ length: 8 }, (_, i) => `Category ${i}`);
    const result = plan(categories, 80, vertical);

    expect(result.labelEvery).toBe(1);
    expect(result.ticks.every((tick) => tick.labeled)).toBe(true);
    expect(result.overlap).toBe(true);
    expect(result.degraded).toContain("band-label-overlap");
  });

  it("lets an author pin every label instead of accepting density thinning", () => {
    const categories = Array.from({ length: 20 }, (_, i) => `Category ${i}`);
    const result = plan(categories, 200, {
      ...vertical,
      config: { mode: "single" },
    });

    expect(result.authorPinned).toBe(true);
    expect(result.labelEvery).toBe(1);
    expect(result.ticks.every((tick) => tick.labeled)).toBe(true);
    expect(result.overlap).toBe(true);
    expect(result.degraded).toContain("band-label-overlap");
  });

  it("does not thin sparse authored breaks with enough vertical pitch", () => {
    const entries = Array.from({ length: 16 }, (_, i) => ({
      value: `Category ${i * 12}`,
      label: `Category ${i * 12}`,
      domainIndex: i * 12,
    }));
    const result = plan([], 480, {
      ...vertical,
      categoryCount: 200,
      entries,
    });

    expect(result.labelEvery).toBe(1);
    expect(result.ticks.every((tick) => tick.labeled)).toBe(true);
    expect(result.overlap).toBe(false);
    expect(result.degraded).toEqual([]);
  });

  it("thins for width only when hidden labels reduce the shown footprint", () => {
    const categories = Array.from({ length: 16 }, (_, i) =>
      i % 2 === 1 ? `Very long category label that exceeds the left margin budget ${i}` : `S${i}`,
    );
    const result = plan(categories, 640, {
      ...vertical,
      orthogonalMarginCapPx: 50,
    });

    expect(result.labelEvery).toBe(2);
    expect(
      result.ticks.filter((tick) => tick.labeled).every((tick) => tick.label.startsWith("S")),
    ).toBe(true);
    expect(result.marginOverflow).toBe(false);
    expect(result.degraded).toContain("band-label-margin-overflow");
  });

  it("truncates and flags a shown label that still exceeds the left margin", () => {
    const result = plan(["A very long vertical category name"], 200, {
      ...vertical,
      orthogonalMarginCapPx: 50,
    });

    expect(result.ticks[0]!.label).not.toBe(result.ticks[0]!.fullLabel);
    expect(result.ticks[0]!.label.endsWith("…")).toBe(true);
    expect(result.marginOverflow).toBe(true);
    expect(result.degraded).toContain("band-label-margin-overflow");
  });
});
