/**
 * Characterization tests for facet layout and layer partitioning.
 * Exercises resolveFacet / SINGLE_PANEL directly so the extraction stays
 * pinned to ggplot2 panel order and free-scale contracts.
 *
 * Seams under test (issue #183):
 * - partitionByField: single O(n) pass → Map<encodeKey, row indices>
 * - resolveFacet with layer slicing: panel membership and empty grid parity
 * - complexity: facet-field column() reads stay O(1) in distinct levels
 */
import { describe, expect, it, spyOn } from "bun:test";

import { encodeKey } from "../src/scales/state.ts";
import { PipelineError } from "../src/pipeline.ts";
import { resolveFacet, SINGLE_PANEL } from "../src/pipeline/facets.ts";
import { assertFacetForm, facetFreeFlags } from "../src/pipeline/facets-form.ts";
import { facetValues } from "../src/pipeline/facets-helpers.ts";
import { partitionByField, partitionByFields } from "../src/pipeline/facets-tokens.ts";
import { ColumnTable } from "../src/table.ts";
import { facetSlices } from "./facets/fixtures.ts";

const table = ColumnTable.fromRows([
  { g: "b", r: "y", c: "1", x: 1 },
  { g: "a", r: "y", c: "2", x: 2 },
  { g: "c", r: "x", c: "1", x: 3 },
  { g: "a", r: "x", c: "2", x: 4 },
]);

/** Count ColumnTable.column(field) calls during fn (restored after). */
function countColumnReads(field: string, fn: () => void): number {
  let reads = 0;
  const desc = Object.getOwnPropertyDescriptor(ColumnTable.prototype, "column");
  if (desc?.value === undefined) {
    throw new Error("ColumnTable.prototype.column is not a data property");
  }
  const impl = desc.value as (this: ColumnTable, name: string) => readonly unknown[];
  const spy = spyOn(ColumnTable.prototype, "column").mockImplementation(function (
    this: ColumnTable,
    name: string,
  ) {
    if (name === field) reads += 1;
    return impl.call(this, name);
  });
  try {
    fn();
    return reads;
  } finally {
    spy.mockRestore();
  }
}

describe("SINGLE_PANEL", () => {
  it("returns one unfaceted panel without strip chrome", () => {
    const layout = SINGLE_PANEL();
    expect(layout.faceted).toBe(false);
    expect(layout.panels).toHaveLength(1);
    expect(layout.nrow).toBe(1);
    expect(layout.ncol).toBe(1);
    expect(layout.freeX).toBe(false);
    expect(layout.freeY).toBe(false);
    expect(layout.panels[0]!.identity.values).toEqual([]);
    expect(layout.panels[0]!.label).toBe("");
  });
});

describe("resolveFacet — wrap", () => {
  it("orders panels by ascending facet value and near-square wrap", () => {
    const layout = resolveFacet({ wrap: { field: "g" } }, table);
    expect(layout.faceted).toBe(true);
    expect(layout.panels.map((p) => p.label)).toEqual(["a", "b", "c"]);
    // 3 panels -> ncol = ceil(sqrt(3)) = 2
    expect(layout.ncol).toBe(2);
    expect(layout.nrow).toBe(2);
    expect(layout.panels[0]!.row).toBe(0);
    expect(layout.panels[0]!.col).toBe(0);
    expect(layout.panels[1]!.col).toBe(1);
    expect(layout.panels[2]!.row).toBe(1);
  });

  it("slices layer rows using wrap panel identity", () => {
    const layout = resolveFacet({ wrap: { field: "g" } }, table);
    const panelA = facetSlices(layout, table, "g")[0]!;
    expect(panelA.table.rowCount).toBe(2);
    expect(panelA.globalSourceRows).toEqual([1, 3]);
  });

  it("honors free scale flags", () => {
    expect(resolveFacet({ wrap: { field: "g" }, scales: "free" }, table)).toMatchObject({
      freeX: true,
      freeY: true,
    });
    expect(resolveFacet({ wrap: { field: "g" }, scales: "free_x" }, table)).toMatchObject({
      freeX: true,
      freeY: false,
    });
    expect(resolveFacet({ wrap: { field: "g" }, scales: "free_y" }, table)).toMatchObject({
      freeX: false,
      freeY: true,
    });
  });

  it("throws structured unknown-field errors", () => {
    try {
      resolveFacet({ wrap: { field: "missing" } }, table);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("unknown-field");
      expect((e as PipelineError).path).toBe("/facet/wrap");
    }
  });
});

describe("resolveFacet — grid", () => {
  it("builds a rows × cols cartesian panel grid", () => {
    const layout = resolveFacet({ rows: { field: "r" }, cols: { field: "c" } }, table);
    expect(layout.faceted).toBe(true);
    // r: x,y (sorted); c: 1,2 (sorted) → 2×2
    expect(layout.nrow).toBe(2);
    expect(layout.ncol).toBe(2);
    expect(layout.panels).toHaveLength(4);
    // labels combine row/col values
    expect(layout.panels.map((p) => p.label).toSorted()).toEqual(
      ["x / 1", "x / 2", "y / 1", "y / 2"].toSorted(),
    );
  });

  it("keeps empty grid combinations as empty panels with empty layer slices", () => {
    const sparse = ColumnTable.fromRows([
      { r: "a", c: "1", x: 1 },
      { r: "b", c: "2", x: 2 },
    ]);
    const layout = resolveFacet({ rows: { field: "r" }, cols: { field: "c" } }, sparse);
    expect(layout.panels).toHaveLength(4);
    const empty = facetSlices(layout, sparse, "r", "c").filter((p) => p.table.rowCount === 0);
    expect(empty.length).toBe(2);
    for (const panel of empty) {
      expect(panel.globalSourceRows).toEqual([]);
    }
  });

  it("rejects mixing wrap with rows/cols", () => {
    try {
      resolveFacet({ wrap: { field: "g" }, rows: { field: "r" } }, table);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("facet-form-ambiguous");
    }
  });

  it("rejects empty facet forms", () => {
    try {
      resolveFacet({}, table);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("facet-form-missing");
    }
  });
});

describe("facetValues — decorate-sort (#1312)", () => {
  it("orders temporal levels by semantic time (numeric tier, no bandKey)", () => {
    // Temporal columns take the numeric sort tier; bandKey is only for nominal.
    // The decorate step must not call bandKey on this path — Invalid Date would
    // throw via toISOString (Devin on #1386).
    const t = ColumnTable.fromRows([
      { d: "2020-01-03", x: 1 },
      { d: "2020-01-01", x: 2 },
      { d: "2020-01-02", x: 3 },
    ]);
    expect(t.fieldType("d")).toBe("temporal");
    expect(facetValues(t, "d")).toEqual(["2020-01-01", "2020-01-02", "2020-01-03"]);
  });

  it("orders quantitative levels ascending with null last", () => {
    const t = ColumnTable.fromRows([
      { n: 3, x: 1 },
      { n: 1, x: 2 },
      { n: null, x: 3 },
      { n: 2, x: 4 },
    ]);
    expect(t.fieldType("n")).not.toBe("nominal");
    expect(facetValues(t, "n")).toEqual([1, 2, 3, null]);
  });
});

describe("facetFreeFlags / assertFacetForm", () => {
  it("derives free_x and free_y from scales modes", () => {
    expect(facetFreeFlags()).toEqual({ freeX: false, freeY: false });
    expect(facetFreeFlags("free")).toEqual({ freeX: true, freeY: true });
    expect(facetFreeFlags("free_x")).toEqual({ freeX: true, freeY: false });
    expect(facetFreeFlags("free_y")).toEqual({ freeX: false, freeY: true });
  });

  it("throws facet-form-ambiguous when wrap mixes with grid fields", () => {
    try {
      assertFacetForm({ wrapField: "g", rowsField: "r", colsField: null });
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("facet-form-ambiguous");
    }
  });
});

describe("partitionByField — single-pass buckets", () => {
  it("groups row indices by encodeKey in table order", () => {
    const t = ColumnTable.fromRows([
      { g: "b", x: 0 },
      { g: "a", x: 1 },
      { g: "b", x: 2 },
      { g: "a", x: 3 },
      { g: null, x: 4 },
      { g: 1, x: 5 },
      { g: "1", x: 6 },
    ]);
    const buckets = partitionByField(t, "g");
    expect(buckets.get(encodeKey("b"))).toEqual([0, 2]);
    expect(buckets.get(encodeKey("a"))).toEqual([1, 3]);
    expect(buckets.get(encodeKey(null))).toEqual([4]);
    // number 1 and string "1" stay distinct panels
    expect(buckets.get(encodeKey(1))).toEqual([5]);
    expect(buckets.get(encodeKey("1"))).toEqual([6]);
    expect(buckets.size).toBe(5);
  });

  it("reads the facet column once", () => {
    const t = ColumnTable.fromRows(
      Array.from({ length: 40 }, (_, i) => ({ g: `v${i % 10}`, x: i })),
    );
    const reads = countColumnReads("g", () => {
      partitionByField(t, "g");
    });
    expect(reads).toBe(1);
  });
});

describe("partitionByFields — single-pass composite buckets", () => {
  it("groups row indices by (a, b) encodeKey in table order", () => {
    const t = ColumnTable.fromRows([
      { r: "a", c: "1", x: 0 },
      { r: "a", c: "2", x: 1 },
      { r: "b", c: "1", x: 2 },
      { r: "a", c: "1", x: 3 },
      { r: "b", c: "1", x: 4 },
    ]);
    const grid = partitionByFields(t, "r", "c");
    expect(grid.get(encodeKey("a"))?.get(encodeKey("1"))).toEqual([0, 3]);
    expect(grid.get(encodeKey("a"))?.get(encodeKey("2"))).toEqual([1]);
    expect(grid.get(encodeKey("b"))?.get(encodeKey("1"))).toEqual([2, 4]);
    // absent (b, 2) combination — no bucket at all
    expect(grid.get(encodeKey("b"))?.get(encodeKey("2"))).toBeUndefined();
  });

  it("keeps number/string keys distinct on both axes", () => {
    const t = ColumnTable.fromRows([
      { r: 1, c: "1", x: 0 },
      { r: "1", c: 1, x: 1 },
    ]);
    const grid = partitionByFields(t, "r", "c");
    expect(grid.get(encodeKey(1))?.get(encodeKey("1"))).toEqual([0]);
    expect(grid.get(encodeKey("1"))?.get(encodeKey(1))).toEqual([1]);
    expect(grid.get(encodeKey(1))?.get(encodeKey(1))).toBeUndefined();
  });

  it("reads each facet column once", () => {
    const t = ColumnTable.fromRows(
      Array.from({ length: 40 }, (_, i) => ({ r: `r${i % 5}`, c: `c${i % 8}`, x: i })),
    );
    const rReads = countColumnReads("r", () => {
      partitionByFields(t, "r", "c");
    });
    const cReads = countColumnReads("c", () => {
      partitionByFields(t, "r", "c");
    });
    expect(rReads).toBe(1);
    expect(cReads).toBe(1);
  });
});

describe("resolveFacet — layout work and slicing integration", () => {
  it.each([
    ["wrap", { wrap: { field: "g" } }, 3],
    ["grid", { rows: { field: "r" }, cols: { field: "c" } }, 4],
  ] as const)("discovers %s layout without copying panel tables", (_name, facet, panelCount) => {
    const subset = spyOn(ColumnTable.prototype, "subset");
    try {
      expect(resolveFacet(facet, table).panels).toHaveLength(panelCount);
      expect(subset).not.toHaveBeenCalled();
    } finally {
      subset.mockRestore();
    }
  });

  it("wrap: column reads stay bounded as distinct levels grow", () => {
    const levels = 40;
    const rows = Array.from({ length: levels * 5 }, (_, i) => ({
      g: `g${i % levels}`,
      x: i,
    }));
    const t = ColumnTable.fromRows(rows);
    const reads = countColumnReads("g", () => {
      resolveFacet({ wrap: { field: "g" } }, t);
    });
    // Learn the levels without reading the field once per panel.
    expect(reads).toBeLessThanOrEqual(4);
    expect(reads).toBeLessThan(levels);
  });

  it("grid: row/col column reads stay bounded as the cartesian grid grows", () => {
    const R = 12;
    const C = 12;
    const rows = Array.from({ length: R * C }, (_, i) => ({
      r: `r${i % R}`,
      c: `c${Math.floor(i / R) % C}`,
      x: i,
    }));
    const t = ColumnTable.fromRows(rows);
    const rowReads = countColumnReads("r", () => {
      resolveFacet({ rows: { field: "r" }, cols: { field: "c" } }, t);
    });
    const colReads = countColumnReads("c", () => {
      resolveFacet({ rows: { field: "r" }, cols: { field: "c" } }, t);
    });
    // Not one scan per row-level / col-level / cell
    expect(rowReads).toBeLessThanOrEqual(4);
    expect(colReads).toBeLessThanOrEqual(4);
    expect(rowReads).toBeLessThan(R);
    expect(colReads).toBeLessThan(C);
  });

  it("wrap still assigns every source row to exactly one panel", () => {
    const layout = resolveFacet({ wrap: { field: "g" } }, table);
    const assigned = facetSlices(layout, table, "g").flatMap((p) => p.globalSourceRows);
    expect(assigned.toSorted((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });

  it("grid still intersects row/col buckets and keeps empty combos", () => {
    const sparse = ColumnTable.fromRows([
      { r: "a", c: "1", x: 1 },
      { r: "a", c: "1", x: 2 },
      { r: "b", c: "2", x: 3 },
    ]);
    const layout = resolveFacet({ rows: { field: "r" }, cols: { field: "c" } }, sparse);
    expect(layout.panels).toHaveLength(4);
    const slices = facetSlices(layout, sparse, "r", "c");
    const byLabel = Object.fromEntries(
      layout.panels.map((p, i) => [p.label, slices[i]!.globalSourceRows]),
    );
    expect(byLabel["a / 1"]).toEqual([0, 1]);
    expect(byLabel["b / 2"]).toEqual([2]);
    expect(byLabel["a / 2"]).toEqual([]);
    expect(byLabel["b / 1"]).toEqual([]);
  });

  it("grid rows-only partitions by row field in ascending table order", () => {
    const t = ColumnTable.fromRows([
      { r: "b", x: 1 },
      { r: "a", x: 2 },
      { r: "b", x: 3 },
    ]);
    const layout = resolveFacet({ rows: { field: "r" } }, t);
    expect(layout.nrow).toBe(2);
    expect(layout.ncol).toBe(1);
    expect(layout.panels.map((p) => p.label)).toEqual(["a", "b"]);
    expect(facetSlices(layout, t, "r").map((p) => p.globalSourceRows)).toEqual([[1], [0, 2]]);
  });

  it("grid cols-only partitions by col field in ascending table order", () => {
    const t = ColumnTable.fromRows([
      { c: "2", x: 1 },
      { c: "1", x: 2 },
      { c: "2", x: 3 },
    ]);
    const layout = resolveFacet({ cols: { field: "c" } }, t);
    expect(layout.nrow).toBe(1);
    expect(layout.ncol).toBe(2);
    expect(layout.panels.map((p) => p.label)).toEqual(["1", "2"]);
    expect(facetSlices(layout, t, "c").map((p) => p.globalSourceRows)).toEqual([[1], [0, 2]]);
  });
});
