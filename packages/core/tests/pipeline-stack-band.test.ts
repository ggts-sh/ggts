/**
 * Stacked-band visibility diagnostics (#1883) through the public pipeline.
 *
 * The repro stack (busy years × eight shares) renders E/F/G/H bands under
 * 2 px at 1600×300 while the legend keeps their keys; each test asserts the
 * returned warnings, or their absence, without importing the collector.
 */
import { describe, expect, it, spyOn } from "bun:test";

import { aes, gg, guideLegend, guideNone, scaleFillContinuous } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import type { RenderModel } from "../src/pipeline/types.ts";

/** Busy-year multiplier from the #1883 repro (0 elsewhere, years 2000..2022). */
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

/** Per-group shares in percent, A→H (E–H land under 2 px at the repro size). */
const SHARES: ReadonlyArray<readonly [string, number]> = [
  ["A", 60],
  ["B", 25],
  ["C", 8],
  ["D", 4],
  ["E", 1.2],
  ["F", 0.8],
  ["G", 0.6],
  ["H", 0.4],
];

const reproRows = Array.from({ length: 23 }, (_, index) => 2000 + index).flatMap((year) => {
  const busy = BUSY[year] ?? 0;
  return SHARES.map(([group, share]) => ({
    year: `${year}-01-01`,
    group,
    n: Math.round(busy * share),
  }));
});

const reproBuilder = () =>
  gg(reproRows, {
    x: { field: "year" },
    y: { field: "n" },
    fill: { field: "group" },
    group: { field: "group" },
  })
    .geomArea({ position: "stack" })
    .scales({ x: { type: "time", labels: "%Y" } })
    .guides({ fill: guideLegend({ position: "bottom", direction: "horizontal" }) })
    .labs({
      title: "Events per year",
      subtitle: "Stacked by group",
      x: "Year",
      y: "Events",
      fill: "Group",
    });

const reproSpec = () => reproBuilder().spec();

const stackWarnings = (model: RenderModel) =>
  model.warnings.filter((warning) => warning.code === "stack-band-hidden");

const stackedCol = (rows: ReadonlyArray<Record<string, unknown>>) =>
  gg(rows as Record<string, unknown>[], aes({ x: "x", y: "n", fill: "g", group: "g" }))
    .geomCol({ position: "stack" })
    .spec();

/** Two x slots with a genuinely thin second group under the bottom legend. */
const thinStackedCol = () =>
  gg(
    [
      { x: "one", g: "big", n: 990 },
      { x: "two", g: "big", n: 990 },
      { x: "one", g: "tiny", n: 10 },
      { x: "two", g: "tiny", n: 10 },
    ],
    aes({ x: "x", y: "n", fill: "g", group: "g" }),
  )
    .geomCol({ position: "stack" })
    .guides({ fill: guideLegend({ position: "bottom", direction: "horizontal" }) });

describe("stack band visibility (#1883)", () => {
  it("names E, F, G, H — but not D — at the repro size", () => {
    const model = runPipeline(reproSpec(), { width: 1600, height: 300 });
    const warnings = stackWarnings(model);
    expect(warnings).toHaveLength(1);
    const message = warnings[0]!.message;
    expect(message.match(/for groups (.+?) in layer 0/)?.[1]).toBe("E, F, G, H");
    expect(message).toContain('Merge small groups into "Other"');
    expect(message).toContain("facet by group with free y scales");
    expect(message).toContain('position: "fill"');
    expect(message).toContain("log y scale");
  });

  it("stays silent when the same stack is rendered tall", () => {
    const model = runPipeline(reproSpec(), { width: 1600, height: 3000 });
    expect(stackWarnings(model)).toEqual([]);
  });

  it("stays silent when every group owns a fat band", () => {
    const model = runPipeline(
      stackedCol([
        { x: "one", g: "a", n: 50 },
        { x: "one", g: "b", n: 50 },
        { x: "two", g: "a", n: 40 },
        { x: "two", g: "b", n: 60 },
      ]),
      { width: 800, height: 600 },
    );
    expect(stackWarnings(model)).toEqual([]);
  });

  it("names a 1% share under position fill on a short viewport, silent when tall", () => {
    const rows = [
      { x: "one", g: "big", n: 99 },
      { x: "one", g: "tiny", n: 1 },
    ];
    const spec = gg(rows, aes({ x: "x", y: "n", fill: "g", group: "g" }))
      .geomCol({ position: "fill" })
      .spec();
    const short = stackWarnings(runPipeline(spec, { width: 800, height: 200 }));
    expect(short).toHaveLength(1);
    expect(short[0]!.message).toContain("group tiny in layer 0");
    expect(stackWarnings(runPipeline(spec, { width: 800, height: 3000 }))).toEqual([]);
  });

  it("measures the band along the rendered width under coord flip", () => {
    const rows = [
      { x: "one", g: "big", n: 1000 },
      { x: "one", g: "thin", n: 3 },
    ];
    const flipped = gg(rows, aes({ x: "x", y: "n", fill: "g", group: "g" }))
      .geomCol({ position: "stack" })
      .coordFlip()
      .spec();
    const warnings = stackWarnings(runPipeline(flipped, { width: 400, height: 2000 }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("group thin in layer 0");

    // Same data upright: the tall panel gives the band ~6 px, so it stays quiet.
    const upright = gg(rows, aes({ x: "x", y: "n", fill: "g", group: "g" }))
      .geomCol({ position: "stack" })
      .spec();
    expect(stackWarnings(runPipeline(upright, { width: 400, height: 2000 }))).toEqual([]);
  });

  it("ignores dodge and identity positions even with tiny values", () => {
    const rows = [
      { x: "one", g: "a", n: 1000 },
      { x: "one", g: "b", n: 0.001 },
    ];
    for (const position of ["dodge", "identity"] as const) {
      const model = runPipeline(
        gg(rows, aes({ x: "x", y: "n", fill: "g", group: "g" }))
          .geomCol({ position })
          .spec(),
        { width: 300, height: 200 },
      );
      expect(stackWarnings(model)).toEqual([]);
    }
  });

  it("takes the maximum band thickness across facet panels", () => {
    const rows = [
      { x: 1, facet: "f1", g: "a", n: 100 },
      { x: 2, facet: "f1", g: "a", n: 100 },
      { x: 1, facet: "f1", g: "b", n: 1 },
      { x: 2, facet: "f1", g: "b", n: 1 },
      { x: 1, facet: "f2", g: "a", n: 1 },
      { x: 2, facet: "f2", g: "a", n: 1 },
      { x: 1, facet: "f2", g: "b", n: 100 },
      { x: 2, facet: "f2", g: "b", n: 100 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "n", fill: "g", group: "g" }))
        .geomCol({ position: "stack" })
        .facet({ wrap: "facet" })
        .spec(),
      { width: 800, height: 300 },
    );
    expect(model.scene.panels.length).toBeGreaterThan(1);
    expect(stackWarnings(model)).toEqual([]);
  });

  it("skips radial coordinates", () => {
    const rows = [
      { x: "one", g: "big", n: 1000 },
      { x: "one", g: "thin", n: 1 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "n", fill: "g", group: "g" }))
        .geomCol({ position: "stack" })
        .coordRadial({ theta: "y", expand: false })
        .spec(),
      { width: 400, height: 400 },
    );
    expect(stackWarnings(model)).toEqual([]);
  });

  it("stays silent for a single group with ordinary bars", () => {
    const model = runPipeline(
      gg(
        [
          { x: "one", n: 4 },
          { x: "two", n: 8 },
        ],
        aes({ x: "x", y: "n" }),
      )
        .geomCol()
        .spec(),
      { width: 400, height: 300 },
    );
    expect(stackWarnings(model)).toEqual([]);
  });

  it("names a group that is zero everywhere in a fat stack", () => {
    const model = runPipeline(
      stackedCol([
        { x: "one", g: "a", n: 100 },
        { x: "one", g: "b", n: 100 },
        { x: "one", g: "zero", n: 0 },
      ]),
      { width: 400, height: 300 },
    );
    const warnings = stackWarnings(model);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("group zero in layer 0");
  });

  it("warns under coord_fixed when the fitted panel leaves a genuinely thin band", () => {
    const model = runPipeline(thinStackedCol().coordFixed().spec(), { width: 400, height: 200 });
    const warnings = stackWarnings(model);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("group tiny in layer 0");
  });

  it("allows a reverse-only y transform but skips a nonlinear y transform", () => {
    const reversed = runPipeline(
      thinStackedCol()
        .coordTransform({ y: { transform: "identity", reverse: true } })
        .spec(),
      { width: 400, height: 200 },
    );
    const warnings = stackWarnings(reversed);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("group tiny in layer 0");

    const log = runPipeline(
      thinStackedCol()
        .coordTransform({ y: { transform: "log10", limits: [1, 1000], expand: false } })
        .spec(),
      { width: 400, height: 200 },
    );
    expect(stackWarnings(log)).toEqual([]);
  });

  it("stays silent when the fill legend is suppressed", () => {
    const model = runPipeline(reproBuilder().guides({ fill: guideNone() }).spec(), {
      width: 1600,
      height: 300,
    });
    expect(stackWarnings(model)).toEqual([]);
  });

  it("stays silent for a group-only stack with no fill mapping", () => {
    const model = runPipeline(
      gg(
        [
          { x: "one", g: "big", n: 990 },
          { x: "one", g: "tiny", n: 1 },
        ],
        aes({ x: "x", y: "n", group: "g" }),
      )
        .geomCol({ position: "stack" })
        .spec(),
      { width: 400, height: 200 },
    );
    expect(stackWarnings(model)).toEqual([]);
  });

  it("stays silent when fill is continuous and the legend is a ramp", () => {
    const model = runPipeline(
      gg(
        [
          { x: "one", g: "a", shade: 1, n: 990 },
          { x: "one", g: "b", shade: 2, n: 10 },
        ],
        aes({ x: "x", y: "n", fill: "shade", group: "g" }),
      )
        .geomCol({ position: "stack" })
        .scales(scaleFillContinuous())
        .spec(),
      { width: 400, height: 200 },
    );
    expect(model.scene.legends.some((legend) => legend.type === "ramp")).toBe(true);
    expect(stackWarnings(model)).toEqual([]);
  });

  it("stays silent for a degenerate stack where fill duplicates x", () => {
    const model = runPipeline(
      gg(
        [
          { x: "a", n: 10 },
          { x: "b", n: 3 },
        ],
        aes({ x: "x", y: "n", fill: "x" }),
      )
        .geomCol({ position: "stack" })
        .spec(),
      { width: 400, height: 200 },
    );
    expect(
      model.scene.legends.some((legend) => legend.type === "discrete" && legend.scale === "fill"),
    ).toBe(true);
    expect(stackWarnings(model)).toEqual([]);
  });

  it("stays silent when the panel is shorter than a visible band", () => {
    const model = runPipeline(reproSpec(), { width: 100, height: 100 });
    expect(stackWarnings(model)).toEqual([]);
  });

  it("caps named groups at 8 and appends +N more", () => {
    const rows = [
      { x: "one", g: "big", n: 1000 },
      ...Array.from({ length: 9 }, (_, index) => ({
        x: "one",
        g: `t${index + 1}`,
        n: 0.1,
      })),
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "n", fill: "g", group: "g" }))
        .geomCol({ position: "stack" })
        .guides({ fill: guideLegend({ position: "bottom", direction: "horizontal" }) })
        .spec(),
      { width: 400, height: 200 },
    );
    const warnings = stackWarnings(model);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain(
      "groups t1, t2, t3, t4, t5, t6, t7, t8, +1 more in layer 0",
    );
  });

  it("names a group once, in first-seen order, when two layers share its label", () => {
    const rows = [
      { x: "one", g: "big", n: 1000 },
      { x: "one", g: "tz", n: 0.1 },
      { x: "one", g: "ta", n: 0.1 },
      { x: "one", g: "tm", n: 0.1 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "n", fill: "g", group: "g" }))
        .geomCol({ position: "stack" })
        .geomCol({ position: "stack" })
        .guides({ fill: guideLegend({ position: "bottom", direction: "horizontal" }) })
        .spec(),
      { width: 400, height: 200 },
    );
    const warnings = stackWarnings(model);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("groups tz, ta, tm in layers 0 and 1");
  });

  it("dedupes hidden group names without scanning the names per band", () => {
    const levels = 2000;
    const rows = Array.from({ length: levels }, (_, index) => ({
      x: `x${index % 5}`,
      g: `g${index}`,
      n: 1,
    }));
    const spec = gg(rows, aes({ x: "x", y: "n", fill: "g", group: "g" }))
      .geomCol({ position: "stack" })
      .spec();

    // oxlint-disable-next-line typescript/unbound-method -- re-invoked with .apply below
    const originalIncludes = Array.prototype.includes;
    let walked = 0;
    const includes = spyOn(Array.prototype, "includes").mockImplementation(function counting(
      this: unknown[],
      ...args: [unknown, number?]
    ): boolean {
      walked += this.length;
      return originalIncludes.apply(this, args);
    });
    let model: RenderModel;
    try {
      model = runPipeline(spec, { width: 800, height: 500 });
    } finally {
      includes.mockRestore();
    }

    const warnings = stackWarnings(model);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain(`+${levels - 8} more in layer 0`);
    // A scan per band walks about levels² / 2 = 2,000,000 elements. This count
    // sees only `includes`, so a scan with another method would still pass.
    expect(walked).toBeLessThan(levels * 50);
  });

  it("takes the max across free_y facet panels and warns only when thin in every panel", () => {
    const rows = [
      { x: 1, facet: "large", g: "a", n: 1000 },
      { x: 2, facet: "large", g: "a", n: 1000 },
      { x: 1, facet: "large", g: "b", n: 1 },
      { x: 2, facet: "large", g: "b", n: 1 },
      { x: 1, facet: "small", g: "a", n: 1 },
      { x: 2, facet: "small", g: "a", n: 1 },
      { x: 1, facet: "small", g: "b", n: 5 },
      { x: 2, facet: "small", g: "b", n: 5 },
    ];
    const facetSpec = (facetRows: ReadonlyArray<Record<string, unknown>>) =>
      gg(facetRows as Record<string, unknown>[], aes({ x: "x", y: "n", fill: "g", group: "g" }))
        .geomCol({ position: "stack" })
        .guides({ fill: guideLegend({ position: "bottom", direction: "horizontal" }) })
        .facet({ wrap: "facet", scales: "free_y" })
        .spec();

    const maxModel = runPipeline(facetSpec(rows), { width: 800, height: 400 });
    expect(maxModel.scene.panels.length).toBeGreaterThan(1);
    expect(stackWarnings(maxModel)).toEqual([]);

    const thinEverywhere = rows.map((row) => ({
      ...row,
      n: row.g === "a" ? 1000 : 1,
    }));
    const thinModel = runPipeline(facetSpec(thinEverywhere), { width: 800, height: 400 });
    const warnings = stackWarnings(thinModel);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("group b in layer 0");
  });

  it("does not suppress the warning under theme.panelAspect free", () => {
    const model = runPipeline(reproBuilder().theme({ name: "light", panelAspect: "free" }).spec(), {
      width: 1600,
      height: 300,
    });
    const warnings = stackWarnings(model);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message.match(/for groups (.+?) in layer 0/)?.[1]).toBe("E, F, G, H");
  });
});
