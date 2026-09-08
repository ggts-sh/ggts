/**
 * Temporal semantics through stats (smooth/summary/count) and facets.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import { axisGuidesFor, size } from "./fixtures.ts";

describe("temporal pipeline: stats and facets", () => {
  it("passes explicit temporal semantics into pre-stat smooth inputs", () => {
    const rows = [
      { when: "01/01/2025", value: 1 },
      { when: "02/01/2025", value: 2 },
      { when: "03/01/2025", value: 3 },
      { when: "04/01/2025", value: 4 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "when", y: "value" }))
        .geomSmooth({ method: "lm", se: false })
        .scaleXDate({ parse: "dmy" })
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
    expect(model.warnings.some((warning) => warning.code === "removed-stat-rows")).toBe(false);
    expect(model.warnings.some((warning) => warning.code === "smooth-group-dropped")).toBe(false);
    expect(model.scene.batches.some((batch) => batch.kind === "paths")).toBe(true);
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain).toEqual([
        new Date("2025-01-01T00:00:00.000Z").getTime(),
        new Date("2025-01-04T00:00:00.000Z").getTime(),
      ]);
    }
  });

  it("retains the source-column parser decision through filtered summary stats", () => {
    const rows = [
      { when: "13/01/2024", value: 1, visibility: "hide" },
      { when: "03/04/2024", value: 2, visibility: "keep" },
      { when: "05/06/2024", value: 3, visibility: "keep" },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "when", y: "value", color: "visibility" }))
        .geomErrorbar({ stat: "summary" })
        .spec(),
      {
        ...size,
        rowFilters: [{ scale: "color", field: "visibility", mode: "exclude", values: ["hide"] }],
      },
    );
    expect(model.scales.x.type).toBe("time");
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain).toEqual([
        new Date("2024-04-03T00:00:00.000Z").getTime(),
        new Date("2024-06-05T00:00:00.000Z").getTime(),
      ]);
    }
  });

  it("preserves explicit ordered parsing through free-x facet subsets", () => {
    const rows = [
      { when: "01/02/2025", value: 1, group: "a" },
      { when: "02/03/2025", value: 2, group: "a" },
      { when: "03/04/2025", value: 3, group: "b" },
      { when: "04/05/2025", value: 4, group: "b" },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "when", y: "value" }))
        .geomLine()
        .scaleXDate({ parse: "dmy", nice: false })
        .facet({ wrap: "group", scales: "free_x" })
        .spec(),
      size,
    );
    expect(model.scales.panels).toHaveLength(2);
    expect(model.scales.panels.map((panel) => panel.x.type)).toEqual(["time", "time"]);
    const facetGuides = axisGuidesFor(model.guidePlans, "x");
    expect(facetGuides).toHaveLength(2);
    expect(facetGuides.every((plan) => plan.interval !== null && !plan.overlap)).toBe(true);
    expect(
      model.scene.batches
        .filter((batch) => batch.kind === "paths")
        .map((batch) => (batch.kind === "paths" ? [...batch.pathOffsets] : [])),
    ).toEqual([
      [0, 2],
      [0, 2],
    ]);
  });

  it("converts count-stat x values with the selected calendar parser", () => {
    const rows = [{ year: "1835" }, { year: "1835" }, { year: "2026" }];
    const model = runPipeline(
      gg(rows, aes({ x: "year" }))
        .geomBar()
        .scaleXDate({ parse: "year", nice: false })
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain).toEqual([
        new Date("1835-01-01T00:00:00.000Z").getTime(),
        new Date("2026-01-01T00:00:00.000Z").getTime(),
      ]);
    }

    const equivalentSpellings = runPipeline(
      gg([{ when: "1/2/2025" }, { when: "01/02/2025" }], aes({ x: "when" }))
        .geomBar()
        .scaleXDate({ parse: "dmy", nice: false })
        .spec(),
      size,
    );
    // Count y axis (linear) now carries the default 5% display expansion.
    expect(equivalentSpellings.scales.y.domain).toEqual([-0.1, 2.1]);
  });

  it("aggregates summary-stat temporal x by semantic epoch, not raw spelling", () => {
    const model = runPipeline(
      gg(
        [
          { when: "1/2/2025", value: 1 },
          { when: "01/02/2025", value: 3 },
        ],
        aes({ x: "when", y: "value" }),
      )
        .geomErrorbar({ stat: "summary" })
        .scaleXDate({ parse: "dmy", nice: false })
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
    // One combined summary (mean_se of [1, 3]) — three segments for a single errorbar
    // (vertical + two whiskers). Raw-string bucketing would emit two errorbars (6 segments).
    const segments = model.scene.batches.find((batch) => batch.kind === "segments");
    expect(segments?.kind).toBe("segments");
    if (segments?.kind === "segments") {
      expect(segments.segments.length / 4).toBe(3);
    }
    expect(model.scene.axes.x.ticks.filter((tick) => tick.kind === "major")).toHaveLength(1);
    // Single-year day span → span-uniform month+day (#962); year lives on fullLabel.
    expect(model.scene.axes.x.ticks[0]!.label).toBe("Feb 1");
    expect(model.scene.axes.x.ticks[0]!.fullLabel).toContain("2025");
  });

  it("keeps raw category labels for banded temporal count bars", () => {
    const inferred = runPipeline(
      gg([{ year: "1835" }, { year: "1835" }, { year: "2026" }], aes({ x: "year" }))
        .geomBar()
        .spec(),
      size,
    );
    expect(inferred.scales.x.type).toBe("band");
    if (inferred.scales.x.type === "band") {
      expect(inferred.scales.x.domain).toEqual(["1835", "2026"]);
    }
    expect(inferred.scene.axes.x.ticks.map(({ label }) => label)).toEqual(["1835", "2026"]);
    // Count y remains non-temporal and receives the PR 3 default 5% display expansion.
    expect(inferred.scales.y.domain[0]).toBeCloseTo(-0.1, 12);
    expect(inferred.scales.y.domain[1]).toBeCloseTo(2.1, 12);

    const discrete = runPipeline(
      gg([{ year: "1835" }, { year: "1835" }, { year: "2026" }], aes({ x: "year" }))
        .geomBar()
        .scaleXDiscrete()
        .spec(),
      size,
    );
    expect(discrete.scales.x.type).toBe("band");
    if (discrete.scales.x.type === "band") {
      expect(discrete.scales.x.domain).toEqual(["1835", "2026"]);
    }
    expect(discrete.scene.axes.x.ticks.map(({ label }) => label)).toEqual(["1835", "2026"]);
    expect(discrete.scales.y.domain[0]).toBeCloseTo(-0.1, 12);
    expect(discrete.scales.y.domain[1]).toBeCloseTo(2.1, 12);
  });
});
