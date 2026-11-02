/**
 * Final-layout panel diagnostics (#1884 / #1885) through the public pipeline:
 * extreme panel aspect and low vertical panel share. Each test asserts the
 * warnings on the returned render model, or the same boundaries against the
 * scene geometry that produced them; the diagnostics collector is not imported.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg, guideLegend } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import type { RenderModel } from "../src/pipeline/types.ts";

const rows = [
  { x: 1, y: 2, region: "North", g: "a" },
  { x: 2, y: 4, region: "South", g: "b" },
  { x: 3, y: 3, region: "North", g: "c" },
  { x: 4, y: 5, region: "South", g: "d" },
];

const unequalFacetRows = [
  { x: 0, y: "A1", g: "A" },
  { x: 10, y: "A2", g: "A" },
  { x: 0, y: "B1", g: "B" },
  { x: 10, y: "B2", g: "B" },
  { x: 5, y: "B3", g: "B" },
];

const plainSpec = gg(rows, aes({ x: "x", y: "y" }))
  .geomPoint()
  .spec();

const facetGridRows = Array.from({ length: 8 }, (_, index) => ({
  x: index,
  y: index % 3,
  g: `g${index}`,
}));

const codesOf = (model: RenderModel) => model.warnings.map((warning) => warning.code);

const aspectWarnings = (model: RenderModel) =>
  model.warnings.filter((warning) => warning.code === "panel-aspect-extreme");

const shareWarnings = (model: RenderModel) =>
  model.warnings.filter((warning) => warning.code === "panel-height-share-low");

function targetHeight(message: string | undefined): number {
  const match = message?.match(/Raise the plot height to about (\d+) px/);
  if (match === undefined) throw new Error("expected a recommended plot height");
  return Number(match[1]);
}

function facetUnionHeight(model: RenderModel): number {
  const panels = model.scene.panels;
  const top = Math.min(...panels.map((panel) => panel.y));
  const bottom = Math.max(...panels.map((panel) => panel.y + panel.height));
  return bottom - top;
}

describe("panel aspect diagnostics", () => {
  it("warns once for an extreme wide panel at the committed size", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .spec(),
      { width: 1600, height: 220 },
    );
    const aspect = aspectWarnings(model);
    expect(aspect).toHaveLength(1);
    expect(aspect[0]!.message).toMatch(/^Panel aspect is \d+\.\d:1 \(\d+×\d+ px\)/);
    expect(aspect[0]!.message).toContain("target about 2:1");
  });

  it("keeps exactly 4:1 silent and warns beyond it", () => {
    // 420×142 lays out a 376×94 panel: exactly 4:1.
    const atBound = runPipeline(plainSpec, { width: 420, height: 142 });
    const atBoundPanel = atBound.scene.panels[0]!;
    expect(atBoundPanel.width / atBoundPanel.height).toBe(4);
    expect(aspectWarnings(atBound)).toEqual([]);

    const beyond = runPipeline(plainSpec, { width: 420, height: 140 });
    const beyondPanel = beyond.scene.panels[0]!;
    expect(beyondPanel.width / beyondPanel.height).toBeGreaterThan(4);
    expect(aspectWarnings(beyond)).toHaveLength(1);
  });

  it("keeps exactly 1:4 silent and warns beyond it", () => {
    const atBound = runPipeline(plainSpec, { width: 420, height: 1520 });
    const atBoundPanel = atBound.scene.panels[0]!;
    expect(atBoundPanel.width / atBoundPanel.height).toBe(0.25);
    expect(aspectWarnings(atBound)).toEqual([]);

    const beyond = runPipeline(plainSpec, { width: 420, height: 1540 });
    const beyondPanel = beyond.scene.panels[0]!;
    expect(beyondPanel.width / beyondPanel.height).toBeLessThan(0.25);
    const aspect = aspectWarnings(beyond);
    expect(aspect).toHaveLength(1);
    expect(aspect[0]!.message).toContain("Widen the plot");
  });

  it("aggregates a facet grid into one warning and its target resolves it", () => {
    const facetSpec = () =>
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({ wrap: "g" })
        .spec();
    const model = runPipeline(facetSpec(), { width: 1600, height: 220 });
    expect(model.scene.panels).toHaveLength(4);
    const aspect = aspectWarnings(model);
    expect(aspect).toHaveLength(1);
    expect(aspect[0]!.message).toContain("4 of 4 panels");
    expect(aspect[0]!.message).toContain("target about 2:1");
    const worst = model.scene.panels.reduce((candidate, panel) =>
      panel.width / panel.height > candidate.width / candidate.height ? panel : candidate,
    );
    expect(aspect[0]!.message).toContain(
      `(${Math.round(worst.width)}×${Math.round(worst.height)} px)`,
    );

    const target = targetHeight(aspect[0]!.message);
    expect(target).toBeGreaterThan(220);
    const resolved = runPipeline(facetSpec(), { width: 1600, height: target });
    expect(aspectWarnings(resolved)).toEqual([]);
  });

  it("scales the target by the worst panel's unequal row allocation", () => {
    const facetSpec = (space?: "free_y") =>
      gg(unequalFacetRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({ rows: "g", scales: "free_y", ...(space !== undefined && { space }) })
        .spec();
    const unequal = runPipeline(facetSpec("free_y"), { width: 1200, height: 300 });
    const equal = runPipeline(facetSpec(), { width: 1200, height: 300 });

    const [shortRow, tallRow] = unequal.scene.panels;
    expect(shortRow!.height).toBeLessThan(tallRow!.height);
    expect(equal.scene.panels[0]!.height).toBeCloseTo(equal.scene.panels[1]!.height, 6);

    const unequalTarget = targetHeight(aspectWarnings(unequal)[0]?.message);
    const equalTarget = targetHeight(aspectWarnings(equal)[0]?.message);
    expect(unequalTarget).toBeGreaterThan(equalTarget);

    const resolved = runPipeline(facetSpec("free_y"), {
      width: 1200,
      height: unequalTarget,
    });
    expect(aspectWarnings(resolved)).toEqual([]);
  });

  it("does not hide small positive panels behind a minimum size", () => {
    const model = runPipeline(plainSpec, { width: 20, height: 140 });
    const panel = model.scene.panels[0]!;
    expect(panel.width).toBeGreaterThan(0);
    expect(panel.height).toBeGreaterThan(0);
    expect(aspectWarnings(model)).toHaveLength(1);
  });
});

describe("panel height share diagnostics", () => {
  it("warns with measured chrome when the short plot leaves under half", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint()
        .labs({ title: "Title", subtitle: "Subtitle", caption: "Source" })
        .guides({ color: guideLegend({ position: "bottom", direction: "horizontal" }) })
        .spec(),
      { width: 1200, height: 200 },
    );
    const panel = model.scene.panels[0]!;
    expect(panel.height / model.scene.height).toBeLessThan(0.5);
    const share = shareWarnings(model);
    expect(share).toHaveLength(1);
    expect(share[0]!.message).toMatch(/^The panel gets \d+ of 200 px \(\d+%\)\./);
    expect(share[0]!.message).toContain("Largest chrome:");
    expect(share[0]!.message).toMatch(/Raise the plot height to about \d+ px/);
  });

  it("keeps the facet-grid union rather than one facet row", () => {
    const model = runPipeline(
      gg(facetGridRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({ wrap: "g" })
        .spec(),
      { width: 800, height: 120 },
    );
    const half = model.scene.height / 2;
    expect(facetUnionHeight(model)).toBeGreaterThan(half);
    expect(Math.max(...model.scene.panels.map((panel) => panel.height))).toBeLessThan(half);
    expect(shareWarnings(model)).toEqual([]);
  });

  it("counts facet strips as chrome and names them", () => {
    const model = runPipeline(
      gg(facetGridRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .labs({ title: "Title", caption: "Caption" })
        .facet({ wrap: "g" })
        .spec(),
      { width: 800, height: 160 },
    );
    expect(facetUnionHeight(model)).toBeLessThan(model.scene.height / 2);
    const share = shareWarnings(model);
    expect(share).toHaveLength(1);
    expect(share[0]!.message).toContain("facet strips 54 px");
  });

  it("stays silent at exactly half the plot height and warns below it", () => {
    // 420×96 leaves a 48px panel grid: exactly half.
    const atHalf = runPipeline(plainSpec, { width: 420, height: 96 });
    const atHalfPanel = atHalf.scene.panels[0]!;
    expect(atHalfPanel.height / atHalf.scene.height).toBe(0.5);
    expect(shareWarnings(atHalf)).toEqual([]);

    const belowHalf = runPipeline(plainSpec, { width: 420, height: 94 });
    const belowHalfPanel = belowHalf.scene.panels[0]!;
    expect(belowHalfPanel.height / belowHalf.scene.height).toBeLessThan(0.5);
    const share = shareWarnings(belowHalf);
    expect(share).toHaveLength(1);
    expect(share[0]!.message).toContain("Raise the plot height");
  });
});

describe("panel diagnostics opt-out and scope", () => {
  it("theme.panelAspect free suppresses both warnings", () => {
    const base = gg(rows, aes({ x: "x", y: "y", color: "region" }))
      .geomPoint()
      .labs({ title: "Title", subtitle: "Subtitle", caption: "Source" })
      .guides({ color: guideLegend({ position: "bottom", direction: "horizontal" }) });
    const warned = runPipeline(base.spec(), { width: 1600, height: 220 });
    expect(codesOf(warned)).toContain("panel-aspect-extreme");
    expect(codesOf(warned)).toContain("panel-height-share-low");

    const free = runPipeline(base.theme({ name: "light", panelAspect: "free" }).spec(), {
      width: 1600,
      height: 220,
    });
    expect(codesOf(free)).not.toContain("panel-aspect-extreme");
    expect(codesOf(free)).not.toContain("panel-height-share-low");
  });

  it("skips fixed and radial coordinates whose proportion is authored", () => {
    for (const spec of [
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .coordFixed({ ratio: 0.1 })
        .spec(),
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .coordRadial()
        .spec(),
    ]) {
      const model = runPipeline(spec, { width: 1600, height: 220 });
      expect(codesOf(model)).not.toContain("panel-aspect-extreme");
      expect(codesOf(model)).not.toContain("panel-height-share-low");
    }
  });

  it("produces no panel warnings for degenerate viewports", () => {
    const viewports: readonly (readonly [number, number])[] = [
      [0, 0],
      [0, 100],
      [100, 0],
      [Number.NaN, 100],
    ];
    for (const [width, height] of viewports) {
      const model = runPipeline(plainSpec, { width, height });
      expect(codesOf(model)).not.toContain("panel-aspect-extreme");
      expect(codesOf(model)).not.toContain("panel-height-share-low");
    }
  });

  it("evaluates an empty dataset's placeholder without spurious shape warnings", () => {
    const model = runPipeline(
      {
        data: { values: [] },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
      },
      { width: 640, height: 400 },
    );
    expect(model.scene.panels).toHaveLength(1);
    expect(codesOf(model)).toContain("empty-data");
    expect(codesOf(model)).not.toContain("panel-aspect-extreme");
    expect(codesOf(model)).not.toContain("panel-height-share-low");
  });
});
