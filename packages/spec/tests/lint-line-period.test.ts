/** line-over-period-totals lint behavior (issue #1963). */
import { describe, expect, it } from "bun:test";

import { lintSpec, type SpecAdvisory } from "../src/lint.ts";
import { normalize, type SpecInput } from "../src/normalize.ts";
import { validate } from "../src/validate.ts";

const CODE = "line-over-period-totals";

const codesOf = (advisories: readonly SpecAdvisory[]) => advisories.map((a) => a.code);

const defaultLabs = { title: "Period count", x: "Period", y: "Count" };

const issueReproSpec = () => ({
  width: 960,
  height: 480,
  layers: [
    {
      geom: "line",
      aes: { x: { field: "year" }, y: { field: "count" } },
    },
  ],
  scales: { x: { type: "linear" }, y: { type: "linear" } },
  labs: { title: "Normas restrictivas por año", x: "Año", y: "Normas" },
  data: {
    columns: {
      year: [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
      count: [3, 8, 4, 11, 6, 15, 9, 18, 12, 21, 16, 24],
    },
  },
});

const lineSpec = (
  rows: Array<Record<string, unknown>>,
  opts: {
    geom?: string;
    stat?: string;
    params?: Record<string, unknown>;
    scales?: Record<string, unknown>;
    xField?: string;
    groupChannel?: "group" | "fill" | "color";
    layerLocal?: boolean;
  } = {},
) => {
  const xField = opts.xField ?? "year";
  const aes: Record<string, unknown> = {
    x: { field: xField },
    y: { field: "n" },
    ...(opts.groupChannel !== undefined && { [opts.groupChannel]: { field: opts.groupChannel } }),
  };
  const layer: Record<string, unknown> = {
    geom: opts.geom ?? "line",
    aes,
    ...(opts.stat !== undefined && { stat: opts.stat }),
    ...(opts.params !== undefined && { params: opts.params }),
    ...(opts.layerLocal === true && { data: { values: rows } }),
  };
  return {
    labs: defaultLabs,
    ...(opts.scales !== undefined && { scales: opts.scales }),
    ...(opts.layerLocal !== true && { data: { values: rows } }),
    layers: [layer],
  };
};

const jaggedYears = (start: number, count: number, y = (i: number) => [3, 8, 4, 11][i % 4]!) =>
  Array.from({ length: count }, (_, i) => ({ year: start + i, n: y(i) }));

describe("line-over-period-totals", () => {
  it("fires on the issue #1963 repro via lintSpec and validate({ lint: true })", () => {
    const spec = issueReproSpec();
    const lintAdvisories = lintSpec(spec);
    expect(codesOf(lintAdvisories)).toContain(CODE);
    const advisory = lintAdvisories.find((a) => a.code === CODE)!;
    expect(advisory.path).toBe("/layers/0/aes/x");
    expect(advisory.message).toContain("line");
    expect(advisory.message).toContain('"year"');
    expect(advisory.message).toContain("integer-year grid");
    expect(advisory.message).toContain("12 periods");
    expect(advisory.message).toContain("jagged");
    expect(advisory.suggestion?.description).toContain("cumulative stock");
    expect(advisory.suggestion?.description).toContain("how many were published this period");

    const validated = validate(spec, { lint: true });
    expect(validated.ok).toBe(true);
    expect(codesOf(validated.advisories ?? [])).toContain(CODE);
  });

  it("fires for geom: step and stays silent for path, point, and col", () => {
    const stepAdvisories = lintSpec(lineSpec(jaggedYears(2013, 12), { geom: "step" }));
    expect(codesOf(stepAdvisories)).toContain(CODE);
    expect(stepAdvisories.find((a) => a.code === CODE)?.message).toContain("step");

    for (const geom of ["path", "point", "col"]) {
      expect(codesOf(lintSpec(lineSpec(jaggedYears(2013, 12), { geom })))).not.toContain(CODE);
    }
  });

  it("emits area-over-period-totals (not line-over-period-totals) for geom: area", () => {
    const advisories = lintSpec(lineSpec(jaggedYears(2013, 12), { geom: "area" }));
    expect(codesOf(advisories)).toContain("area-over-period-totals");
    expect(codesOf(advisories)).not.toContain(CODE);
  });

  it("fires for a 48-year zero-filled jagged series (no upper period cap)", () => {
    const rows = Array.from({ length: 48 }, (_, i) => ({
      year: `${1979 + i}-01-01`,
      n: i % 5 === 2 ? 0 : (i % 4) + 1,
    }));
    const advisories = lintSpec(lineSpec(rows));
    expect(codesOf(advisories)).toContain(CODE);
    expect(advisories.find((a) => a.code === CODE)?.message).toContain("48 periods");
  });

  it("fires on line layer while staying silent on 40-year nonzero area layer", () => {
    const rows = jaggedYears(1985, 40, (i) => 2 + (i % 5));
    const spec = {
      labs: defaultLabs,
      data: { values: rows },
      aes: { x: { field: "year" }, y: { field: "n" } },
      layers: [{ geom: "area" }, { geom: "line" }],
    };
    const advisories = lintSpec(spec);
    expect(codesOf(advisories)).not.toContain("area-over-period-totals");
    const lineHits = advisories.filter((a) => a.code === CODE);
    expect(lineHits).toHaveLength(1);
    expect(lineHits[0]!.path).toBe("/layers/1/aes/x");
  });

  it("enforces the 8-distinct-period boundary (4 and 7 silent, 8 fires, 8 rows x 4 periods silent)", () => {
    expect(codesOf(lintSpec(lineSpec(jaggedYears(2020, 4))))).not.toContain(CODE);
    expect(codesOf(lintSpec(lineSpec(jaggedYears(2018, 7))))).not.toContain(CODE);
    expect(codesOf(lintSpec(lineSpec(jaggedYears(2017, 8))))).toContain(CODE);

    const twoGroupsFourPeriods = [2020, 2021, 2022, 2023].flatMap((year, i) => [
      { year, group: "A", n: [5, 2, 7, 1][i]! },
      { year, group: "B", n: [1, 4, 2, 6][i]! },
    ]);
    expect(twoGroupsFourPeriods).toHaveLength(8);
    expect(
      codesOf(lintSpec(lineSpec(twoGroupsFourPeriods, { groupChannel: "group" }))),
    ).not.toContain(CODE);
  });

  it("detects UTC year, quarter, and month grids and ignores daily dates", () => {
    const years = Array.from({ length: 10 }, (_, i) => ({
      year: `${2010 + i}-01-01`,
      n: [2, 6, 3, 8][i % 4]!,
    }));
    expect(lintSpec(lineSpec(years)).find((a) => a.code === CODE)?.message).toContain("year grid");

    const quarters = Array.from({ length: 10 }, (_, i) => ({
      year: `${2020 + Math.floor(i / 4)}-Q${(i % 4) + 1}`,
      n: [4, 1, 7, 3][i % 4]!,
    }));
    expect(lintSpec(lineSpec(quarters)).find((a) => a.code === CODE)?.message).toContain(
      "quarter grid",
    );

    const months = Array.from({ length: 10 }, (_, i) => ({
      year: `2022-${String(i + 1).padStart(2, "0")}`,
      n: [5, 2, 9, 4][i % 4]!,
    }));
    expect(lintSpec(lineSpec(months)).find((a) => a.code === CODE)?.message).toContain(
      "month grid",
    );

    const daily = Array.from({ length: 12 }, (_, i) => ({
      year: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
      n: [3, 8, 4, 11][i % 4]!,
    }));
    expect(codesOf(lintSpec(lineSpec(daily)))).not.toContain(CODE);
  });

  it("respects numeric integer-year scale types (undefined/linear fire, band/time silent)", () => {
    const rows = jaggedYears(2013, 10);
    expect(codesOf(lintSpec(lineSpec(rows)))).toContain(CODE);
    expect(codesOf(lintSpec(lineSpec(rows, { scales: { x: { type: "linear" } } })))).toContain(
      CODE,
    );
    expect(codesOf(lintSpec(lineSpec(rows, { scales: { x: { type: "band" } } })))).not.toContain(
      CODE,
    );
    expect(codesOf(lintSpec(lineSpec(rows, { scales: { x: { type: "time" } } })))).not.toContain(
      CODE,
    );
  });

  it("stays silent for monotone, constant, fractional, and negative series (even with interior 0)", () => {
    const monotone = jaggedYears(2013, 12, (i) => i * 5 + 1);
    expect(codesOf(lintSpec(lineSpec(monotone)))).not.toContain(CODE);

    const constant = jaggedYears(2013, 12, () => 4);
    expect(codesOf(lintSpec(lineSpec(constant)))).not.toContain(CODE);

    const fractionalWithZero = Array.from({ length: 12 }, (_, i) => ({
      year: new Date(Date.UTC(2020, i, 1)).toISOString().slice(0, 10),
      n: i === 5 ? 0 : 2.5 + (i % 3) * 0.25,
    }));
    expect(codesOf(lintSpec(lineSpec(fractionalWithZero)))).not.toContain(CODE);

    const negativeWithZero = Array.from({ length: 12 }, (_, i) => ({
      year: new Date(Date.UTC(2020, i, 1)).toISOString().slice(0, 10),
      n: i === 5 ? 0 : i - 6,
    }));
    expect(codesOf(lintSpec(lineSpec(negativeWithZero)))).not.toContain(CODE);
  });

  it("handles multi-group series (group/fill/color) and sums duplicate group+x rows", () => {
    for (const channel of ["group", "fill", "color"] as const) {
      const rows = Array.from({ length: 10 }, (_, i) => [
        { year: 2010 + i, [channel]: "A", n: i + 1 },
        { year: 2010 + i, [channel]: "B", n: [6, 2, 8, 1][i % 4]! },
      ]).flat();
      expect(codesOf(lintSpec(lineSpec(rows, { groupChannel: channel })))).toContain(CODE);
    }

    const dupRows = Array.from({ length: 9 }, (_, i) =>
      i === 2
        ? [
            { year: 2010 + i, group: "A", n: 8 },
            { year: 2010 + i, group: "A", n: 4 },
          ]
        : [{ year: 2010 + i, group: "A", n: i + 1 }],
    ).flat();
    // Period 2012 sums to 12, followed by 2013 = 4 (decrease).
    expect(codesOf(lintSpec(lineSpec(dupRows, { groupChannel: "group" })))).toContain(CODE);
  });

  it("fires for stat: identity and normalize(), and stays silent for summary_rolling and summary_bin", () => {
    const rows = jaggedYears(2013, 12);
    expect(codesOf(lintSpec(lineSpec(rows, { stat: "identity" })))).toContain(CODE);
    expect(codesOf(lintSpec(normalize(issueReproSpec() as SpecInput)))).toContain(CODE);

    expect(
      codesOf(lintSpec(lineSpec(rows, { stat: "summary_rolling", params: { window: 3 } }))),
    ).not.toContain(CODE);
    expect(codesOf(lintSpec(lineSpec(rows, { stat: "summary_bin" })))).not.toContain(CODE);
  });

  it("supports layer-local data and bare-string aes", () => {
    expect(codesOf(lintSpec(lineSpec(jaggedYears(2013, 10), { layerLocal: true })))).toContain(
      CODE,
    );

    const bareAes = {
      labs: defaultLabs,
      data: { values: jaggedYears(2013, 10) },
      aes: { x: "year", y: "n" },
      layers: [{ geom: "line" }],
    };
    expect(codesOf(lintSpec(bareAes))).toContain(CODE);
  });

  it("skips silently without data, with profile-only evidence, or over limits", () => {
    const bare = {
      labs: defaultLabs,
      aes: { x: { field: "year" }, y: { field: "n" } },
      layers: [{ geom: "line" }],
    };
    expect(codesOf(lintSpec(bare))).not.toContain(CODE);
    expect(
      codesOf(
        lintSpec(bare, {
          profile: {
            fields: [
              { name: "year", type: "quantitative" },
              { name: "n", type: "quantitative" },
            ],
          },
        }),
      ),
    ).not.toContain(CODE);

    expect(codesOf(lintSpec(issueReproSpec(), { limits: { maxRows: 5 } }))).not.toContain(CODE);
  });
});
