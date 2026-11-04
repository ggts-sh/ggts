import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { installTemporal } from "../src/install-temporal.ts";
import { ColumnTable } from "../src/table.ts";
import type { CellValue } from "../src/table-types.ts";
import { getTemporalRuntime, resetTemporalRuntimeForTests } from "../src/temporal-runtime.ts";

/**
 * Full build vs lean build parity for nominal `auto` columns (#1863). The full
 * runtime only materializes semantic/valid for temporal columns; the table must
 * classify nominal columns the same way the lean parser does instead of
 * re-coercing every cell through cellsToNumeric.
 */
// Decision status is parser semantics (the full runtime reports `invalid` for
// unparseable Date columns where the lean parser reports `nominal`); the
// materialized view and the field type must agree exactly.
type Snapshot = {
  fieldType: string;
  semantic: number[];
  valid: number[];
};

describe("nominal auto columns (full runtime)", () => {
  beforeAll(() => {
    installTemporal();
    expect(getTemporalRuntime()).not.toBeNull();
  });
  afterAll(() => {
    installTemporal();
  });

  it("classifies label strings as nominal with an all-invalid semantic view", () => {
    const labels: string[] = Array.from({ length: 1000 }, (_, index) => `series-${index % 5}`);
    const table = ColumnTable.fromColumns({ v: labels });
    const view = table.parsed("v");
    expect(view.decision.status).toBe("nominal");
    expect(table.fieldType("v")).toBe("nominal");
    expect(view.valid.some((flag) => flag !== 0)).toBe(false);
    expect(view.semantic.every((value) => Number.isNaN(value))).toBe(true);
  });

  it("classifies number columns as quantitative without touching raw values", () => {
    const table = ColumnTable.fromColumns({ v: [1, 2, null, 4.5, Number.NaN] });
    const view = table.parsed("v");
    expect(table.fieldType("v")).toBe("quantitative");
    expect(Array.from(view.semantic.slice(0, 2))).toEqual([1, 2]);
    expect(Number.isNaN(view.semantic[2]!)).toBe(true);
    expect(view.semantic[3]).toBe(4.5);
    expect(Array.from(view.valid)).toEqual([1, 1, 0, 1, 0]);
  });

  it("keeps empty and null-only columns quantitative", () => {
    // Both shapes leave the number and label flags set; the number branch wins,
    // matching the lean build's `lite:numbers` classification.
    for (const column of [[], [null, null]] as CellValue[][]) {
      const table = ColumnTable.fromColumns({ v: column });
      expect(table.parsed("v").decision.status).toBe("nominal");
      expect(table.fieldType("v")).toBe("quantitative");
    }
  });

  it("keeps strict quantitative coercion for inferTemporal: false", () => {
    const table = ColumnTable.fromColumns({ v: ["10", 5, null] });
    const view = table.parsed("v", "auto", { inferTemporal: false });
    expect(Array.from(view.semantic.slice(0, 2))).toEqual([10, 5]);
    expect(table.fieldType("v", "auto", { inferTemporal: false })).toBe("quantitative");

    const labeled = ColumnTable.fromColumns({ v: ["s0", "s1"] });
    expect(labeled.fieldType("v", "auto", { inferTemporal: false })).toBe("nominal");
  });
});

describe("nominal auto parity with the lean build", () => {
  const columns: Record<string, CellValue[]> = {
    labels: ["s0", "s1", "s2"],
    "infinity-shaped label": ["Infinity", "Infinity"],
    numbers: [1, 2, null, 4.5, Number.NaN],
    "numeric text": ["10", "20", null],
    "iso mixed with numbers": ["2024-01-01", 5, "2024-01-03"],
    "label mixed with number": ["a", 1, "b"],
    booleans: [true, false, null],
    "all null": [null, null],
    empty: [],
    "invalid dates": [new Date(Number.NaN), new Date(Number.NaN)],
  };

  function snapshot(column: CellValue[]): Snapshot {
    const table = ColumnTable.fromColumns({ v: column });
    const view = table.parsed("v");
    return {
      fieldType: table.fieldType("v"),
      semantic: Array.from(view.semantic),
      valid: Array.from(view.valid),
    };
  }

  beforeAll(() => {
    installTemporal();
  });
  afterAll(() => {
    installTemporal();
  });

  for (const [name, column] of Object.entries(columns)) {
    it(`matches the lean build for ${name}`, () => {
      installTemporal();
      const full = snapshot(column);
      resetTemporalRuntimeForTests();
      expect(getTemporalRuntime()).toBeNull();
      const lean = snapshot(column);
      installTemporal();
      expect(full).toEqual(lean);
    });
  }
});
