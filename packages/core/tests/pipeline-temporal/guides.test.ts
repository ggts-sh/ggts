/**
 * Temporal guide planning through the pipeline (intervals, overlap, precedence).
 */
import { describe, expect, it } from "bun:test";

import { aes, gg, SpecValidationError } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import { axisGuideFor, size, yearRows } from "./fixtures.ts";

describe("temporal pipeline: guides", () => {
  it("exposes measured temporal GuidePlans at responsive extents", () => {
    for (const width of [320, 640, 1200]) {
      const model = runPipeline(
        gg(yearRows, aes({ x: "year", y: "value" }))
          .geomLine()
          .spec(),
        { width, height: 400 },
      );
      const guide = axisGuideFor(model.guidePlans, "x");
      expect(model.guidePlans.map((plan) => plan.aesthetic).toSorted()).toEqual(["x", "y"]);
      expect(guide?.scaleType).toBe("time");
      expect(guide?.overlap, String(width)).toBe(false);
      expect(guide?.ticks.every((tick) => tick.fullLabel.length > 0)).toBe(true);
      expect(model.scaleDecisions[0]?.guidePlanIds).toContain(guide?.id);
      expect(model.scene.panels[0]?.axisX?.every((tick) => tick.kind === "major")).toBe(true);
    }
  });

  it("warns unused-scale-option when generic minorBreaks loses to dateMinorBreaks", () => {
    const model = runPipeline(
      gg(
        [
          { date: "2024-01-01", value: 1 },
          { date: "2024-04-01", value: 2 },
        ],
        aes({ x: "date", y: "value" }),
      )
        .geomLine()
        .scales({
          x: {
            type: "time",
            temporalKind: "date",
            dateMinorBreaks: "1 week",
            minorBreaks: [1_704_672_000_000],
          },
        })
        .spec(),
      size,
    );
    const warning = model.warnings.find(
      (w) => w.code === "unused-scale-option" && w.message.includes("minorBreaks"),
    );
    expect(warning).toBeDefined();
    expect(warning!.message).toContain("dateMinorBreaks takes precedence");
  });

  it("projects explicit major and minor temporal intervals separately", () => {
    const model = runPipeline(
      gg(
        [
          { date: "2024-01-01", value: 1 },
          { date: "2024-04-01", value: 2 },
        ],
        aes({ x: "date", y: "value" }),
      )
        .geomLine()
        .scaleXDate({
          dateBreaks: "1 month",
          dateMinorBreaks: "1 week",
          dateLabels: "%Y-%m-%d",
        })
        .spec(),
      size,
    );
    const guide = axisGuideFor(model.guidePlans, "x");
    expect(guide.source).toBe("interval");
    expect(guide.ticks.some((tick) => tick.kind === "minor")).toBe(true);
    expect(model.scene.panels[0]?.grid.minorX.length).toBeGreaterThan(0);
    expect(Object.hasOwn(model.scene.grid, "minorX")).toBe(false);
    expect(Object.hasOwn(model.scene.grid, "minorY")).toBe(false);
    const majorGrid = new Set(model.scene.panels[0]?.grid.x ?? []);
    expect((model.scene.panels[0]?.grid.minorX ?? []).every((value) => !majorGrid.has(value))).toBe(
      true,
    );
  });

  it("reports bounded explicit temporal intervals as structured pipeline errors", () => {
    expect(() =>
      runPipeline(
        gg(yearRows, aes({ x: "year", y: "value" }))
          .geomLine()
          .scaleXDate({ dateBreaks: "1 day" })
          .spec(),
        size,
      ),
    ).toThrow(
      expect.objectContaining({
        name: "PipelineError",
        code: "temporal-break-limit",
        path: "/scales/x/dateBreaks",
      }),
    );
  });

  it("keeps explicit temporal interval errors on their owning axis and option", () => {
    expect(() =>
      runPipeline(
        gg(
          [
            { x: "2024-01-01", y: "1900-01-01" },
            { x: "2024-01-03", y: "2025-01-01" },
          ],
          aes({ x: "x", y: "y" }),
        )
          .geomPoint()
          .scaleXDate({ dateBreaks: "1 day" })
          .scaleYDate({ dateBreaks: "1 day" })
          .spec(),
        size,
      ),
    ).toThrow(
      expect.objectContaining({
        code: "temporal-break-limit",
        path: "/scales/y/dateBreaks",
      }),
    );

    expect(() =>
      runPipeline(
        gg(yearRows, aes({ x: "year", y: "value" }))
          .geomLine()
          .scaleXDate({ dateBreaks: "1 day", dateMinorBreaks: "1 day" })
          .spec(),
        size,
      ),
    ).toThrow(
      expect.objectContaining({
        code: "temporal-break-limit",
        path: "/scales/x/dateBreaks",
      }),
    );

    expect(() =>
      runPipeline(
        gg(
          [
            { date: "2024-01-01", value: 1 },
            { date: "2024-12-31", value: 2 },
          ],
          aes({ x: "date", y: "value" }),
        )
          .geomLine()
          .scaleXDate({ dateBreaks: "1 year", dateMinorBreaks: "1 day" })
          .spec(),
        size,
      ),
    ).toThrow(
      expect.objectContaining({
        code: "temporal-break-limit",
        path: "/scales/x/dateMinorBreaks",
      }),
    );
  });

  it("rejects temporal guides on explicitly non-time runtime scales", () => {
    for (const type of ["linear", "log", "band"] as const) {
      let thrown: unknown;
      try {
        runPipeline(
          {
            edition: 2,
            data: {
              values: [
                { when: "2024-01-01", value: 1 },
                { when: "2024-01-03", value: 2 },
              ],
            },
            layers: [
              {
                geom: "point",
                stat: "identity",
                position: "identity",
                aes: { x: { field: "when" }, y: { field: "value" } },
              },
            ],
            scales: {
              x: { type, parse: "ymd", dateBreaks: "1 day", dateLabels: "%Y-%m-%d" },
            },
          },
          size,
        );
      } catch (error) {
        thrown = error;
      }
      // type "log" canonicalizes to the linear family (transform log10) before
      // validation, so the mismatch reports the canonical "linear".
      const canonicalType = type === "log" ? "linear" : type;
      expect(thrown, type).toBeInstanceOf(SpecValidationError);
      expect((thrown as SpecValidationError).errors, type).toEqual([
        {
          code: "scale-type-mismatch",
          path: "/scales/x",
          message: `scales.x uses temporal break or label options with explicit type "${canonicalType}".`,
          fix: {
            description:
              'Use type "time", a date/datetime scale helper, or remove the temporal option.',
          },
        },
      ]);
    }
  });

  it("plans intervals for parser-backed rowless time axes without fabricating decisions", () => {
    const model = runPipeline(
      {
        edition: 2,
        data: { values: [{ pad: 1 }] },
        layers: [
          {
            geom: "rule",
            stat: "identity",
            position: "identity",
            params: { xintercept: ["2024-01-01", "2024-01-10"] },
          },
        ],
        scales: {
          x: {
            type: "time",
            parse: "ymd",
            domain: ["2024-01-01", "2024-01-10"],
            dateBreaks: "3 days",
            nice: false,
          },
        },
      },
      size,
    );
    const guide = axisGuideFor(model.guidePlans, "x");
    expect(guide.source).toBe("interval");
    expect(guide.temporalKind).toBe("date");
    expect(guide.interval).toBe("3 days");
    expect(guide.ticks.filter((tick) => tick.kind === "major").map((tick) => tick.value)).toEqual([
      Date.UTC(2024, 0, 3),
      Date.UTC(2024, 0, 6),
      Date.UTC(2024, 0, 9),
    ]);
    expect(model.scaleDecisions.filter((decision) => decision.aesthetic === "x")).toHaveLength(0);
  });

  it("preserves authored overlapping labels and emits a structured diagnostic", () => {
    const model = runPipeline(
      gg(
        [
          { date: "2024-01-01", value: 1 },
          { date: "2024-12-31", value: 2 },
        ],
        aes({ x: "date", y: "value" }),
      )
        .geomLine()
        .scaleXDate({ dateBreaks: "1 month", dateLabels: "%Y-%m-%d" })
        .spec(),
      { width: 120, height: 240 },
    );
    const labels = model.scene.panels[0]?.axisX?.map((tick) => tick.label) ?? [];
    expect(labels).toContain("2024-01-01");
    expect(labels.some((label) => label.includes("…"))).toBe(false);
    expect(
      model.scaleDiagnostics.some((diagnostic) => diagnostic.code === "temporal-label-overlap"),
    ).toBe(true);
  });

  it("preserves labels and reports margin overflow separately from overlap", () => {
    const model = runPipeline(
      gg(
        [
          { date: "2024-01-01", value: 1 },
          { date: "2024-02-01", value: 2 },
        ],
        aes({ x: "date", y: "value" }),
      )
        .geomLine()
        .scaleXDate({ dateBreaks: "1 month", dateLabels: "%A %B %Y-%m-%d" })
        .spec(),
      { width: 120, height: 240 },
    );
    const labels = model.scene.panels[0]?.axisX?.map((tick) => tick.label) ?? [];
    expect(labels).toEqual(["Monday January 2024-01-01", "Thursday February 2024-02-01"]);
    expect(labels.every((label) => !label.includes("…"))).toBe(true);
    expect(
      model.scaleDiagnostics.some(
        (diagnostic) => diagnostic.code === "temporal-label-margin-overflow",
      ),
    ).toBe(true);
  });

  it("applies explicit temporal precedence and reports ignored shorthand", () => {
    const model = runPipeline(
      gg(
        [
          { date: "2024-01-01", value: 1 },
          { date: "2024-04-01", value: 2 },
        ],
        aes({ x: "date", y: "value" }),
      )
        .geomLine()
        .scaleXDate({
          breaks: ["2024-01-01", "2024-04-01"],
          dateBreaks: "1 month",
          labels: "%Y",
          dateLabels: "%b",
        })
        .spec(),
      size,
    );
    const guide = axisGuideFor(model.guidePlans, "x");
    expect(guide.source).toBe("explicit");
    expect(guide.interval).toBeNull();
    expect(guide.ticks.map((tick) => tick.label)).toEqual(["Jan", "Apr"]);
    expect(model.warnings.filter((warning) => warning.code === "unused-scale-option")).toHaveLength(
      2,
    );
  });
});
