/**
 * Temporal scale inference, discrete overrides, breaks, and color mappings.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import { axisGuideFor, size, yearRows } from "./fixtures.ts";

describe("temporal pipeline: scales and inference", () => {
  it("retains explicit source breaks and diagnoses out-of-domain values", () => {
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
          domain: ["2024-01-01", "2024-04-01"],
          breaks: ["2023-12-01", "2024-01-01", "2024-05-01"],
        })
        .spec(),
      size,
    );
    const guide = axisGuideFor(model.guidePlans, "x");
    expect(guide.sourceBreaks).toEqual(["2023-12-01", "2024-01-01", "2024-05-01"]);
    expect(guide.ticks.filter((tick) => tick.kind === "major")).toHaveLength(1);
    expect(
      model.scaleDiagnostics.some(
        (diagnostic) => diagnostic.code === "temporal-break-outside-domain",
      ),
    ).toBe(true);
  });

  it("does not misreport duplicate in-domain breaks as outside the domain", () => {
    const model = runPipeline(
      gg(
        [
          { date: "2024-01-01", value: 1 },
          { date: "2024-04-01", value: 2 },
        ],
        aes({ x: "date", y: "value" }),
      )
        .geomLine()
        .scaleXDate({ breaks: ["2024-01-01", "2024-01-01", "2024-04-01"] })
        .spec(),
      size,
    );
    const guide = axisGuideFor(model.guidePlans, "x");
    expect(guide.ticks.filter((tick) => tick.kind === "major")).toHaveLength(3);
    expect(
      model.scaleDiagnostics.some(
        (diagnostic) => diagnostic.code === "temporal-break-outside-domain",
      ),
    ).toBe(false);
  });

  it("keeps semantic temporal plans ascending under reverse and coord flip", () => {
    const model = runPipeline(
      gg(yearRows, aes({ x: "year", y: "value" }))
        .geomLine()
        .scaleXDate({ reverse: true })
        .coordFlip()
        .spec(),
      size,
    );
    const guide = axisGuideFor(model.guidePlans, "x");
    const values = guide.ticks
      .filter((tick) => tick.kind === "major")
      .map((tick) => tick.value as number);
    expect(values).toEqual([...values].toSorted((left, right) => left - right));
    expect(guide.direction).toBe("descending");
    expect(model.scene.panels[0]?.axisY?.map((tick) => tick.label)).toEqual(
      guide.ticks.filter((tick) => tick.kind === "major").map((tick) => tick.label),
    );
  });

  it("infers raw string years as a time scale with epoch domain", () => {
    const model = runPipeline(
      gg(yearRows, aes({ x: "year", y: "value" }))
        .geomLine()
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[0]).toBe(new Date("1835-01-01T00:00:00.000Z").getTime());
      expect(model.scales.x.domain[1]).toBe(new Date("2026-01-01T00:00:00.000Z").getTime());
    }
    expect(model.advisories.some((advisory) => advisory.code === "temporal-year-inferred")).toBe(
      true,
    );
  });

  it("infers runtime Date values without putting Dates into PortableSpec", () => {
    const first = new Date("2024-01-01T00:00:00.000Z");
    const second = new Date("2024-01-02T12:00:00.000Z");
    const model = runPipeline(
      {
        data: { name: "runtime" },
        layers: [
          {
            geom: "point",
            aes: { x: { field: "when" }, y: { field: "value" } },
          },
        ],
      },
      {
        ...size,
        data: {
          runtime: [
            { when: first, value: 1 },
            { when: second, value: 2 },
          ],
        },
      },
    );
    expect(model.scales.x.type).toBe("time");
    expect(model.row(0)?.["when"]).toBe(first);
  });

  it("renders every identity geometry on an explicit discrete y scale", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { x: 1, category: "low", label: "L" },
            { x: 2, category: "high", label: "H" },
          ],
        },
        layers: [
          {
            geom: "point",
            aes: { x: { field: "x" }, y: { field: "category" } },
          },
          {
            geom: "line",
            aes: { x: { field: "x" }, y: { field: "category" } },
          },
          {
            geom: "text",
            aes: {
              x: { field: "x" },
              y: { field: "category" },
              label: { field: "label" },
            },
          },
          { geom: "rule", aes: { y: { field: "category" } } },
        ],
        scales: { y: { type: "band" } },
      },
      size,
    );
    expect(model.scales.y.type).toBe("band");
    expect(model.scene.batches.map(({ kind }) => kind)).toEqual([
      "points",
      "paths",
      "glyphs",
      "segments",
    ]);
  });

  it("maps temporal strings through a sequential color scale", () => {
    const model = runPipeline(
      gg(yearRows, aes({ x: "value", y: "value", color: "year" }))
        .geomPoint()
        .spec(),
      size,
    );
    const resolved = model.scales.color;
    expect(resolved?.kind).toBe("sequential");
    if (resolved?.kind !== "sequential") throw new Error("unreachable");
    expect(resolved.scale.domain).toEqual([Date.UTC(1835, 0, 1), Date.UTC(2026, 0, 1)]);
    expect(resolved.scale.colorOf("1835")).toMatch(/^#[0-9a-f]{6}$/);
    expect(resolved.scale.colorOf("1835")).not.toBe(resolved.scale.colorOf("2026"));
    const legend = model.scene.legends.find(
      (candidate) => candidate.type === "ramp" && candidate.scale === "color",
    );
    if (legend?.type !== "ramp") throw new Error("expected temporal ramp legend");
    expect(legend.ticks.map(({ label }) => label)).toEqual(["1850", "1900", "1950", "2000"]);

    const pinned = runPipeline(
      gg(yearRows, aes({ x: "value", y: "value", color: "year" }))
        .geomPoint()
        .scales({ color: { type: "sequential", domain: ["1835", "2026"] } })
        .spec(),
      size,
    ).scales.color;
    expect(pinned?.kind).toBe("sequential");
    if (pinned?.kind !== "sequential") throw new Error("expected pinned temporal color scale");
    expect(pinned.scale.domain).toEqual([Date.UTC(1835, 0, 1), Date.UTC(2026, 0, 1)]);
  });

  it("groups inferred temporal strings when color is explicitly ordinal", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1, year: "2024" },
          { x: 2, y: 2, year: "2024" },
          { x: 1, y: 3, year: "2025" },
          { x: 2, y: 4, year: "2025" },
        ],
        aes({ x: "x", y: "y", color: "year" }),
      )
        .geomLine()
        .scales({ color: { type: "ordinal" } })
        .spec(),
      size,
    );

    expect(model.scales.color?.kind).toBe("ordinal");
    const paths = model.scene.batches.find((batch) => batch.kind === "paths");
    expect(paths?.kind).toBe("paths");
    if (paths?.kind !== "paths") throw new Error("expected grouped paths");
    expect([...paths.pathOffsets]).toEqual([0, 2, 4]);
  });

  for (const [type, transform] of [
    ["linear", "identity"],
    ["log", "log10"],
  ] as const) {
    it(`keeps numeric string years quantitative under an explicit ${type} scale`, () => {
      const model = runPipeline(
        gg(yearRows, aes({ x: "year", y: "value" }))
          .geomLine()
          .scales({ x: { type, nice: false } })
          .spec(),
        size,
      );

      // "log" canonicalizes to the linear family + log10 transform.
      expect(model.scales.x.type).toBe("linear");
      if (model.scales.x.type !== "band") {
        expect(model.scales.x.transform).toBe(transform);
        // The semantic span 1835..2026 is retained (with 5% display expansion).
        expect(model.scales.x.domain[0]).toBeLessThanOrEqual(1835);
        expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(2026);
      }
      expect(model.scaleDecisions).toHaveLength(0);
    });
  }

  it("lets an explicit discrete scale override string-year inference", () => {
    const model = runPipeline(
      gg(yearRows, aes({ x: "year", y: "value" }))
        .geomLine()
        .scaleXDiscrete({ breaks: ["1835", "2026"] })
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("band");
    if (model.scales.x.type === "band")
      expect(model.scales.x.domain).toEqual(["1835", "1900", "2026"]);
    expect(model.scene.axes.x.ticks.map(({ label }) => label)).toEqual(["1835", "2026"]);
    expect(model.scene.axes.x.ticks[1]!.pos).toBeGreaterThan(model.scene.panels[0]!.width * 0.7);
    const line = model.scene.batches.find((batch) => batch.kind === "paths");
    if (line?.kind === "paths") expect([...line.pathOffsets]).toEqual([0, 1, 2, 3]);
    expect(model.scaleDecisions).toHaveLength(0);
  });

  it("infers temporal y scales from identity bounds", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { x: "a", lo: "2024-01-01", hi: "2024-01-03" },
            { x: "b", lo: "2024-02-01", hi: "2024-02-03" },
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
    expect(model.scaleDecisions.map(({ field }) => field)).toEqual(["lo", "hi"]);
  });
});
