/**
 * Temporal parser resolution, timezone/locale, and source-column parsing.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import { axisGuideFor, size, yearRows } from "./fixtures.ts";

describe("temporal pipeline: parsers", () => {
  it("derives rowless date kind from a configured parser domain", () => {
    const model = runPipeline(
      {
        edition: 2,
        data: { values: [{ pad: 1 }] },
        layers: [
          {
            geom: "rule",
            stat: "identity",
            position: "identity",
            params: { yintercept: 0 },
          },
        ],
        scales: {
          x: {
            type: "time",
            parse: "ymd",
            domain: ["2024-01-01", "2024-01-03"],
            dateBreaks: "1 day",
            nice: false,
          },
        },
      },
      size,
    );
    const guide = axisGuideFor(model.guidePlans, "x");
    expect(guide.source).toBe("interval");
    expect(guide.temporalKind).toBe("date");
    expect(guide.ticks.every((tick) => !tick.fullLabel.includes(":"))).toBe(true);
    expect(model.scaleDecisions.filter((decision) => decision.aesthetic === "x")).toHaveLength(0);
  });

  it("rejects unparseable explicit breaks instead of misreporting them as out of domain", () => {
    expect(() =>
      runPipeline(
        gg(
          [
            { date: "2024-01-01", value: 1 },
            { date: "2024-04-01", value: 2 },
          ],
          aes({ x: "date", y: "value" }),
        )
          .geomLine()
          .scaleXDate({ breaks: ["2024-01-01", "not-a-date"] })
          .spec(),
        size,
      ),
    ).toThrow(
      expect.objectContaining({
        code: "invalid-scale-breaks",
        path: "/scales/x/breaks",
      }),
    );
  });

  it("renders builder Date cells through an explicit calendar scale", () => {
    const model = runPipeline(
      gg(
        [
          { when: new Date("2024-01-01T00:00:00.000Z"), value: 1 },
          { when: new Date("2024-01-02T00:00:00.000Z"), value: 2 },
        ],
        aes({ x: "when", y: "value" }),
      )
        .geomLine()
        .scaleXDate({ parse: "iso", nice: false })
        .spec(),
      size,
    );

    expect(model.scales.x.type).toBe("time");
    expect(model.scales.x.domain).toEqual([Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 2)]);
  });

  it("positions reordered typed band breaks by domain identity", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { category: 1, value: 1 },
            { category: "1", value: 2 },
            { category: 2, value: 3 },
          ],
        },
        layers: [
          {
            geom: "point",
            aes: { x: { field: "category" }, y: { field: "value" } },
          },
        ],
        scales: { x: { type: "band", breaks: [2, 1] } },
      },
      size,
    );
    expect(model.scene.axes.x.ticks.map(({ label }) => label)).toEqual(["2", "1"]);
    expect(model.scene.axes.x.ticks[0]!.pos).toBeGreaterThan(model.scene.axes.x.ticks[1]!.pos);
    if (model.scales.x.type === "band") {
      expect(model.scales.x.rawDomain).toEqual([1, "1", 2]);
    }
  });

  it("uses an explicit ordered parser throughout grouping, frames, and scale training", () => {
    const rows = [
      { when: "01/02/2025", value: 1 },
      { when: "02/03/2025", value: 2 },
      { when: "03/04/2025", value: 3 },
      { when: "04/05/2025", value: 4 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "when", y: "value" }))
        .geomLine()
        .scaleXDate({ parse: "dmy" })
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain).toEqual([
        new Date("2025-02-01T00:00:00.000Z").getTime(),
        new Date("2025-05-04T00:00:00.000Z").getTime(),
      ]);
    }
    const line = model.scene.batches.find((batch) => batch.kind === "paths");
    expect(line?.kind).toBe("paths");
    if (line?.kind === "paths") expect([...line.pathOffsets]).toEqual([0, 4]);
  });

  it("uses the same parser for explicit domains and breaks", () => {
    const rows = [
      { when: "31/12/2024", value: 1 },
      { when: "02/01/2025", value: 2 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "when", y: "value" }))
        .geomPoint()
        .scaleXDate({
          parse: "dmy",
          domain: ["30/12/2024", "03/01/2025"],
          breaks: ["31/12/2024", "02/01/2025"],
          nice: false,
        })
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain).toEqual([
        new Date("2024-12-30T00:00:00.000Z").getTime(),
        new Date("2025-01-03T00:00:00.000Z").getTime(),
      ]);
    }
    expect(model.scene.axes.x.ticks).toHaveLength(2);
  });

  it("reuses an unambiguous source parser for domains and breaks", () => {
    const rows = [
      { when: "13/01/2024", value: 1 },
      { when: "03/04/2024", value: 2 },
      { when: "05/06/2024", value: 3 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "when", y: "value" }))
        .geomPoint()
        .scaleXDate({
          domain: ["01/01/2024", "01/07/2024"],
          breaks: ["01/02/2024", "01/06/2024"],
          nice: false,
        })
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain).toEqual([
        new Date("2024-01-01T00:00:00.000Z").getTime(),
        new Date("2024-07-01T00:00:00.000Z").getTime(),
      ]);
    }
    expect(model.scene.axes.x.ticks).toHaveLength(2);
  });

  it("keeps calendar-date parsers on UTC dates even when a timezone is configured", () => {
    const model = runPipeline(
      gg(
        [
          { year: "2024", value: 1 },
          { year: "2025", value: 2 },
        ],
        aes({ x: "year", y: "value" }),
      )
        .geomLine()
        .scaleXDate({ timezone: "Asia/Tokyo", nice: false })
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain).toEqual([Date.UTC(2024, 0, 1), Date.UTC(2025, 0, 1)]);
    }
    expect(model.axisFormatters.x("2024")).toContain("2024");
  });

  it("applies timezone and disambiguation to automatically selected parsers", () => {
    const rows = [
      { when: "2024-03-10T01:30:00", value: 1 },
      { when: "2024-03-10T02:30:00", value: 2 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "when", y: "value" }))
        .geomLine()
        .scaleXDatetime({
          timezone: "America/New_York",
          disambiguation: "later",
          nice: false,
        })
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain).toEqual([
        new Date("2024-03-10T06:30:00.000Z").getTime(),
        new Date("2024-03-10T07:30:00.000Z").getTime(),
      ]);
    }
  });

  it("passes semantic epoch numbers through resolved parsers for rules and formatters", () => {
    const epoch = Date.UTC(1900, 0, 1);
    const inferred = runPipeline(
      gg(yearRows, aes({ x: "year", y: "value" }))
        .geomPoint()
        .geomRule({ xintercept: epoch })
        .spec(),
      size,
    );
    expect(inferred.scene.batches.some((batch) => batch.kind === "segments")).toBe(true);
    expect(inferred.warnings.some((warning) => warning.code === "removed-missing")).toBe(false);
    expect(inferred.axisFormatters.x(epoch)).toContain("1900");

    const explicit = runPipeline(
      gg(
        [
          { when: "01/02/2025", value: 1 },
          { when: "02/03/2025", value: 2 },
        ],
        aes({ x: "when", y: "value" }),
      )
        .geomPoint()
        .geomRule({ xintercept: Date.UTC(2025, 2, 1) })
        .scaleXDate({ parse: "dmy" })
        .spec(),
      size,
    );
    expect(explicit.scene.batches.some((batch) => batch.kind === "segments")).toBe(true);
    expect(explicit.warnings.some((warning) => warning.code === "removed-missing")).toBe(false);
  });

  it("preserves epoch-second source semantics through domains, stats, and rules", () => {
    const seconds = [900_000_000, 1_000_000_000, 1_100_000_000];
    const point = runPipeline(
      gg(
        seconds.map((when, index) => ({ when, value: index + 1 })),
        aes({ x: "when", y: "value" }),
      )
        .geomPoint()
        .geomRule({ xintercept: 1_050_000_000 })
        .geomRule({ xintercept: "1050000000" })
        .scaleXDatetime({
          parse: { epoch: "seconds" },
          domain: [900_000_000, 1_200_000_000],
          breaks: [1_000_000_000, 1_100_000_000],
          nice: false,
        })
        .spec(),
      size,
    );
    expect(point.scales.x.type).toBe("time");
    if (point.scales.x.type !== "band") {
      expect(point.scales.x.domain).toEqual([900_000_000_000, 1_200_000_000_000]);
    }
    expect(point.scene.axes.x.ticks).toHaveLength(2);
    expect(point.axisFormatters.x(1_000_000_000)).toBe(point.axisFormatters.x(1_000_000_000_000));
    const rules = point.scene.batches.filter((batch) => batch.kind === "segments");
    expect(rules).toHaveLength(2);
    if (rules[0]?.kind === "segments" && rules[1]?.kind === "segments") {
      expect(rules[0].segments[0]).toBeCloseTo(rules[1].segments[0]!, 5);
    }

    for (const stat of ["count", "summary"] as const) {
      const rows = seconds.map((when, index) => ({ when, value: index + 1 }));
      const layer =
        stat === "count"
          ? gg(rows, aes({ x: "when" })).geomBar()
          : gg(rows, aes({ x: "when", y: "value" })).geomErrorbar({ stat: "summary" });
      const model = runPipeline(
        layer.scaleXDatetime({ parse: { epoch: "seconds" }, nice: false }).spec(),
        size,
      );
      expect(model.scales.x.type).toBe("time");
      if (model.scales.x.type !== "band") {
        expect(model.scales.x.domain).toEqual([900_000_000_000, 1_100_000_000_000]);
      }
    }
  });

  it("keeps independent auto-parser decisions for mixed temporal bound formats", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { x: "a", lo: "2024-01-01", hi: "31/01/2024" },
            { x: "b", lo: "2024-02-01", hi: "29/02/2024" },
          ],
        },
        layers: [
          {
            geom: "errorbar",
            aes: { x: { field: "x" }, ymin: { field: "lo" }, ymax: { field: "hi" } },
          },
        ],
      },
      size,
    );
    expect(model.scales.y.type).toBe("time");
    expect(model.scaleDecisions.map(({ parser }) => parser)).toEqual(["iso", "dmy"]);

    expect(() =>
      runPipeline(
        {
          data: {
            values: [
              { x: "a", lo: "2024-01-01", hi: "31/01/2024" },
              { x: "b", lo: "2024-02-01", hi: "29/02/2024" },
            ],
          },
          layers: [
            {
              geom: "errorbar",
              aes: { x: { field: "x" }, ymin: { field: "lo" }, ymax: { field: "hi" } },
            },
            { geom: "rule", params: { yintercept: "not-a-date" } },
          ],
        },
        size,
      ),
    ).toThrow(PipelineError);
  });
});
