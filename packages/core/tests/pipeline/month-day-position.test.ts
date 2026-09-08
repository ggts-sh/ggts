/**
 * Month-day position conversion: the year collapses inside the scale.
 *
 * Observations from different years that fell on the same calendar day have to
 * land on the same position. The docs lesson used to buy that by projecting
 * day-of-year onto an invented year and shipping the result as data — which
 * moved every leap-year observation by a day. Here the projection happens in
 * the scale, preserves month and day, and is invisible to the reader.
 *
 * Marks (positionColumn) and detached values (positionValuesToNumeric) must
 * share one scale space, or points drift off their own axis.
 */
import { describe, expect, it } from "bun:test";
import { MONTH_DAY_REFERENCE_YEAR, aes, gg, scaleXMonthDay, scaleYMonthDay } from "@ggts-sh/spec";

import { ColumnTable } from "../../src/table.ts";
import { runPipeline } from "../../src/pipeline.ts";
import { axisGuideFor } from "../pipeline-temporal/fixtures.ts";
import {
  positionColumn,
  positionConversionContext,
  positionValuesToNumeric,
} from "../../src/pipeline/temporal-position.ts";

const size = { width: 640, height: 400 };
const conversion = positionConversionContext({ type: "time", temporalKind: "monthDay" });
const REF = MONTH_DAY_REFERENCE_YEAR;

/** Kyoto cherry blossom, spanning the whole record. */
const blooms = [
  { year: 812, bloom: "0812-04-01" },
  { year: 1409, bloom: "1409-03-27" },
  { year: 2001, bloom: "2001-04-01" },
  { year: 2026, bloom: "2026-03-29" },
];

describe("month-day position conversion", () => {
  it("puts the same calendar day from any year in the same place", () => {
    // The entire feature, in one assertion: 812 and 2001 both bloomed on
    // 1 April, 1189 years apart, and the scale has to agree.
    const { values } = positionValuesToNumeric(["0812-04-01", "2001-04-01"], conversion);
    expect(values[0]).toBe(Date.UTC(REF, 3, 1));
    expect(values[1]).toBe(values[0]);
  });

  it("keeps the month and day, not the day of year", () => {
    // 812 is a leap year, so 1 April is its 92nd day; 2001 is not, so its 92nd
    // day is 2 April. Projecting day-of-year — which is what the old
    // bloomRefDate column did — moved 204 of 838 observations by a day.
    const { values } = positionValuesToNumeric(["0812-04-01"], conversion);
    expect(values[0]).toBe(Date.UTC(REF, 3, 1));
    expect(values[0]).not.toBe(Date.UTC(REF, 3, 2));
  });

  it("keeps 29 February, which is why the reference year is a leap year", () => {
    const { values } = positionValuesToNumeric(["1812-02-29", "02-29"], conversion);
    expect(values[0]).toBe(Date.UTC(REF, 1, 29));
    expect(values[1]).toBe(values[0]);
  });

  it("reads bare month-days without asking for a parser", () => {
    const { values } = positionValuesToNumeric(["04-05", "--04-05"], conversion);
    expect(values[0]).toBe(Date.UTC(REF, 3, 5));
    expect(values[1]).toBe(values[0]);
  });

  it("takes the month-day off Date cells too", () => {
    const { values } = positionValuesToNumeric(
      [new Date(Date.UTC(1812, 3, 1, 13, 45))],
      conversion,
    );
    expect(values[0]).toBe(Date.UTC(REF, 3, 1));
  });

  it("leaves values already in the reference year alone", () => {
    // Stats hand back scale-space numbers — a binned median of year-2000
    // instants is another year-2000 instant. Projecting again must be a no-op,
    // or every stat layer drifts a step away from the marks it summarizes.
    const instant = Date.UTC(REF, 3, 15);
    expect(positionValuesToNumeric([instant], conversion).values[0]).toBe(instant);
  });

  it("gives marks and detached values one scale space", () => {
    const table = ColumnTable.fromRows(blooms);
    const column = positionColumn(table, "bloom", conversion);
    const detached = positionValuesToNumeric(
      blooms.map((row) => row.bloom),
      conversion,
    ).values;
    expect(Array.from(column)).toEqual(Array.from(detached));
    expect(column[0]).toBe(Date.UTC(REF, 3, 1));
  });
});

describe("month-day full pipeline", () => {
  const spec = gg(blooms, aes({ x: "year", y: "bloom" }))
    .geomPoint()
    .scales(scaleYMonthDay({ reverse: true, domain: ["03-18", "05-10"] }))
    .spec();

  it("renders full dates on a month-day axis without a parse error", () => {
    const model = runPipeline(spec, size);
    expect(model.warnings.filter((w) => w.code.includes("temporal"))).toEqual([]);
    expect(model.scene.batches.length).toBeGreaterThan(0);
  });

  it("trains a domain that never leaves the reference year", () => {
    const model = runPipeline(spec, size);
    const [min, max] = model.scales.y.domain as [number, number];
    expect(Math.min(min, max)).toBeGreaterThanOrEqual(Date.UTC(REF, 0, 1));
    expect(Math.max(min, max)).toBeLessThanOrEqual(Date.UTC(REF, 11, 31, 23, 59, 59, 999));
  });

  it("collapses the year on x as well, before anything aggregates", () => {
    // Pre-stat grouping keys on the x column. If it groups on the parsed
    // instant rather than the projected one, two observations of the same
    // calendar day from different years stay apart and the collapse never
    // happens — the chart looks plausible and is wrong.
    const twoYearsOneDay = [{ bloom: "0812-04-01" }, { bloom: "2001-04-01" }];
    const model = runPipeline(
      gg(twoYearsOneDay, aes({ x: "bloom" }))
        .geomBar()
        .scales(scaleXMonthDay())
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as { rects: Float64Array };
    expect(batch.rects.length / 4).toBe(1);
  });

  it("summarizes in the same space the marks are drawn in", () => {
    // The lesson draws its trend as a binned median, and a stat reading the
    // wrong space fails silently — the line renders, just in the wrong place.
    // With one observation per bin every median is its own observation, so the
    // summary marks have to land exactly on the points they summarize.
    const perBin = { binwidth: 1, boundary: 0 } as const;
    const raw = runPipeline(
      gg(blooms, aes({ x: "year", y: "bloom" }))
        .geomPoint()
        .scales(scaleYMonthDay())
        .spec(),
      size,
    );
    const binned = runPipeline(
      gg(blooms, aes({ x: "year", y: "bloom" }))
        .geomPoint({ stat: "summary_bin", fun: "median", ...perBin })
        .scales(scaleYMonthDay())
        .spec(),
      size,
    );

    const yPixels = (model: typeof raw) => {
      const batch = model.scene.batches[0] as { positions: Float64Array };
      return Array.from(batch.positions)
        .filter((_, index) => index % 2 === 1)
        .toSorted((a, b) => a - b);
    };

    expect(yPixels(binned)).toHaveLength(blooms.length);
    for (const [index, y] of yPixels(binned).entries()) {
      expect(y).toBeCloseTo(yPixels(raw)[index]!, 6);
    }
  });
});

describe("month-day labels through the pipeline", () => {
  const model = runPipeline(
    gg(blooms, aes({ x: "year", y: "bloom" }))
      .geomPoint()
      .scales(scaleYMonthDay({ reverse: true, domain: ["03-18", "05-10"] }))
      .spec(),
    size,
  );

  it("reads back a calendar day, which is the point of the kind", () => {
    // This is what the crosshair and the tooltip header show. Before the kind
    // existed it would have read "2000-04-01 00:00:00 UTC" — the reference
    // year, in the one place a reader was guaranteed to see it.
    expect(model.axisFormatters.y(Date.UTC(REF, 3, 1))).toBe("Apr 1");
  });

  it("puts no year on any axis tick, visible label or full", () => {
    const guide = axisGuideFor(model.guidePlans, "y");
    expect(guide).toBeDefined();
    expect(guide?.ticks.length).toBeGreaterThan(0);
    for (const tick of guide?.ticks ?? []) {
      expect(tick.label).not.toContain(String(REF));
      expect(tick.fullLabel).not.toContain(String(REF));
    }
  });
});
