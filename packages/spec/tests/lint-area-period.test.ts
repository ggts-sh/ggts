/** area-over-period-totals lint behavior (issue #1882). */
import { describe, expect, it } from "bun:test";

import { lintSpec, type SpecAdvisory } from "../src/lint.ts";

const CODE = "area-over-period-totals";

const codesOf = (advisories: SpecAdvisory[]) => advisories.map((a) => a.code);

/** Busy counts per year (zero years are the gaps the issue calls out). */
const BUSY: Readonly<Record<number, number>> = {
  2001: 1,
  2002: 30,
  2003: 1,
  2008: 2,
  2009: 55,
  2010: 1,
  2014: 20,
  2015: 18,
  2016: 6,
  2017: 5,
  2019: 24,
  2020: 12,
  2021: 11,
};
const SHARES = [60, 25, 8, 4, 1.2, 0.8, 0.6, 0.4] as const;
const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/** The issue's repro rows: 8 groups × 23 January-1 years with interior zeros. */
function reproRows(): Array<{ year: string; group: string; n: number }> {
  const rows: Array<{ year: string; group: string; n: number }> = [];
  for (let year = 2000; year <= 2022; year++) {
    for (let group = 0; group < GROUPS.length; group++) {
      rows.push({
        year: `${year}-01-01`,
        group: GROUPS[group]!,
        n: Math.round((BUSY[year] ?? 0) * SHARES[group]!),
      });
    }
  }
  return rows;
}

const areaLayer = (extra: Record<string, unknown> = {}) => ({
  geom: "area",
  position: "stack",
  aes: {
    x: { field: "year" },
    y: { field: "n" },
    fill: { field: "group" },
    group: { field: "group" },
  },
  ...extra,
});

const layerLocalRepro = () => ({
  scales: { x: { type: "time", labels: "%Y" } },
  layers: [areaLayer({ data: { values: reproRows() } })],
});

/** One row per period, single series, all non-zero. */
const seriesRows = (x: string[], y = (index: number) => index + 1) =>
  x.map((value, index) => ({ year: value, n: y(index) }));

const singleSeries = (values: unknown[], extra: Record<string, unknown> = {}) => ({
  layers: [
    {
      geom: "area",
      position: "stack",
      data: { values },
      aes: { x: { field: "year" }, y: { field: "n" } },
      ...extra,
    },
  ],
});

describe("area-over-period-totals", () => {
  it("fires on the issue repro with layer-local data", () => {
    const advisories = lintSpec(layerLocalRepro());
    expect(codesOf(advisories)).toContain(CODE);
    const advisory = advisories.find((a) => a.code === CODE)!;
    expect(advisory.path).toBe("/layers/0/aes/x");
    expect(advisory.suggestion?.example).toEqual({ geom: "col", position: "stack" });
    expect(advisory.message).toContain('"year"');
    expect(advisory.message).toContain("year grid");
  });

  it("fires on the same data at plot level", () => {
    const spec = {
      scales: { x: { type: "time", labels: "%Y" } },
      data: { values: reproRows() },
      layers: [areaLayer()],
    };
    expect(codesOf(lintSpec(spec))).toContain(CODE);
  });

  it("stays silent for 60 consecutive daily dates", () => {
    const dates: string[] = [];
    const start = Date.UTC(2000, 0, 1);
    for (let day = 0; day < 60; day++) {
      dates.push(new Date(start + day * 86_400_000).toISOString().slice(0, 10));
    }
    expect(codesOf(lintSpec(singleSeries(seriesRows(dates))))).not.toContain(CODE);
  });

  it("stays silent for 36 first-of-month dates with no zeros", () => {
    const months: string[] = [];
    for (let month = 0; month < 36; month++) {
      const date = new Date(Date.UTC(2000, month, 1));
      months.push(date.toISOString().slice(0, 10));
    }
    expect(codesOf(lintSpec(singleSeries(seriesRows(months))))).not.toContain(CODE);
  });

  it("stays silent for 24 first-of-month dates with monotone y (few points)", () => {
    const months: string[] = [];
    for (let month = 0; month < 24; month++) {
      months.push(new Date(Date.UTC(2000, month, 1)).toISOString().slice(0, 10));
    }
    expect(codesOf(lintSpec(singleSeries(seriesRows(months))))).not.toContain(CODE);
  });

  it("fires for 24 first-of-month dates with fluctuating integer counts", () => {
    const months: string[] = [];
    for (let month = 0; month < 24; month++) {
      months.push(new Date(Date.UTC(2000, month, 1)).toISOString().slice(0, 10));
    }
    const y = (index: number) => [4, 9, 2, 7][index % 4]!;
    expect(codesOf(lintSpec(singleSeries(seriesRows(months, y))))).toContain(CODE);
  });

  it("fires for a quarter grid with an interior zero", () => {
    const rows: Array<{ year: string; n: number }> = [];
    for (let year = 2000; year < 2010; year++) {
      for (const quarter of [1, 2, 3, 4]) {
        const n = year === 2005 && quarter === 2 ? 0 : quarter;
        rows.push({ year: `${year}-Q${quarter}`, n });
      }
    }
    expect(codesOf(lintSpec(singleSeries(rows)))).toContain(CODE);
  });

  it("fires when a group is missing x rows between its non-zeros", () => {
    const rows: Array<{ year: string; group: string; n: number }> = [];
    for (let year = 1960; year < 2000; year++) {
      rows.push({ year: `${year}-01-01`, group: "A", n: 10 });
      if (year === 1960 || year === 1999) rows.push({ year: `${year}-01-01`, group: "B", n: 5 });
    }
    const spec = {
      data: { values: rows },
      aes: {
        x: { field: "year" },
        y: { field: "n" },
        group: { field: "group" },
      },
      layers: [{ geom: "area", position: "stack" }],
    };
    expect(codesOf(lintSpec(spec))).toContain(CODE);
  });

  it("fires for string years '2001'..'2022'", () => {
    const years = Array.from({ length: 22 }, (_, index) => String(2001 + index));
    const y = (index: number) => (index % 3) + 1;
    expect(codesOf(lintSpec(singleSeries(seriesRows(years, y))))).toContain(CODE);
  });

  it("fires for year-month strings '2001-01'..'2022-01'", () => {
    const months = Array.from({ length: 22 }, (_, index) => `${2001 + index}-01`);
    const y = (index: number) => (index % 3) + 1;
    expect(codesOf(lintSpec(singleSeries(seriesRows(months, y))))).toContain(CODE);
  });

  it("fires for numeric integer years on the default linear scale", () => {
    const rows = Array.from({ length: 23 }, (_, index) => ({
      year: 2000 + index,
      n: (index % 3) + 1,
    }));
    expect(codesOf(lintSpec(singleSeries(rows)))).toContain(CODE);
  });

  it("stays silent for numeric integer years on a band scale", () => {
    const rows = Array.from({ length: 23 }, (_, index) => ({ year: 2000 + index, n: 5 }));
    const spec = {
      ...singleSeries(rows),
      scales: { x: { type: "band" } },
    };
    expect(codesOf(lintSpec(spec))).not.toContain(CODE);
  });

  it("stays silent with only 4 numeric year samples", () => {
    const rows = [2000, 2001, 2002, 2003].map((year) => ({ year, n: 5 }));
    expect(codesOf(lintSpec(singleSeries(rows)))).not.toContain(CODE);
  });

  it("stays silent for fractional quantitative x in the year range", () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      year: 1500.5 + index * 37.25,
      n: 5,
    }));
    expect(codesOf(lintSpec(singleSeries(rows)))).not.toContain(CODE);
  });

  it("stays silent for col and line over the same period totals", () => {
    for (const geom of ["col", "line"]) {
      const spec = {
        data: { values: reproRows() },
        layers: [areaLayer({ geom })],
      };
      expect(codesOf(lintSpec(spec))).not.toContain(CODE);
    }
  });

  it("stays silent without inline data or with only a profile", () => {
    expect(
      codesOf(
        lintSpec({
          aes: {
            x: { field: "year" },
            y: { field: "n" },
            group: { field: "group" },
          },
          layers: [{ geom: "area", position: "stack" }],
        }),
      ),
    ).not.toContain(CODE);
    expect(
      codesOf(
        lintSpec(
          {
            aes: { x: { field: "year" }, y: { field: "n" } },
            layers: [{ geom: "area", position: "stack" }],
          },
          {
            profile: {
              fields: [
                { name: "year", type: "temporal" },
                { name: "n", type: "quantitative" },
              ],
            },
          },
        ),
      ),
    ).not.toContain(CODE);
  });

  it("stays silent for 40 years with every group non-zero", () => {
    const rows: Array<{ year: string; group: string; n: number }> = [];
    for (let year = 1960; year < 2000; year++) {
      for (const group of ["A", "B"]) rows.push({ year: `${year}-01-01`, group, n: 5 });
    }
    const spec = {
      data: { values: rows },
      aes: { x: { field: "year" }, y: { field: "n" }, group: { field: "group" } },
      layers: [{ geom: "area", position: "stack" }],
    };
    expect(codesOf(lintSpec(spec))).not.toContain(CODE);
  });

  it("fires for a single group with interior zeros", () => {
    const rows: Array<{ year: string; n: number }> = [];
    for (let year = 2000; year < 2010; year++) {
      rows.push({ year: `${year}-01-01`, n: year === 2004 ? 0 : 3 });
    }
    expect(codesOf(lintSpec(singleSeries(rows)))).toContain(CODE);
  });

  it("fires for fill-only grouping with interior zeros", () => {
    const rows: Array<{ year: string; fill: string; n: number }> = [];
    for (let year = 2000; year < 2010; year++) {
      rows.push(
        { year: `${year}-01-01`, fill: "A", n: 3 },
        { year: `${year}-01-01`, fill: "B", n: year === 2005 ? 0 : 2 },
      );
    }
    const spec = {
      data: { values: rows },
      aes: { x: { field: "year" }, y: { field: "n" }, fill: { field: "fill" } },
      layers: [{ geom: "area", position: "stack" }],
    };
    const advisories = lintSpec(spec);
    expect(codesOf(advisories)).toContain(CODE);
    expect(advisories.find((a) => a.code === CODE)?.path).toBe("/layers/0/aes/x");
  });

  it("stays silent for Crimean-shaped monthly rates with fractional y and edge zeros", () => {
    const groups = ["Settlers", "Army", "Others"] as const;
    const rates = [1.4, 0.4, 328.5] as const;
    const rows: Array<{ month: string; group: string; n: number }> = [];
    for (let month = 0; month < 24; month++) {
      const date = new Date(Date.UTC(2001, month, 1)).toISOString().slice(0, 10);
      const edge = month < 2 || month > 21;
      for (let index = 0; index < groups.length; index++) {
        rows.push({
          month: date,
          group: groups[index]!,
          n: edge ? 0 : rates[index]! + month,
        });
      }
    }
    const spec = {
      data: { values: rows },
      aes: { x: { field: "month" }, y: { field: "n" }, group: { field: "group" } },
      layers: [{ geom: "area", position: "stack" }],
    };
    expect(codesOf(lintSpec(spec))).not.toContain(CODE);
  });

  it("stays silent for a cumulative year series (monotone non-decreasing integers)", () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      year: `${2000 + index}-01-01`,
      n: index * 10,
    }));
    expect(codesOf(lintSpec(singleSeries(rows)))).not.toContain(CODE);
  });

  it("stays silent for monotone integer monthly counts (cumulative shape)", () => {
    const months: string[] = [];
    for (let month = 0; month < 24; month++) {
      months.push(new Date(Date.UTC(2000, month, 1)).toISOString().slice(0, 10));
    }
    const rows = seriesRows(months, (index) => 10 + index);
    expect(codesOf(lintSpec(singleSeries(rows)))).not.toContain(CODE);
  });

  it("stays silent for 40 years spelled two ways without fake gaps", () => {
    const rows: Array<{ year: string; group: string; n: number }> = [];
    for (let year = 1960; year < 2000; year++) {
      rows.push(
        { year: `${year}-01-01`, group: "A", n: 3 + (year % 5) },
        { year: `${year}-01-01T00:00:00Z`, group: "B", n: 2 + (year % 4) },
      );
    }
    const spec = {
      data: { values: rows },
      aes: { x: { field: "year" }, y: { field: "n" }, group: { field: "group" } },
      layers: [{ geom: "area", position: "stack" }],
    };
    expect(codesOf(lintSpec(spec))).not.toContain(CODE);
  });

  it("fires for 15 distinct periods hidden behind two date spellings", () => {
    const rows: Array<{ year: string; group: string; n: number }> = [];
    for (let year = 2000; year < 2015; year++) {
      rows.push(
        { year: `${year}-01-01`, group: "A", n: 5 + (year % 3) },
        { year: `${year}-01-01T00:00:00Z`, group: "B", n: 4 + (year % 2) },
      );
    }
    const spec = {
      data: { values: rows },
      aes: { x: { field: "year" }, y: { field: "n" }, group: { field: "group" } },
      layers: [{ geom: "area", position: "stack" }],
    };
    expect(codesOf(lintSpec(spec))).toContain(CODE);
  });

  it("fires when a null y row marks a missing period between non-zeros", () => {
    const rows: Array<{ year: string; n: number | null }> = [
      { year: "2001-01-01", n: 5 },
      { year: "2002-01-01", n: null },
      { year: "2003-01-01", n: 7 },
    ];
    expect(codesOf(lintSpec(singleSeries(rows)))).toContain(CODE);
  });

  it("sums duplicate group+x rows before the shape test (A 7→3 fires)", () => {
    const rows: Array<{ year: string; group: string; n: number }> = [
      { year: "2001-01-01", group: "A", n: 5 },
      { year: "2001-01-01", group: "A", n: 2 },
      { year: "2002-01-01", group: "A", n: 3 },
      { year: "2001-01-01", group: "B", n: 3 },
      { year: "2002-01-01", group: "B", n: 6 },
    ];
    const spec = {
      data: { values: rows },
      aes: { x: { field: "year" }, y: { field: "n" }, group: { field: "group" } },
      layers: [{ geom: "area", position: "stack" }],
    };
    // A sums to 7 then 3 (decrease); B sums to 3 then 6.
    expect(codesOf(lintSpec(spec))).toContain(CODE);
  });

  it("stays silent for integer x 4000..4011 with fluctuating counts (window cap)", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      year: 4000 + index,
      n: [3, 8, 1, 6][index % 4]!,
    }));
    expect(codesOf(lintSpec(singleSeries(rows)))).not.toContain(CODE);
  });

  it("fires for integer x 2000..2011 with fluctuating counts (inside window)", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      year: 2000 + index,
      n: [3, 8, 1, 6][index % 4]!,
    }));
    expect(codesOf(lintSpec(singleSeries(rows)))).toContain(CODE);
  });

  it("fires for fractional y with an interior zero (gap gate is B2-only)", () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      year: `${2000 + index}-01-01`,
      n: index === 4 ? 0 : 2.5,
    }));
    expect(codesOf(lintSpec(singleSeries(rows)))).toContain(CODE);
  });

  it("fires for negative y with an interior zero via the gap signal", () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      year: `${2000 + index}-01-01`,
      n: index === 4 ? 0 : index - 5,
    }));
    expect(codesOf(lintSpec(singleSeries(rows)))).toContain(CODE);
  });
});
