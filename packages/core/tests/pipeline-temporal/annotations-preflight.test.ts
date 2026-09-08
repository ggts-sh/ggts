/**
 * Temporal annotation intercepts, preflight, and source-column validation.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import { size, yearRows } from "./fixtures.ts";

describe("temporal pipeline: annotations and preflight", () => {
  it("rejects invalid annotations after mapped data infers a temporal parser", () => {
    expect(() =>
      runPipeline(
        gg(yearRows, aes({ x: "year", y: "value" }))
          .geomPoint()
          .geomRule({ xintercept: "bad" })
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
  });

  it("rejects date/datetime kind mismatches", () => {
    const rows = [
      { when: "2025-01-01T10:30:00", value: 1 },
      { when: "2025-01-02T10:30:00", value: 2 },
    ];
    expect(() =>
      runPipeline(
        gg(rows, aes({ x: "when", y: "value" }))
          .geomLine()
          .scaleXDate({ parse: "ymd_hms" })
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
    expect(() =>
      runPipeline(
        gg([rows[0]!, { when: "not-a-date", value: 2 }], aes({ x: "when", y: "value" }))
          .geomLine()
          .scaleXDate({ parse: "ymd_hms", parseFailure: "censor" })
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
  });

  it("preflights requested temporal annotation intercepts", () => {
    const semantic = runPipeline(
      {
        data: { values: [{}] },
        layers: [{ geom: "rule", params: { yintercept: Date.UTC(2025, 0, 1) } }],
        scales: { y: { type: "time" } },
      },
      size,
    );
    expect(semantic.scene.batches.some(({ kind }) => kind === "segments")).toBe(true);

    const spec = {
      data: { values: [{}] },
      layers: [{ geom: "rule" as const, params: { yintercept: "not-a-date" } }],
      scales: { y: { type: "time" as const, parse: "dmy" as const } },
    };
    expect(() => runPipeline(spec, size)).toThrow(PipelineError);
    const censored = runPipeline(
      { ...spec, scales: { y: { ...spec.scales.y, parseFailure: "censor" } } },
      size,
    );
    expect(censored.scene.batches).toHaveLength(0);
    expect(censored.warnings.some(({ code }) => code === "temporal-values-censored")).toBe(true);

    expect(() =>
      runPipeline(
        {
          data: { values: [{}] },
          layers: [
            {
              geom: "rule",
              params: { yintercept: ["2025-01-01 10:30:00", "bad"] },
            },
          ],
          scales: {
            y: {
              type: "time",
              parse: "ymd_hms",
              temporalKind: "date",
              parseFailure: "censor",
            },
          },
        },
        size,
      ),
    ).toThrow(PipelineError);

    const mixed = runPipeline(
      {
        data: { values: [{}] },
        layers: [{ geom: "rule", params: { yintercept: [Date.UTC(2025, 0, 1), "bad"] } }],
        scales: { y: { type: "time", parse: "dmy", parseFailure: "censor" } },
      },
      size,
    );
    expect(
      mixed.warnings.find(({ code }) => code === "temporal-values-censored")?.message,
    ).toContain("censored 1 annotation");
  });

  it("rejects invalid temporal configuration without source rows", () => {
    expect(() =>
      runPipeline(
        {
          data: { values: [] },
          layers: [{ geom: "point" }],
          scales: {
            x: {
              type: "time",
              parse: { format: "%Y-%m-Q%q" },
              parseFailure: "censor",
            },
          },
        },
        size,
      ),
    ).toThrow(PipelineError);
  });

  it("preflights locale and dateLabels into stable structured pipeline errors", () => {
    for (const [config, code, path] of [
      [{ locale: "not_a_locale" }, "invalid-temporal-locale", "/scales/x/locale"],
      [{ dateLabels: "%Q" }, "invalid-temporal-labels", "/scales/x/dateLabels"],
    ] as const) {
      try {
        runPipeline(
          {
            data: { values: [] },
            layers: [{ geom: "point" }],
            scales: { x: { type: "time", ...config } },
          },
          size,
        );
        throw new Error("expected temporal configuration to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(PipelineError);
        if (!(error instanceof PipelineError)) throw error;
        expect(error.code).toBe(code);
        expect(error.path).toBe(path);
        expect(error.diagnostic).toMatchObject({ code, path, severity: "error" });
        expect(error.diagnostic?.problem.length).toBeGreaterThan(0);
        expect(error.diagnostic?.cause.length).toBeGreaterThan(0);
        expect(error.diagnostic?.fixes.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps ambiguous y-intercept annotations discrete", () => {
    const model = runPipeline(
      {
        data: { values: [{}] },
        layers: [{ geom: "rule", params: { yintercept: "03/04/2024" } }],
      },
      size,
    );
    expect(model.scales.y.type).toBe("band");
  });

  it("preflights explicit parsers against temporal bound fields", () => {
    const spec = {
      data: {
        values: [
          { x: 1, ymin: "31/12/2024", ymax: "bad" },
          { x: 2, ymin: "01/01/2025", ymax: "02/01/2025" },
        ],
      },
      layers: [
        {
          geom: "errorbar" as const,
          aes: {
            x: { field: "x" },
            ymin: { field: "ymin" },
            ymax: { field: "ymax" },
          },
        },
      ],
      scales: { y: { type: "time" as const, parse: "dmy" as const } },
    };
    expect(() => runPipeline(spec, size)).toThrow(PipelineError);
    try {
      runPipeline(spec, size);
    } catch (error) {
      expect((error as PipelineError).code).toBe("temporal-parse-failed");
      expect((error as Error).message).toContain('field "ymax"');
    }
  });

  it("fails explicit parsing by default and censors only when requested", () => {
    const rows = [
      { when: "31/12/2024", value: 1 },
      { when: "bad", value: 2 },
    ];
    const bad = gg(rows, aes({ x: "when", y: "value" }))
      .geomPoint()
      .scaleXDate({ parse: "dmy" })
      .spec();
    expect(() => runPipeline(bad, size)).toThrow(PipelineError);
    try {
      runPipeline(bad, size);
    } catch (error) {
      expect((error as PipelineError).code).toBe("temporal-parse-failed");
      expect((error as PipelineError).path).toBe("/scales/x/parse");
      expect((error as Error).message).toContain("1 value");
      const diagnostic = (error as PipelineError).diagnostic;
      expect(diagnostic?.code).toBe("temporal-parse-failed");
      expect(diagnostic?.severity).toBe("error");
      expect(diagnostic?.problem).toContain("1 value");
    }

    const censored = runPipeline(
      gg(rows, aes({ x: "when", y: "value" }))
        .geomPoint()
        .scaleXDate({ parse: "dmy", parseFailure: "censor" })
        .spec(),
      size,
    );
    expect(censored.warnings.some((warning) => warning.code === "temporal-values-censored")).toBe(
      true,
    );
  });

  it("preflights the source column even when runtime filters remove every row", () => {
    expect(() =>
      runPipeline(
        {
          data: { values: [{ when: "not-a-date", value: 1, group: "drop" }] },
          layers: [
            {
              geom: "point",
              aes: { x: { field: "when" }, y: { field: "value" } },
            },
          ],
          scales: { x: { type: "time", parse: "dmy" } },
        },
        {
          ...size,
          rowFilters: [{ scale: "color", field: "group", mode: "exclude", values: ["drop"] }],
        },
      ),
    ).toThrow(PipelineError);
  });

  it("validates the whole source column before runtime filters and facets", () => {
    const rows = [
      { when: "31/12/2024", value: 1, group: "keep" },
      { when: "bad", value: 2, group: "hide" },
    ];
    const spec = gg(rows, aes({ x: "when", y: "value" }))
      .geomPoint()
      .scaleXDate({ parse: "dmy" })
      .spec();
    expect(() =>
      runPipeline(spec, {
        ...size,
        rowFilters: [{ scale: "color", field: "group", mode: "exclude", values: ["hide"] }],
      }),
    ).toThrow(PipelineError);
  });

  it("exposes bounded decisions while preserving original source rows", () => {
    const model = runPipeline(
      gg(yearRows, aes({ x: "year", y: "value" }))
        .geomPoint()
        .spec(),
      size,
    );
    const decision = model.scaleDecisions.find(
      (candidate) => candidate.aesthetic === "x" && candidate.field === "year",
    );
    expect(decision).toMatchObject({
      aesthetic: "x",
      field: "year",
      status: "temporal",
      parser: "year",
      precision: "year",
      validatedCount: 3,
      portableOverride: { type: "time", temporalKind: "date", parse: "year" },
    });
    expect(model.row(0)).toEqual(yearRows[0]);
    // Year-unit data: empty-space pin / crosshair share axisFormatters with the
    // tooltip header. Labels must use the channel unit, not a fixed day stamp.
    expect(model.axisFormatters.x("1835")).toBe("1835");
    expect(model.axisFormatters.x(Date.UTC(1900, 0, 1))).toBe("1900");
    expect(Object.isFrozen(model.guidePlans)).toBe(true);
  });
});
