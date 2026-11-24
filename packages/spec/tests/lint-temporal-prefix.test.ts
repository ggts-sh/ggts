/** sparse-temporal-prefix core detection, boundary, and layer-data tests (issue #1964). */
import { describe, expect, it } from "bun:test";

import { LINT_CATALOG } from "../src/lint-catalog.ts";
import { lintSpec, type SpecAdvisory } from "../src/lint.ts";
import { validate } from "../src/validate.ts";

const CODE = "sparse-temporal-prefix";

const codesOf = (advisories: SpecAdvisory[]) => advisories.map((a) => a.code);
const prefixOf = (advisories: SpecAdvisory[]) => advisories.filter((a) => a.code === CODE);

const REPRO_DATES = [
  "1985-01-01",
  "2015-01-01",
  "2016-01-01",
  "2017-01-01",
  "2018-01-01",
  "2019-01-01",
  "2020-01-01",
  "2021-01-01",
  "2022-01-01",
  "2023-01-01",
  "2024-01-01",
];

/** Exact repro from issue #1964. */
function issueReproSpec() {
  return {
    width: 960,
    height: 480,
    layers: [{ geom: "line", aes: { x: { field: "date" }, y: { field: "n" } } }],
    scales: { x: { type: "time" }, y: { type: "linear" } },
    labs: { title: "Citas por año", x: "Año", y: "Citas" },
    data: {
      columns: {
        date: REPRO_DATES,
        n: [1, 40, 55, 62, 71, 83, 96, 104, 118, 131, 149],
      },
    },
  };
}

function lineSpec(dates: unknown[], extra: Record<string, unknown> = {}) {
  return {
    labs: { title: "Series", x: "Date", y: "Value" },
    data: {
      columns: {
        date: dates,
        n: dates.map((_, index) => index + 1),
      },
    },
    layers: [{ geom: "line", aes: { x: { field: "date" }, y: { field: "n" } } }],
    ...extra,
  };
}

describe("sparse-temporal-prefix", () => {
  it("fires on the issue #1964 repro via lintSpec and validate({ lint: true })", () => {
    const spec = issueReproSpec();
    const linted = prefixOf(lintSpec(spec));
    expect(linted).toHaveLength(1);
    const advisory = linted[0]!;
    expect(advisory.path).toBe("/layers/0/aes/x");
    expect(advisory.message).toContain("1 of 11 rows (9.1%)");
    expect(advisory.message).toContain("30 years");
    expect(advisory.message).toContain("1 year");
    expect(advisory.message).toContain("2015-01-01");
    expect(advisory.suggestion?.example).toEqual({
      scales: { x: { domain: ["2015-01-01", "2024-01-01"] } },
    });

    const validated = validate(spec, { lint: true });
    expect(validated.ok).toBe(true);
    expect(codesOf(validated.advisories ?? [])).toContain(CODE);
  });

  it("stays silent for dense annual and dense monthly series", () => {
    const annual = Array.from({ length: 15 }, (_, i) => `${2010 + i}-01-01`);
    expect(codesOf(lintSpec(lineSpec(annual)))).not.toContain(CODE);

    const monthly = Array.from({ length: 24 }, (_, i) =>
      new Date(Date.UTC(2020, i, 1)).toISOString().slice(0, 10),
    );
    expect(codesOf(lintSpec(lineSpec(monthly)))).not.toContain(CODE);
  });

  it("stays silent for a genuinely sparse 5-decade series", () => {
    const sparse = ["1980-01-01", "1990-01-01", "2000-01-01", "2010-01-01", "2020-01-01"];
    expect(codesOf(lintSpec(lineSpec(sparse)))).not.toContain(CODE);
  });

  it("enforces the <= 10% prefix row share boundary", () => {
    const tail9 = Array.from({ length: 9 }, (_, i) => `${2015 + i}-01-01`);
    const tail8 = Array.from({ length: 8 }, (_, i) => `${2015 + i}-01-01`);

    // 1 / 10 = 10% -> fires
    expect(codesOf(lintSpec(lineSpec(["1985-01-01", ...tail9])))).toContain(CODE);
    // 1 / 9 = 11.1% -> silent
    expect(codesOf(lintSpec(lineSpec(["1985-01-01", ...tail8])))).not.toContain(CODE);

    // 2 / 20 = 10% -> fires
    const tail18 = Array.from({ length: 18 }, (_, i) => `${2005 + i}-01-01`);
    expect(codesOf(lintSpec(lineSpec(["1985-01-01", "1985-01-01", ...tail18])))).toContain(CODE);
    // 2 / 12 = 16.7% -> silent
    const tail10 = Array.from({ length: 10 }, (_, i) => `${2015 + i}-01-01`);
    expect(codesOf(lintSpec(lineSpec(["1985-01-01", "1985-01-01", ...tail10])))).not.toContain(
      CODE,
    );
  });

  it("requires >= 5 distinct parsed values and handles odd/even remaining-gap medians", () => {
    // 4 distinct values across 10 rows -> silent
    const fourDistinct = [
      "1985-01-01",
      "2015-01-01",
      "2015-01-01",
      "2015-01-01",
      "2016-01-01",
      "2016-01-01",
      "2016-01-01",
      "2017-01-01",
      "2017-01-01",
      "2017-01-01",
    ];
    expect(codesOf(lintSpec(lineSpec(fourDistinct)))).not.toContain(CODE);

    // n = 5 distinct values (3 remaining gaps: odd median) across 10 rows -> fires
    const fiveDistinct = [
      "1985-01-01",
      "2015-01-01",
      "2015-01-01",
      "2016-01-01",
      "2016-01-01",
      "2017-01-01",
      "2017-01-01",
      "2018-01-01",
      "2018-01-01",
      "2018-01-01",
    ];
    expect(codesOf(lintSpec(lineSpec(fiveDistinct)))).toContain(CODE);

    // n = 6 distinct values (4 remaining gaps: even median) across 10 rows -> fires
    const sixDistinct = [
      "1985-01-01",
      "2015-01-01",
      "2015-01-01",
      "2016-01-01",
      "2016-01-01",
      "2017-01-01",
      "2017-01-01",
      "2018-01-01",
      "2019-01-01",
      "2019-01-01",
    ];
    expect(codesOf(lintSpec(lineSpec(sixDistinct)))).toContain(CODE);
  });

  it("checks exact 5-year UTC calendar boundaries including leap years", () => {
    const denseTail = (startYear: number) =>
      Array.from({ length: 9 }, (_, i) => `${startYear + i}-01-01`);

    // 2010-01-01 -> 2015-01-01 (1826 days, 1 leap year) -> fires
    expect(codesOf(lintSpec(lineSpec(["2010-01-01", ...denseTail(2015)])))).toContain(CODE);

    // 1900-01-01 -> 1905-01-01 (1825 days, 0 leap years) -> fires
    expect(codesOf(lintSpec(lineSpec(["1900-01-01", ...denseTail(1905)])))).toContain(CODE);

    // 2012-01-02 -> 2017-01-01 (4y 365d = 1826 days, < 5 calendar years) -> silent
    expect(codesOf(lintSpec(lineSpec(["2012-01-02", ...denseTail(2017)])))).not.toContain(CODE);

    // 2016-02-29 -> 2021-02-28 (Feb 29 clamped to Feb 28 in non-leap 2021) -> fires
    const tailFromFeb28 = [
      "2021-02-28",
      "2021-06-01",
      "2021-09-01",
      "2021-12-01",
      "2022-03-01",
      "2022-06-01",
      "2022-09-01",
      "2022-12-01",
      "2023-03-01",
    ];
    expect(codesOf(lintSpec(lineSpec(["2016-02-29", ...tailFromFeb28])))).toContain(CODE);

    // 2016-02-29 -> 2021-02-27 (1 day short of 5 years) -> silent
    const tailFromFeb27 = ["2021-02-27", ...tailFromFeb28.slice(1)];
    expect(codesOf(lintSpec(lineSpec(["2016-02-29", ...tailFromFeb27])))).not.toContain(CODE);
  });

  it("supports layer-local data, bare-string aes, Date objects, and unsorted rows", () => {
    const dates = [
      new Date("2020-01-01T00:00:00Z"),
      new Date("1985-01-01T00:00:00Z"),
      new Date("2015-01-01T00:00:00Z"),
      new Date("2016-01-01T00:00:00Z"),
      new Date("2017-01-01T00:00:00Z"),
      new Date("2018-01-01T00:00:00Z"),
      new Date("2019-01-01T00:00:00Z"),
      new Date("2021-01-01T00:00:00Z"),
      new Date("2022-01-01T00:00:00Z"),
      new Date("2023-01-01T00:00:00Z"),
    ];
    const spec = {
      labs: { title: "Layer local", x: "Date", y: "Count" },
      layers: [
        {
          geom: "line",
          aes: { x: "date", y: "n" },
          data: { values: dates.map((date, i) => ({ date, n: i })) },
        },
      ],
    };
    const advisories = prefixOf(lintSpec(spec));
    expect(advisories).toHaveLength(1);
    expect(advisories[0]!.path).toBe("/layers/0/aes/x");
    expect(advisories[0]!.suggestion?.example).toEqual({
      scales: { x: { domain: ["2015-01-01", "2023-01-01"] } },
    });
  });

  it("deduplicates shared data across layers while firing per distinct layer dataset", () => {
    const shared = {
      labs: { title: "Shared", x: "Date", y: "Value" },
      data: { columns: { date: REPRO_DATES, n: REPRO_DATES.map((_, i) => i) } },
      aes: { x: { field: "date" }, y: { field: "n" } },
      layers: [{ geom: "line" }, { geom: "point" }],
    };
    const sharedHits = prefixOf(lintSpec(shared));
    expect(sharedHits).toHaveLength(1);
    expect(sharedHits[0]!.path).toBe("/layers/0/aes/x");

    const distinct = {
      labs: { title: "Distinct", x: "Date", y: "Value" },
      layers: [
        {
          geom: "line",
          aes: { x: { field: "date" }, y: { field: "n" } },
          data: { columns: { date: [...REPRO_DATES], n: REPRO_DATES.map((_, i) => i) } },
        },
        {
          geom: "point",
          aes: { x: { field: "date" }, y: { field: "n" } },
          data: { columns: { date: [...REPRO_DATES], n: REPRO_DATES.map((_, i) => i * 2) } },
        },
      ],
    };
    const distinctHits = prefixOf(lintSpec(distinct));
    expect(distinctHits.map((a) => a.path)).toEqual(["/layers/0/aes/x", "/layers/1/aes/x"]);
  });

  it("registers sparse-temporal-prefix metadata in LINT_CATALOG", () => {
    const entry = LINT_CATALOG[CODE];
    expect(entry.needs).toBe("data");
    expect(entry.rationale).toBe(
      "A temporal axis that starts at one early row implies the decades after it were measured and empty. Start at the first period with meaningful coverage, or state the sparse prefix explicitly.",
    );
  });
});
