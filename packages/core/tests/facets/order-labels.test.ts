/**
 * Facet explicit levels, display labels, and diagnostics (issue #590).
 * Seam: resolveFacet + runPipeline public panel order/labels/warnings.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import { resolveFacet } from "../../src/pipeline/facets.ts";
import type { PipelineWarning } from "../../src/pipeline/types.ts";
import { ColumnTable } from "../../src/table.ts";
import { size, wrapRows } from "./fixtures.ts";

const table = ColumnTable.fromRows([
  { g: "b", x: 1 },
  { g: "a", x: 2 },
  { g: "c", x: 3 },
  { g: "a", x: 4 },
]);

describe("facet levels and labels — resolveFacet (#590)", () => {
  it("uses closed levels order, including empty panels for missing levels", () => {
    const warnings: PipelineWarning[] = [];
    const layout = resolveFacet(
      {
        wrap: { field: "g", levels: ["c", "a", "missing", "b"] },
      },
      table,
      null,
      warnings,
    );
    expect(layout.panels.map((p) => p.label)).toEqual(["c", "a", "missing", "b"]);
    expect(layout.panels[2]!.table.rowCount).toBe(0);
    expect(layout.panels[1]!.table.rowCount).toBe(2); // two "a" rows
    expect(warnings.some((w) => w.code === "facet-levels-missing")).toBe(true);
  });

  it("drops data values omitted from closed levels and diagnoses them", () => {
    const warnings: PipelineWarning[] = [];
    const layout = resolveFacet(
      { wrap: { field: "g", levels: ["c", "a"] } },
      table,
      null,
      warnings,
    );
    expect(layout.panels.map((p) => p.label)).toEqual(["c", "a"]);
    // "b" rows are excluded from every panel
    const totalRows = layout.panels.reduce((n, p) => n + p.table.rowCount, 0);
    expect(totalRows).toBe(3); // 1 c + 2 a
    expect(warnings.some((w) => w.code === "facet-levels-unknown")).toBe(true);
  });

  it("applies display labels without changing panel identity keys", () => {
    const layout = resolveFacet(
      {
        wrap: {
          field: "g",
          levels: ["c", "a", "b"],
          labels: { c: "Charlie", a: "Alpha", b: "Bravo" },
        },
      },
      table,
    );
    expect(layout.panels.map((p) => p.label)).toEqual(["Charlie", "Alpha", "Bravo"]);
    // Identity uses semantic values, not display labels
    expect(layout.panels[0]!.identity.values[0]!.encodedValue).toBe("c");
    expect(layout.panels[0]!.id).toContain("c");
    expect(layout.panels[0]!.id).not.toContain("Charlie");
  });

  it("defaults strip to top + show when strip config is absent", () => {
    const layout = resolveFacet({ wrap: { field: "g" } }, table);
    expect(layout.strip).toEqual({ position: "top", show: true });
  });

  it("propagates strip position and show on the layout", () => {
    const layout = resolveFacet(
      { wrap: { field: "g" }, strip: { position: "left", show: false } },
      table,
    );
    expect(layout.strip).toEqual({ position: "left", show: false });
  });

  it("orders grid rows/cols by per-field levels and labels each side", () => {
    const grid = ColumnTable.fromRows([
      { r: "south", c: "east", x: 1 },
      { r: "north", c: "west", x: 2 },
    ]);
    const layout = resolveFacet(
      {
        rows: { field: "r", levels: ["south", "north"], labels: { south: "S", north: "N" } },
        cols: { field: "c", levels: ["west", "east"], labels: { west: "W", east: "E" } },
      },
      grid,
    );
    expect(layout.nrow).toBe(2);
    expect(layout.ncol).toBe(2);
    expect(layout.panels.map((p) => p.label)).toEqual(["S / W", "S / E", "N / W", "N / E"]);
    // Empty combo south/west still present
    expect(layout.panels[0]!.table.rowCount).toBe(0);
    expect(layout.panels[1]!.table.rowCount).toBe(1);
  });

  it("keeps empty panels for grid row levels absent from data", () => {
    const grid = ColumnTable.fromRows([{ r: "north", c: "east", x: 1 }]);
    const layout = resolveFacet(
      {
        rows: { field: "r", levels: ["south", "north"] },
        cols: { field: "c", levels: ["east"] },
      },
      grid,
    );
    expect(layout.panels).toHaveLength(2);
    expect(layout.panels[0]!.table.rowCount).toBe(0); // south absent
    expect(layout.panels[1]!.table.rowCount).toBe(1); // north present
  });
});

describe("facet levels and labels — runPipeline (#590)", () => {
  it("panel strip text and order follow authored levels/labels", () => {
    const model = runPipeline(
      gg(wrapRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({
          wrap: {
            field: "g",
            levels: ["c", "a", "b"],
            labels: { c: "High", a: "Low", b: "Mid" },
          },
        })
        .spec(),
      size,
    );
    expect(model.scene.panels.map((p) => p.strip)).toEqual(["High", "Low", "Mid"]);
    // Order independent of input row order (wrapRows is b,a,c)
    expect(model.scene.panels[0]!.y).toBeLessThanOrEqual(model.scene.panels[1]!.y);
  });

  it("surfaces levels diagnostics on the render model", () => {
    const model = runPipeline(
      gg(wrapRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({ wrap: { field: "g", levels: ["c", "ghost"] } })
        .spec(),
      size,
    );
    const codes = model.warnings.map((w) => w.code);
    expect(codes).toContain("facet-levels-missing");
    expect(codes).toContain("facet-levels-unknown");
  });
});
