/**
 * Per-layer facet slicing: one grouping pass, then a lookup per panel.
 *
 * The oracle below is a frozen copy of the per-panel scan this replaced. It is
 * deliberately independent of the implementation: an oracle that called into
 * the code under test would agree with it no matter what either one did.
 */
import { describe, expect, it } from "bun:test";

import { createFacetPanelIdentity } from "../src/facet-identity.ts";
import type { FacetPanelDef } from "../src/pipeline/facets-types.ts";
import { createLayerPanelSlicer, type LayerPanelSlice } from "../src/pipeline/layer-panel-data.ts";
import { SourceRegistry } from "../src/pipeline/source-registry.ts";
import { NO_ROW } from "../src/pipeline/types-no-row.ts";
import { encodeKey } from "../src/scales/state.ts";
import { ColumnTable } from "../src/table.ts";

interface SliceInput {
  filteredTable: ColumnTable;
  filteredToSource: number[] | null;
  sourceId: number;
  registry: SourceRegistry;
  facetFields: readonly string[];
  faceted: boolean;
}

/** Frozen copy of the pre-change per-panel scan. Do not simplify. */
function oracleSlice(input: SliceInput, panel: FacetPanelDef): LayerPanelSlice {
  const { filteredTable, filteredToSource, sourceId, registry, facetFields, faceted } = input;
  if (!faceted || facetFields.length === 0) {
    const globalSourceRows: number[] = [];
    for (let i = 0; i < filteredTable.rowCount; i++) {
      globalSourceRows.push(registry.toGlobal(sourceId, filteredToSource?.[i] ?? i));
    }
    return { table: filteredTable, globalSourceRows };
  }
  const presentFields = facetFields.filter((f) => filteredTable.has(f));
  const panelEncoded = new Map<string, string>();
  for (const factor of panel.identity.values) panelEncoded.set(factor.field, factor.encodedValue);
  if (presentFields.length === 0) {
    const globalSourceRows: number[] = [];
    for (let i = 0; i < filteredTable.rowCount; i++) {
      globalSourceRows.push(registry.toGlobal(sourceId, filteredToSource?.[i] ?? i));
    }
    return { table: filteredTable, globalSourceRows };
  }
  const keep: number[] = [];
  const globalSourceRows: number[] = [];
  for (let i = 0; i < filteredTable.rowCount; i++) {
    let match = true;
    for (const field of presentFields) {
      const wanted = panelEncoded.get(field);
      if (wanted === undefined) continue;
      if (encodeKey(filteredTable.column(field)[i]!) !== wanted) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    keep.push(i);
    globalSourceRows.push(registry.toGlobal(sourceId, filteredToSource?.[i] ?? i));
  }
  if (keep.length === filteredTable.rowCount) return { table: filteredTable, globalSourceRows };
  return { table: filteredTable.subset(keep), globalSourceRows };
}

function wrapPanel(field: string, value: unknown): FacetPanelDef {
  const identity = createFacetPanelIdentity([{ role: "wrap", field, value }]);
  return { identity, id: identity.key, label: "", row: 0, col: 0 };
}

function gridPanel(
  rows: { field: string; value: unknown } | null,
  cols: { field: string; value: unknown } | null,
): FacetPanelDef {
  const identity = createFacetPanelIdentity([
    ...(rows === null ? [] : [{ role: "rows" as const, field: rows.field, value: rows.value }]),
    ...(cols === null ? [] : [{ role: "cols" as const, field: cols.field, value: cols.value }]),
  ]);
  return { identity, id: identity.key, label: "", row: 0, col: 0 };
}

/**
 * `unfiltered` stands in for the pre-filter source table the registry indexes,
 * so remapped rows resolve to real global ids instead of collapsing to NO_ROW.
 */
function inputFor(
  table: ColumnTable,
  facetFields: string[],
  filteredToSource: number[] | null,
  unfiltered?: ColumnTable,
) {
  const registry = new SourceRegistry();
  const sourceId = registry.register(unfiltered ?? table);
  return { filteredTable: table, filteredToSource, sourceId, registry, facetFields, faceted: true };
}

/** Compare against the frozen oracle on every axis that downstream code reads. */
function expectMatchesOracle(input: SliceInput, panels: FacetPanelDef[]): void {
  const slicer = createLayerPanelSlicer(input);
  for (const panel of panels) {
    const got = slicer(panel);
    const want = oracleSlice(input, panel);
    expect(got.globalSourceRows).toEqual(want.globalSourceRows);
    expect(got.table.rowCount).toBe(want.table.rowCount);
    // Table identity matters: the fast path must return the original instance,
    // because SourceRegistry keys its namespace on object identity.
    expect(got.table === input.filteredTable).toBe(want.table === input.filteredTable);
    expect(got.table.fields).toEqual(want.table.fields);
    for (const field of want.table.fields) {
      expect([...got.table.column(field)]).toEqual([...want.table.column(field)]);
    }
  }
}

describe("createLayerPanelSlicer matches the per-panel scan", () => {
  it("wrap: one facet field on the layer", () => {
    const table = ColumnTable.fromColumns({
      g: ["a", "b", "a", "c", "b", "a"],
      v: [1, 2, 3, 4, 5, 6],
    });
    expectMatchesOracle(inputFor(table, ["g"], null), [
      wrapPanel("g", "a"),
      wrapPanel("g", "b"),
      wrapPanel("g", "c"),
      wrapPanel("g", "zzz"), // closed levels can name a value with no rows
    ]);
  });

  it("grid: both facet fields on the layer", () => {
    const table = ColumnTable.fromColumns({
      g: ["a", "a", "b", "b", "a"],
      h: ["x", "y", "x", "y", "y"],
      v: [1, 2, 3, 4, 5],
    });
    const panels = [
      gridPanel({ field: "g", value: "a" }, { field: "h", value: "x" }),
      gridPanel({ field: "g", value: "a" }, { field: "h", value: "y" }),
      gridPanel({ field: "g", value: "b" }, { field: "h", value: "x" }),
      gridPanel({ field: "g", value: "b" }, { field: "h", value: "y" }),
      gridPanel({ field: "g", value: "c" }, { field: "h", value: "x" }), // empty combo
    ];
    expectMatchesOracle(inputFor(table, ["g", "h"], null), panels);
  });

  it("grid: layer carries only the row field, so it replicates across columns", () => {
    // The layer has no `h`, so every column panel of a given row gets the same
    // rows. This is the case a full-identity lookup key would break.
    const table = ColumnTable.fromColumns({ g: ["a", "b", "a"], v: [1, 2, 3] });
    const panels = [
      gridPanel({ field: "g", value: "a" }, { field: "h", value: "x" }),
      gridPanel({ field: "g", value: "a" }, { field: "h", value: "y" }),
      gridPanel({ field: "g", value: "b" }, { field: "h", value: "x" }),
    ];
    expectMatchesOracle(inputFor(table, ["g", "h"], null), panels);
  });

  it("grid: layer carries only the column field", () => {
    const table = ColumnTable.fromColumns({ h: ["x", "y", "x"], v: [1, 2, 3] });
    const panels = [
      gridPanel({ field: "g", value: "a" }, { field: "h", value: "x" }),
      gridPanel({ field: "g", value: "b" }, { field: "h", value: "x" }),
      gridPanel({ field: "g", value: "a" }, { field: "h", value: "y" }),
    ];
    expectMatchesOracle(inputFor(table, ["g", "h"], null), panels);
  });

  it("layer carries none of the facet fields, so the whole table replicates", () => {
    const table = ColumnTable.fromColumns({ v: [1, 2, 3] });
    expectMatchesOracle(inputFor(table, ["g"], null), [wrapPanel("g", "a"), wrapPanel("g", "b")]);
  });

  it("empty filtered table keeps the original table instance, not a subset", () => {
    const table = ColumnTable.fromColumns({ g: [], v: [] });
    expectMatchesOracle(inputFor(table, ["g"], null), [wrapPanel("g", "a")]);
  });

  it("filter remap feeds the global source rows", () => {
    // Filtered rows 0,1,2 came from unfiltered 2,5,7 of a 9-row source, so the
    // remap must survive as real global ids rather than collapsing to NO_ROW.
    const unfiltered = ColumnTable.fromColumns({
      g: ["x", "x", "a", "x", "x", "b", "x", "a", "x"],
      v: [0, 0, 1, 0, 0, 2, 0, 3, 0],
    });
    const table = ColumnTable.fromColumns({ g: ["a", "b", "a"], v: [1, 2, 3] });
    const input = inputFor(table, ["g"], [2, 5, 7], unfiltered);
    expectMatchesOracle(input, [wrapPanel("g", "a"), wrapPanel("g", "b")]);
    // Pin the actual ids: comparing against the oracle alone would pass even if
    // both sides collapsed every remapped row to NO_ROW.
    const slicer = createLayerPanelSlicer(input);
    expect([...slicer(wrapPanel("g", "a")).globalSourceRows]).toEqual([2, 7]);
    expect([...slicer(wrapPanel("g", "b")).globalSourceRows]).toEqual([5]);
  });

  it("distinguishes values that a naive key join would collide", () => {
    // encodeKey keeps "1" and 1 apart, and separator-bearing strings must not
    // merge across the two grid fields.
    const table = ColumnTable.fromColumns({
      g: ["a:b", "a", 1, "1", "a|b"],
      h: ["c", "b:c", "z", "z", "c"],
      v: [1, 2, 3, 4, 5],
    });
    const panels = [
      gridPanel({ field: "g", value: "a:b" }, { field: "h", value: "c" }),
      gridPanel({ field: "g", value: "a" }, { field: "h", value: "b:c" }),
      gridPanel({ field: "g", value: 1 }, { field: "h", value: "z" }),
      gridPanel({ field: "g", value: "1" }, { field: "h", value: "z" }),
      gridPanel({ field: "g", value: "a|b" }, { field: "h", value: "c" }),
    ];
    expectMatchesOracle(inputFor(table, ["g", "h"], null), panels);
  });

  it("unfaceted layouts share one whole-table slice", () => {
    const table = ColumnTable.fromColumns({ v: [1, 2, 3] });
    const registry = new SourceRegistry();
    const sourceId = registry.register(table);
    const input = {
      filteredTable: table,
      filteredToSource: null,
      sourceId,
      registry,
      facetFields: [],
      faceted: false,
    };
    expectMatchesOracle(input, [wrapPanel("g", "a")]);
  });
});

describe("createLayerPanelSlicer global source IDs", () => {
  it("keeps out-of-range entries when a contiguous range is incomplete", () => {
    const source = ColumnTable.fromColumns({ g: ["a", "a"] });
    const table = ColumnTable.fromColumns({ g: ["a", "a", "a"] });
    const slicer = createLayerPanelSlicer(inputFor(table, ["g"], null, source));
    expect(slicer(wrapPanel("g", "a")).globalSourceRows).toEqual([0, 1, NO_ROW]);
  });
});

describe("createLayerPanelSlicer invariant tripwires", () => {
  // Neither state is reachable through the pipeline: assertFacetForm rejects
  // wrap mixed with grid, and every panel identity carries every declared
  // facet field. Both fail loudly so a future layout change cannot quietly
  // mis-slice instead.
  it("rejects a layer partitioning on more facet fields than a form allows", () => {
    const table = ColumnTable.fromColumns({ g: ["a"], h: ["b"], k: ["c"] });
    expect(() => createLayerPanelSlicer(inputFor(table, ["g", "h", "k"], null))).toThrow(
      /partitions on 3 facet fields/,
    );
  });

  it("rejects a panel identity missing a field its layer partitions on", () => {
    const table = ColumnTable.fromColumns({ g: ["a", "b"], v: [1, 2] });
    const slicer = createLayerPanelSlicer(inputFor(table, ["g"], null));
    // A panel that names a different field than the layer partitions on.
    expect(() => slicer(wrapPanel("other", "a"))).toThrow(/missing the facet field "g"/);
  });
});

describe("createLayerPanelSlicer cost", () => {
  it("visits the rows once for the layer, not once per panel", () => {
    // 40 facet values x 200 rows. The old scan read 200 cells per panel (8000);
    // one grouping pass reads 200.
    const P = 40;
    const N = 200;
    const g = Array.from({ length: N }, (_, i) => `g${i % P}`);
    // fromColumns keeps the array reference, so element reads are countable.
    let reads = 0;
    const counted = new Proxy(g, {
      get(target, prop) {
        if (typeof prop === "string" && /^\d+$/.test(prop)) reads += 1;
        return Reflect.get(target, prop) as unknown;
      },
    });
    const table = ColumnTable.fromColumns({ g: counted, v: g.map((_, i) => i) });
    const registry = new SourceRegistry();
    const sourceId = registry.register(table);

    const slicer = createLayerPanelSlicer({
      filteredTable: table,
      filteredToSource: null,
      sourceId,
      registry,
      facetFields: ["g"],
      faceted: true,
    });
    let total = 0;
    for (let p = 0; p < P; p++) total += slicer(wrapPanel("g", `g${p}`)).globalSourceRows.length;
    expect(total).toBe(N);
    expect(reads).toBeGreaterThan(0);
    // One pass over the facet column is N. The per-panel scan was P*N = 8000.
    expect(reads).toBeLessThan(3 * N);
  });

  it("builds the shared source-row array once on the replicate path", () => {
    // A layer carrying no facet field replicates into every panel. That path
    // reads no facet column, so the guard above cannot see it: count the
    // registry lookups instead, which is what used to be rebuilt per panel.
    const P = 40;
    const N = 200;
    const table = ColumnTable.fromColumns({ v: Array.from({ length: N }, (_, i) => i) });
    const registry = new SourceRegistry();
    registry.register(ColumnTable.fromColumns({ v: [-2, -1] }));
    const sourceId = registry.register(table);
    let toGlobalCalls = 0;
    const realToGlobal = registry.toGlobal.bind(registry);
    registry.toGlobal = (id: number, row: number): number => {
      toGlobalCalls += 1;
      return realToGlobal(id, row);
    };

    const slicer = createLayerPanelSlicer({
      filteredTable: table,
      filteredToSource: null,
      sourceId,
      registry,
      facetFields: ["g"],
      faceted: true,
    });
    const slices = Array.from({ length: P }, (_, p) => slicer(wrapPanel("g", `g${p}`)));
    for (const slice of slices) expect(slice.globalSourceRows).toHaveLength(N);
    // Every panel takes the whole table, so one array serves them all.
    expect(slices.every((s) => s.globalSourceRows === slices[0]!.globalSourceRows)).toBe(true);
    expect(slices[0]?.globalSourceRows).toEqual(Array.from({ length: N }, (_, index) => index + 2));
    expect(toGlobalCalls).toBe(1);
  });
});
