/** sparse-temporal-prefix scale domain, oob squish, parser, DST, runtime, and exclusion tests (issue #1964). */
import { describe, expect, it } from "bun:test";

import { lintSpec, type SpecAdvisory } from "../src/lint.ts";
import { parseTemporal } from "../src/temporal-parse.ts";
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

describe("sparse-temporal-prefix scales and edge cases", () => {
  it("respects pinned scales.x.domain and oob policy", () => {
    const base = issueReproSpec();
    const withDomain = (domain: unknown[], oob?: "censor" | "squish") => ({
      ...base,
      scales: {
        ...base.scales,
        x: { ...base.scales.x, domain, ...(oob !== undefined && { oob }) },
      },
    });

    // Starts at x[1] -> silent
    expect(codesOf(lintSpec(withDomain(["2015-01-01", "2024-01-01"])))).not.toContain(CODE);
    // Padded start excluding x[0] -> silent
    expect(codesOf(lintSpec(withDomain(["2014-01-01", "2024-01-01"])))).not.toContain(CODE);
    // Reversed domain excluding x[0] -> silent
    expect(codesOf(lintSpec(withDomain(["2024-01-01", "2015-01-01"])))).not.toContain(CODE);
    // Numeric epoch ms domain excluding x[0] -> silent
    expect(
      codesOf(lintSpec(withDomain([Date.UTC(2015, 0, 1), Date.UTC(2024, 0, 1)]))),
    ).not.toContain(CODE);
    // x[0] still exposed -> fires
    expect(codesOf(lintSpec(withDomain(["1985-01-01", "2024-01-01"])))).toContain(CODE);
    // oob: "squish" to x[1] merges 1985 into 2015 -> silent
    expect(codesOf(lintSpec(withDomain(["2015-01-01", "2024-01-01"], "squish")))).not.toContain(
      CODE,
    );
    // oob: "squish" to 2000-01-01 leaves a 15-year leading gap from 2000 -> fires
    const squished = prefixOf(lintSpec(withDomain(["2000-01-01", "2024-01-01"], "squish")));
    expect(squished).toHaveLength(1);
    expect(squished[0]!.message).toContain("2000-01-01");
    expect(squished[0]!.message).toContain("15 years");
  });

  it("supports explicit temporal parsers and censor mode, and skips band/linear/monthDay/time", () => {
    const dmyDates = [
      "01/02/1985",
      "01/02/2015",
      "01/02/2016",
      "01/02/2017",
      "01/02/2018",
      "01/02/2019",
      "01/02/2020",
      "01/02/2021",
      "01/02/2022",
      "01/02/2023",
    ];
    expect(
      codesOf(lintSpec(lineSpec(dmyDates, { scales: { x: { type: "time", parse: "dmy" } } }))),
    ).toContain(CODE);
    expect(
      codesOf(
        lintSpec(
          lineSpec(dmyDates, { scales: { x: { type: "time", parse: { format: "%d/%m/%Y" } } } }),
        ),
      ),
    ).toContain(CODE);

    const epochSeconds = REPRO_DATES.map((d) => new Date(`${d}T00:00:00Z`).getTime() / 1000);
    expect(
      codesOf(
        lintSpec(
          lineSpec(epochSeconds, {
            scales: { x: { type: "time", parse: { epoch: "seconds" } } },
          }),
        ),
      ),
    ).toContain(CODE);

    const censored = ["bad-date", ...REPRO_DATES];
    expect(
      codesOf(
        lintSpec(
          lineSpec(censored, {
            scales: { x: { type: "time", parse: "iso", parseFailure: "censor" } },
          }),
        ),
      ),
    ).toContain(CODE);

    // Non-time and projected scales stay silent
    expect(
      codesOf(lintSpec(lineSpec(REPRO_DATES, { scales: { x: { type: "band" } } }))),
    ).not.toContain(CODE);
    expect(
      codesOf(lintSpec(lineSpec(REPRO_DATES, { scales: { x: { type: "linear" } } }))),
    ).not.toContain(CODE);
    expect(
      codesOf(
        lintSpec(
          lineSpec(REPRO_DATES, { scales: { x: { type: "time", temporalKind: "monthDay" } } }),
        ),
      ),
    ).not.toContain(CODE);
    expect(
      codesOf(
        lintSpec(lineSpec(REPRO_DATES, { scales: { x: { type: "time", temporalKind: "time" } } })),
      ),
    ).not.toContain(CODE);
  });

  it("handles defensive cases, DataProfile, over-limit data, and 1-day duration formatting", () => {
    // Schema-invalid scales.x never throws
    for (const badX of [null, "time", { parse: 123 }, { parse: {} }]) {
      expect(() => lintSpec(lineSpec(REPRO_DATES, { scales: { x: badX } }))).not.toThrow();
    }
    expect(
      codesOf(lintSpec(lineSpec(REPRO_DATES, { scales: { x: { domain: ["not-a-date"] } } }))),
    ).toContain(CODE);

    // DataProfile only & missing data stay silent
    expect(
      codesOf(
        lintSpec(
          {
            labs: { title: "Profile", x: "Date", y: "N" },
            layers: [{ geom: "line", aes: { x: { field: "date" }, y: { field: "n" } } }],
          },
          {
            profile: {
              fields: [
                { name: "date", type: "temporal" },
                { name: "n", type: "quantitative" },
              ],
            },
          },
        ),
      ),
    ).not.toContain(CODE);
    expect(
      codesOf(
        lintSpec({
          labs: { title: "No data", x: "Date", y: "N" },
          layers: [{ geom: "line", aes: { x: { field: "date" }, y: { field: "n" } } }],
        }),
      ),
    ).not.toContain(CODE);

    // Over-limit maxRows skips silently
    expect(codesOf(lintSpec(issueReproSpec(), { limits: { maxRows: 5 } }))).not.toContain(CODE);

    // 1-day median spacing formats as "1 day" rather than "24 hours"
    const dailyTail = Array.from(
      { length: 10 },
      (_, i) => `2024-01-${String(i + 1).padStart(2, "0")}`,
    );
    const dailyHit = prefixOf(lintSpec(lineSpec(["2010-01-01", ...dailyTail])));
    expect(dailyHit).toHaveLength(1);
    expect(dailyHit[0]!.message).toContain("1 day");
    expect(dailyHit[0]!.message).not.toContain("24 hours");
  });

  it("skips unresolved runtime-named layers without suppressing subsequent plot-data layers", () => {
    const spec = {
      labs: { title: "Runtime layer", x: "Date", y: "Value" },
      data: { columns: { date: REPRO_DATES, n: REPRO_DATES.map((_, i) => i + 1) } },
      aes: { x: { field: "date" }, y: { field: "n" } },
      layers: [{ geom: "line", data: { name: "external_runtime" } }, { geom: "point" }],
    };

    const hits = prefixOf(lintSpec(spec));
    expect(hits).toHaveLength(1);
    expect(hits[0]!.path).toBe("/layers/1/aes/x");

    const validated = validate(spec, { lint: true });
    expect(validated.ok).toBe(true);
    expect(prefixOf(validated.advisories ?? []).map((a) => a.path)).toEqual(["/layers/1/aes/x"]);

    const runtimeOnly = {
      ...spec,
      layers: [{ geom: "line", data: { name: "external_runtime" } }],
    };
    expect(prefixOf(lintSpec(runtimeOnly))).toEqual([]);
    expect(prefixOf(validate(runtimeOnly, { lint: true }).advisories ?? [])).toEqual([]);
  });

  it("preserves non-ISO scale domains in suggestion.example under oob squish", () => {
    const epochSeconds = REPRO_DATES.map((d) => new Date(`${d}T00:00:00Z`).getTime() / 1000);
    const epochXScale = {
      type: "time",
      parse: { epoch: "seconds" as const },
      domain: [315532800, 1593561600],
      oob: "squish" as const,
    };
    const epochSpec = lineSpec(epochSeconds, {
      scales: {
        x: epochXScale,
        y: { type: "linear" },
      },
    });
    const epochHits = prefixOf(lintSpec(epochSpec));
    expect(epochHits).toHaveLength(1);
    const epochDomain = (
      epochHits[0]!.suggestion!.example as { scales: { x: { domain: unknown[] } } }
    ).scales.x.domain;
    expect(epochDomain).toEqual([1420070400, 1593561600]);
    for (const bound of epochDomain) {
      expect(parseTemporal(bound, { epoch: "seconds" }).ok).toBe(true);
    }
    const epochUpdated = lineSpec(epochSeconds, {
      scales: {
        x: { ...epochXScale, domain: epochDomain },
        y: { type: "linear" },
      },
    });
    const epochValidated = validate(epochUpdated, { lint: true });
    expect(epochValidated.ok).toBe(true);
    expect(codesOf(epochValidated.advisories ?? [])).not.toContain(CODE);

    const epochMillisSpec = lineSpec(
      epochSeconds.map((seconds) => seconds * 1000),
      {
        scales: {
          x: {
            type: "time",
            parse: { epoch: "milliseconds" },
            domain: [315532800000, 1593561600000],
            oob: "squish",
          },
          y: { type: "linear" },
        },
      },
    );
    const millisHits = prefixOf(lintSpec(epochMillisSpec));
    expect(millisHits).toHaveLength(1);
    const millisDomain = (
      millisHits[0]!.suggestion!.example as { scales: { x: { domain: unknown[] } } }
    ).scales.x.domain;
    expect(millisDomain).toEqual([1420070400000, 1593561600000]);

    const dmyDates = [
      "01/02/1985",
      "01/02/2015",
      "01/02/2016",
      "01/02/2017",
      "01/02/2018",
      "01/02/2019",
      "01/02/2020",
      "01/02/2021",
      "01/02/2022",
      "01/02/2023",
    ];
    for (const parser of ["dmy", { format: "%d/%m/%Y" }] as const) {
      const dmyXScale = {
        type: "time",
        parse: parser,
        domain: ["01/01/1980", "01/07/2020"],
        oob: "squish" as const,
      };
      const dmySpec = lineSpec(dmyDates, {
        scales: {
          x: dmyXScale,
          y: { type: "linear" },
        },
      });
      const dmyHits = prefixOf(lintSpec(dmySpec));
      expect(dmyHits).toHaveLength(1);
      const dmyDomain = (
        dmyHits[0]!.suggestion!.example as { scales: { x: { domain: unknown[] } } }
      ).scales.x.domain;
      expect(dmyDomain).toEqual(["01/02/2015", "01/07/2020"]);
      for (const bound of dmyDomain) {
        expect(parseTemporal(bound, parser).ok).toBe(true);
      }
      const dmyUpdated = lineSpec(dmyDates, {
        scales: {
          x: { ...dmyXScale, domain: dmyDomain },
          y: { type: "linear" },
        },
      });
      const dmyValidated = validate(dmyUpdated, { lint: true });
      expect(dmyValidated.ok).toBe(true);
      expect(codesOf(dmyValidated.advisories ?? [])).not.toContain(CODE);
    }
  });

  it("checks 5-year local calendar boundary across DST in non-UTC timezones", () => {
    const dstTail = Array.from(
      { length: 9 },
      (_, i) => `2015-03-${String(13 + i).padStart(2, "0")}T12:00:00`,
    );
    const exactFiveLocalYears = lineSpec(["2010-03-13T12:00:00", ...dstTail], {
      scales: { x: { type: "time", timezone: "America/New_York" }, y: { type: "linear" } },
    });
    const validated = validate(exactFiveLocalYears, { lint: true });
    expect(validated.ok).toBe(true);
    expect(codesOf(validated.advisories ?? [])).toContain(CODE);

    const oneSecondShort = lineSpec(
      ["2010-03-13T12:00:00", "2015-03-13T11:59:59", ...dstTail.slice(1)],
      {
        scales: { x: { type: "time", timezone: "America/New_York" }, y: { type: "linear" } },
      },
    );
    const shortValidated = validate(oneSecondShort, { lint: true });
    expect(shortValidated.ok).toBe(true);
    expect(codesOf(shortValidated.advisories ?? [])).not.toContain(CODE);
  });
});
