/**
 * Per-layer DataRef (#589): facet interactions with layer data, plus the
 * remaining multi-table edges deferred from PR #603 (#609).
 */
import { describe, expect, it } from "bun:test";

import { createFacetPanelIdentity } from "../src/facet-identity.ts";
import { runPipeline } from "../src/pipeline.ts";

import { annotations, markCount, obs, size } from "./layer-data-fixtures.ts";

describe("layer data facets", () => {
  it("discovers open grid levels after filters and preserves layer source rows", () => {
    const rows = [
      { g: "drop", region: "gone", season: "lost", x: 1, y: 3 },
      { g: "keep", region: "primary", season: "spring", x: 2, y: 4 },
      { g: "drop", region: "gone", season: "lost", x: 3, y: 5 },
    ];
    const later = { region: "later", season: "winter", x: 4, y: 9 };
    const partial = { region: "primary", x: 5, y: 10 };
    const model = runPipeline(
      {
        data: { values: rows },
        aes: { x: "x", y: "y" },
        facet: { rows: { field: "region" }, cols: { field: "season" } },
        layers: [
          { geom: "point", aes: { color: "g" } },
          { geom: "point", data: { values: [later] } },
          { geom: "point", data: { values: [partial] } },
        ],
      },
      { ...size, rowFilters: [{ scale: "color", field: "g", values: ["drop"], mode: "exclude" }] },
    );

    const panels = model.scene.panels.map(({ identity }) => identity);
    const expectedPanels = (
      [
        ["later", "spring"],
        ["later", "winter"],
        ["primary", "spring"],
        ["primary", "winter"],
      ] as const
    ).map(([region, season]) =>
      createFacetPanelIdentity([
        { role: "rows", field: "region", value: region },
        { role: "cols", field: "season", value: season },
      ]),
    );
    expect(panels).toEqual(expectedPanels);
    const candidates = Array.from({ length: model.candidates.size }, (_, id) => {
      const mark = model.candidates.candidate(id)!;
      return [
        mark.panelIndex,
        mark.layerIndex,
        mark.rowIndex,
        model.lineage.keys(mark.lineage),
        model.row(mark.rowIndex!),
      ];
    });
    expect(candidates).toEqual([
      [2, 0, 1, [1], rows[1]],
      [1, 1, 3, [3], later],
      [2, 2, 4, [4], partial],
      [3, 2, 4, [4], partial],
    ]);
  });

  it("annotation layer without facet field replicates across all panels", () => {
    const model = runPipeline(
      {
        data: { values: obs },
        aes: { x: { field: "x" }, y: { field: "y" } },
        facet: { wrap: { field: "g" } },
        layers: [
          { geom: "point" },
          {
            geom: "text",
            data: { values: annotations },
            aes: { x: { field: "x" }, y: { field: "y" }, label: { field: "label" } },
          },
        ],
      },
      size,
    );
    expect(model.scene.panels.length).toBe(2);
    // One annotation mark per panel.
    expect(markCount(model, "glyphs")).toBe(2);
    // Both glyph rows resolve to the same underlying annotation source row.
    const glyphRows = model.scene.batches
      .filter((b) => b.kind === "glyphs")
      .flatMap((b) => [...b.rowIndex]);
    expect(new Set(glyphRows).size).toBe(1);
    expect(model.row(glyphRows[0]!)?.label).toBe("peak");
  });

  it("layer with facet field partitions into matching panels only", () => {
    const model = runPipeline(
      {
        data: { values: obs },
        aes: { x: { field: "x" }, y: { field: "y" } },
        facet: { wrap: { field: "g" } },
        layers: [
          { geom: "point" },
          {
            geom: "point",
            data: {
              values: [
                { x: 1.5, y: 12, g: "a", tag: "only-a" },
                { x: 3.5, y: 22, g: "b", tag: "only-b" },
              ],
            },
            aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "tag" } },
          },
        ],
      },
      size,
    );
    expect(model.scene.panels.length).toBe(2);
    // Both secondary points should render (one per panel) plus observations.
    expect(markCount(model, "points")).toBe(obs.length + 2);
  });

  // #608: first-complete layout omitted panels that only appear on later layers.
  it("unions facet levels across complete per-layer tables (wrap)", () => {
    const model = runPipeline(
      {
        facet: { wrap: { field: "g" } },
        layers: [
          {
            geom: "point",
            data: {
              values: [
                { x: 1, y: 10, g: "a" },
                { x: 2, y: 20, g: "a" },
              ],
            },
            aes: { x: { field: "x" }, y: { field: "y" } },
          },
          {
            geom: "point",
            data: {
              values: [
                { x: 3, y: 30, g: "b" },
                { x: 4, y: 40, g: "b" },
              ],
            },
            aes: { x: { field: "x" }, y: { field: "y" } },
          },
        ],
      },
      size,
    );
    expect(model.scene.panels.map((p) => p.strip)).toEqual(["a", "b"]);
    expect(markCount(model, "points")).toBe(4);
  });

  it("unions facet levels when a layer introduces levels absent from plot data", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { x: 1, y: 10, g: "a" },
            { x: 2, y: 20, g: "b" },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" } },
        facet: { wrap: { field: "g" } },
        layers: [
          { geom: "point" },
          {
            geom: "point",
            data: {
              values: [
                { x: 5, y: 50, g: "c", tag: "extra" },
                { x: 6, y: 60, g: "c", tag: "extra" },
              ],
            },
            aes: { x: { field: "x" }, y: { field: "y" } },
          },
        ],
      },
      size,
    );
    expect(model.scene.panels.map((p) => p.strip)).toEqual(["a", "b", "c"]);
    // Plot points (2) + layer-local "c" points (2).
    expect(markCount(model, "points")).toBe(4);
  });

  it("unions facet grid levels across complete per-layer tables", () => {
    const model = runPipeline(
      {
        facet: { rows: { field: "r" }, cols: { field: "c" } },
        layers: [
          {
            geom: "point",
            data: { values: [{ x: 1, y: 1, r: "R1", c: "C1" }] },
            aes: { x: { field: "x" }, y: { field: "y" } },
          },
          {
            geom: "point",
            data: { values: [{ x: 2, y: 2, r: "R2", c: "C2" }] },
            aes: { x: { field: "x" }, y: { field: "y" } },
          },
        ],
      },
      size,
    );
    // Grid keeps the full rows × cols product (empty combos stay empty).
    expect(model.scene.panels).toHaveLength(4);
    expect(model.scene.panels.map((p) => p.strip).toSorted()).toEqual(
      ["R1 / C1", "R1 / C2", "R2 / C1", "R2 / C2"].toSorted(),
    );
    expect(markCount(model, "points")).toBe(2);
  });
});

// #609 — remaining multi-table edges deferred from PR #603.
describe("multi-table edges (#609)", () => {
  it("type:binned x reads each layer table (no unknown-field on later-layer field)", () => {
    const model = runPipeline(
      {
        scales: { x: { type: "binned" } },
        layers: [
          {
            geom: "point",
            data: {
              values: [
                { a: 1, y: 1 },
                { a: 2, y: 2 },
              ],
            },
            aes: { x: { field: "a" }, y: { field: "y" } },
          },
          {
            geom: "point",
            data: {
              values: [
                { score: 10, y: 3 },
                { score: 90, y: 4 },
              ],
            },
            aes: { x: { field: "score" }, y: { field: "y" } },
          },
        ],
      },
      size,
    );
    expect(markCount(model, "points")).toBe(4);
    // Extent must include the later-layer field (score up to 90), not only primary `a`.
    const xDomain = model.domains.effective.x;
    expect(xDomain[1]).toBeGreaterThanOrEqual(50);
  });

  it("fixed-x faceted histogram bins each layer's own x field", () => {
    const model = runPipeline(
      {
        facet: { wrap: { field: "g" } },
        scales: { x: { type: "linear" } },
        layers: [
          {
            geom: "histogram",
            stat: "bin",
            data: {
              values: [
                { a: 1, g: "p" },
                { a: 2, g: "p" },
                { a: 1, g: "q" },
                { a: 3, g: "q" },
              ],
            },
            aes: { x: { field: "a" } },
          },
          {
            geom: "histogram",
            stat: "bin",
            data: {
              values: [
                { score: 10, g: "p" },
                { score: 20, g: "p" },
                { score: 15, g: "q" },
              ],
            },
            aes: { x: { field: "score" } },
          },
        ],
      },
      size,
    );
    expect(model.scene.panels.length).toBe(2);
    // Both layers contribute rects without throwing unknown-field on `score`.
    expect(markCount(model, "rects")).toBeGreaterThan(0);
  });

  it("transform diagnostics scan filtered layer tables, not unfiltered sources", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { x: 1, y: 1, group: "keep" },
            { x: -5, y: 2, group: "hide" },
            { x: 10, y: 3, group: "keep" },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "group" } },
        scales: { x: { type: "linear", transform: "log10" } },
        layers: [{ geom: "point" }],
      },
      {
        ...size,
        rowFilters: [{ scale: "color", field: "group", mode: "exclude", values: ["hide"] }],
      },
    );
    // Filtered-out non-positive x must not emit transform-domain diagnostics.
    expect(model.warnings.some((w) => w.code === "scale-transform-domain")).toBe(false);
    expect(model.scaleDiagnostics.some((d) => d.code === "scale-transform-domain")).toBe(false);
    expect(markCount(model, "points")).toBe(2);
  });

  it("faceted boxplot outlier candidates keep global source rows (no double remap)", () => {
    // Enough rows per panel that a panel-local outlier index can be confused with
    // a different sourceRows entry if remapped twice (#609).
    const values = [
      { g: "a", cat: "box", y: 1 },
      { g: "a", cat: "box", y: 2 },
      { g: "a", cat: "box", y: 3 },
      { g: "a", cat: "box", y: 4 },
      { g: "a", cat: "box", y: 5 },
      { g: "a", cat: "box", y: 100 }, // outlier at source row 5
      { g: "b", cat: "box", y: 1 },
      { g: "b", cat: "box", y: 2 },
      { g: "b", cat: "box", y: 3 },
      { g: "b", cat: "box", y: 4 },
      { g: "b", cat: "box", y: 5 },
      { g: "b", cat: "box", y: 6 },
    ];
    const model = runPipeline(
      {
        data: { values },
        facet: { wrap: { field: "g" } },
        layers: [
          {
            geom: "boxplot",
            stat: "boxplot",
            aes: { x: { field: "cat" }, y: { field: "y" } },
          },
        ],
      },
      size,
    );
    const outliers = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id),
    ).filter((c) => c?.kind === "points" && c.yValue === 100);
    expect(outliers.length).toBe(1);
    const outlier = outliers[0]!;
    // Lineage must pin the true observation row (index 5), not a remapped alias.
    const keys = [...model.lineage.keys(outlier.lineage)];
    expect(keys).toEqual([5]);
    expect(model.row(5)?.y).toBe(100);
  });

  it("shares source-row identity for plot named ref and explicit layer named ref", () => {
    // Same name:"cars" at plot and layer must reuse one ColumnTable / registry range.
    const model = runPipeline(
      {
        data: { name: "cars" },
        datasets: { cars: { values: obs } },
        layers: [
          { geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } },
          {
            geom: "point",
            data: { name: "cars" },
            aes: { x: { field: "x" }, y: { field: "y" } },
          },
        ],
      },
      size,
    );
    // Four source rows once — not 8 from a double registry registration.
    expect(model.row(0)).toMatchObject({ x: 1, y: 10 });
    expect(model.row(3)).toMatchObject({ x: 4, y: 25 });
    expect(model.row(4)).toBeNull();
  });

  it("does not apply a color legend filter to layers that do not map color", () => {
    // Layer 1 maps color:group; layer 2 has a group column for faceting only.
    const model = runPipeline(
      {
        layers: [
          {
            geom: "point",
            data: {
              values: [
                { x: 1, y: 1, group: "a" },
                { x: 2, y: 2, group: "b" },
              ],
            },
            aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "group" } },
          },
          {
            geom: "point",
            data: {
              values: [
                { x: 3, y: 3, group: "a" },
                { x: 4, y: 4, group: "b" },
              ],
            },
            aes: { x: { field: "x" }, y: { field: "y" } },
          },
        ],
      },
      {
        ...size,
        rowFilters: [{ scale: "color", field: "group", mode: "exclude", values: ["a"] }],
      },
    );
    // Layer 1 loses group "a"; layer 2 keeps both rows (no color mapping).
    expect(markCount(model, "points")).toBe(3);
  });

  it("does not retain panel source rows on annotation frames", () => {
    const model = runPipeline(
      {
        data: { values: obs },
        layers: [
          { geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } },
          { geom: "rule", params: { yintercept: 15 } },
        ],
      },
      size,
    );
    // Annotation batch has no source rows; rowIndex sentinel remains NO_ROW.
    const rule = model.scene.batches.find((b) => b.kind === "segments" || b.kind === "paths");
    expect(rule).toBeDefined();
    if (rule !== undefined) {
      for (const row of rule.rowIndex) expect(row).toBe(0xffffffff);
    }
  });
});
