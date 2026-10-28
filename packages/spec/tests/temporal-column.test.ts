/**
 * Column temporal inference / materialization (packages/spec/src/temporal-column.ts).
 * Value parsing: temporal-parse.test.ts. Authoring helpers: temporal-helpers.test.ts.
 */
import { describe, expect, it } from "bun:test";

import { inferTemporalColumn, parseTemporalColumn } from "../src/temporal.ts";

describe("value-driven temporal inference", () => {
  it("infers string years but keeps numeric years quantitative/non-temporal", () => {
    const years = inferTemporalColumn(["1835", "1900", null, "2026"]);
    expect(years).toMatchObject({
      status: "temporal",
      parser: "year",
      precision: "year",
      validatedCount: 3,
    });
    expect(inferTemporalColumn([1835, 1900, 2026])).toMatchObject({ status: "nominal" });
    expect(inferTemporalColumn([1835, "1900", "2026"])).toMatchObject({ status: "nominal" });
  });

  it("infers ISO, year-month, month-year, and year-quarter families", () => {
    expect(inferTemporalColumn(["2024-01-01", "2024-02-03"])).toMatchObject({
      status: "temporal",
      parser: "iso",
    });
    expect(inferTemporalColumn(["2024-01", "2024-02"])).toMatchObject({
      status: "temporal",
      parser: "ym",
    });
    expect(inferTemporalColumn(["01-2024", "02-2024"])).toMatchObject({
      status: "temporal",
      parser: "my",
    });
    expect(inferTemporalColumn(["2024-Q1", "2024-Q4"])).toMatchObject({
      status: "temporal",
      parser: "yq",
    });
  });

  it("does not guess ambiguous date orders or two-digit years", () => {
    const ambiguous = inferTemporalColumn(["03/04/2024", "05/06/2024"]);
    expect(ambiguous.status).toBe("ambiguous");
    expect(ambiguous.candidates).toContain("mdy");
    expect(ambiguous.candidates).toContain("dmy");
    expect(inferTemporalColumn(["03/04/24", "05/06/24"])).toMatchObject({ status: "nominal" });
  });

  it("uses bounded head/tail classification then validates the whole column", () => {
    const values = Array.from({ length: 100 }, (_, index) => `${1900 + index}`);
    values[50] = "not-a-year";
    const decision = inferTemporalColumn(values);
    expect(decision).toMatchObject({ status: "invalid", failedCount: 1, validatedCount: 99 });
    expect(decision.failures?.[0]?.value).toBe("not-a-year");
  });

  it("reports the finest precision independent of row order", () => {
    const coarseFirst = inferTemporalColumn(["2024-01-01", "2024-01-02T12:30:45"]);
    const fineFirst = inferTemporalColumn(["2024-01-02T12:30:45", "2024-01-01"]);
    expect(coarseFirst.precision).toBe("second");
    expect(fineFirst.precision).toBe("second");
    expect(
      parseTemporalColumn(["2024-01-01", "2024-01-02T12:30:45"], "iso").decision.precision,
    ).toBe("second");
  });

  it("accepts Date plus compatible ISO values and rejects incoherent mixtures", () => {
    expect(inferTemporalColumn([new Date("2024-01-01T00:00:00Z"), "2024-01-02"])).toMatchObject({
      status: "temporal",
      parser: "iso",
    });
    expect(inferTemporalColumn([new Date("2024-01-01T00:00:00Z"), "hello"])).toMatchObject({
      status: "nominal",
    });
    expect(inferTemporalColumn([new Date("2024-01-01T00:00:00Z"), "2025"])).toMatchObject({
      status: "nominal",
    });
  });

  /**
   * Regression for O(1)-memory sampling (#analyzeNonNull): number/boolean or
   * mixed non-Date values outside the 64-value head/tail sample must still
   * force nominal / full-column invalidation (full-column facts, not sample).
   */
  it("rejects number/boolean and mixed Date noise outside the head/tail sample window", () => {
    const years = Array.from({ length: 200 }, (_, index) => `${1800 + index}`);
    years[100] = 42 as unknown as string;
    expect(inferTemporalColumn(years)).toMatchObject({
      status: "nominal",
      nonNullCount: 200,
    });

    const iso = Array.from(
      { length: 200 },
      (_, index) => `2024-01-${String((index % 28) + 1).padStart(2, "0")}`,
    );
    iso[100] = true as unknown as string;
    expect(inferTemporalColumn(iso)).toMatchObject({ status: "nominal" });

    const dates = Array.from(
      { length: 200 },
      (_, index) => new Date(Date.UTC(2024, 0, (index % 28) + 1)),
    );
    dates[100] = "not-a-date" as unknown as Date;
    // Native Date column with an off-sample non-Date fails whole-column validation.
    expect(inferTemporalColumn(dates).status).toBe("invalid");
  });

  /** #1862: a number decides nominal early; evidence and counts stay full-column. */
  it("keeps nominal evidence and counts when a number decides the column", () => {
    const numbers = Array.from({ length: 200 }, (_, index) => (index % 3 === 0 ? null : index));
    const numeric = parseTemporalColumn(numbers, "auto");
    expect(numeric.decision).toMatchObject({ status: "nominal", nonNullCount: 133 });
    expect(numeric.decision.evidence).toEqual([1, 2, 4, 5, 7, 8, 10, 11]);
    expect(numeric.semantic.every(Number.isNaN)).toBe(true);
    expect(numeric.valid.every((flag) => flag === 0)).toBe(true);

    const years = Array.from<string | number | null>({ length: 200 }, (_, index) =>
      index === 0 ? null : `${1800 + index}`,
    );
    years[150] = 7;
    const late = inferTemporalColumn(years);
    expect(late).toMatchObject({ status: "nominal", nonNullCount: 199 });
    expect(late.evidence).toEqual(["1801", "1802", "1803", "1804", "1805", "1806", "1807", "1808"]);
  });

  it("clears values written before whole-column validation fails", () => {
    const values = Array.from({ length: 100 }, (_, index) => `${1900 + index}`);
    values[50] = "not-a-year";
    const parsed = parseTemporalColumn(values, "auto");
    expect(parsed.decision.status).toBe("invalid");
    expect(parsed.semantic.every(Number.isNaN)).toBe(true);
    expect(parsed.valid.every((flag) => flag === 0)).toBe(true);
  });

  it("keeps head/tail sample evidence for large temporal columns", () => {
    const values = Array.from({ length: 200 }, (_, index) => `${1900 + index}`);
    const decision = inferTemporalColumn(values);
    expect(decision).toMatchObject({
      status: "temporal",
      parser: "year",
      nonNullCount: 200,
      validatedCount: 200,
    });
    expect(decision.evidence[0]).toBe("1900");
    expect(decision.evidence).toHaveLength(8);
  });
});
