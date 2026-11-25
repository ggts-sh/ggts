/**
 * resolveColorScale characterization.
 */
import { describe, expect, it, spyOn } from "bun:test";

import { resolveColorScale } from "../../src/pipeline/scale-color.ts";
import { EDITION_DEFAULTS } from "../../src/editions.ts";
import { ColumnTable } from "../../src/table.ts";
import type { Advisory, PipelineWarning } from "../../src/pipeline/types.ts";
import { pointFrame } from "./fixtures.ts";

describe("resolveColorScale", () => {
  it("returns null resolution when no color/fill mapping exists", () => {
    const table = ColumnTable.fromRows([
      { x: 1, y: 10 },
      { x: 2, y: 20 },
    ]);
    const warnings: PipelineWarning[] = [];
    const advisories: Advisory[] = [];
    const result = resolveColorScale(
      "color",
      [pointFrame(table)],
      [],
      table,
      table,
      undefined,
      null,
      "color",
      warnings,
      advisories,
      EDITION_DEFAULTS[2] ?? EDITION_DEFAULTS[1]!,
    );
    expect(result.resolved).toBeNull();
    expect(result.legendInput).toBeNull();
  });

  it("trains an ordinal color scale for discrete fields", () => {
    const table = ColumnTable.fromRows([
      { x: 1, y: 10, g: "a" },
      { x: 2, y: 20, g: "b" },
    ]);
    const frame = pointFrame(table);
    frame.binding.color.field = "g";
    frame.colorValues = table.column("g");
    const warnings: PipelineWarning[] = [];
    const advisories: Advisory[] = [];
    const edition = Object.values(EDITION_DEFAULTS)[0]!;
    const result = resolveColorScale(
      "color",
      [frame],
      [],
      table,
      table,
      undefined,
      null,
      "g",
      warnings,
      advisories,
      edition,
    );
    expect(result.resolved?.kind).toBe("ordinal");
    expect(result.legendInput?.kind).toBe("discrete");
    expect(advisories.some((a) => a.code === "palette-inferred")).toBe(true);
  });

  it("trains sequential color without reading the unfiltered catalog", () => {
    const table = ColumnTable.fromRows([
      { x: 1, y: 10, z: 0.1 },
      { x: 2, y: 20, z: 0.9 },
    ]);
    const source = ColumnTable.fromColumns({ z: [0.1, 0.9, 3.5] });
    source.discreteness("z");
    const sourceColumn = spyOn(source, "column");
    const frame = pointFrame(table);
    frame.binding.color.field = "z";
    frame.colorValues = table.column("z");
    const warnings: PipelineWarning[] = [];
    const advisories: Advisory[] = [];
    const edition = Object.values(EDITION_DEFAULTS)[0]!;
    const result = resolveColorScale(
      "color",
      [frame],
      [frame.binding],
      table,
      source,
      undefined,
      null,
      "z",
      warnings,
      advisories,
      edition,
    );
    expect(result.resolved?.kind).toBe("sequential");
    expect(result.legendInput?.kind).toBe("ramp");
    expect(result.state).toBeNull();
    expect(advisories.some((a) => a.code === "palette-inferred")).toBe(true);
    expect(sourceColumn).not.toHaveBeenCalled();
  });

  it("recovers inferred ordinal color from one source walk when no frames remain", () => {
    const table = ColumnTable.fromRows([{ x: 1, y: 10, z: "second" }]);
    const source = ColumnTable.fromColumns({ z: ["second", "first", "second", "third"] });
    source.discreteness("z");
    const sourceColumn = spyOn(source, "column");
    const { binding } = pointFrame(table);
    binding.color.field = "z";

    const result = resolveColorScale(
      "color",
      [],
      [binding],
      table,
      source,
      undefined,
      null,
      "z",
      [],
      [],
      Object.values(EDITION_DEFAULTS)[0]!,
    );

    const legend = result.legendInput;
    if (legend?.kind !== "discrete") throw new Error("expected an ordinal color legend");
    expect(legend.domain).toEqual(["second", "first", "third"]);
    expect(sourceColumn).toHaveBeenCalledTimes(1);
  });

  it("honors explicit ordinal type over continuous field inference", () => {
    const table = ColumnTable.fromRows([
      { x: 1, y: 10, z: 1 },
      { x: 2, y: 20, z: 2 },
    ]);
    const frame = pointFrame(table);
    frame.binding.color.field = "z";
    frame.colorValues = table.column("z");
    const edition = Object.values(EDITION_DEFAULTS)[0]!;
    const result = resolveColorScale(
      "color",
      [frame],
      [],
      table,
      table,
      { type: "ordinal" },
      null,
      "z",
      [],
      [],
      edition,
    );
    expect(result.resolved?.kind).toBe("ordinal");
    expect(result.legendInput?.kind).toBe("discrete");
  });
});
