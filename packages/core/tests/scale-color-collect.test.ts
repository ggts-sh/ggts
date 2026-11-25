/**
 * Color channel value collection for scale training.
 */
import { describe, expect, it } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";

import { ColumnTable } from "../src/table.ts";

describe("collectColorChannelValues", () => {
  it("returns empty when no color mapping is present", async () => {
    const { collectColorChannelValues } = await import("../src/pipeline/scale-color-collect.ts");
    const table = fromAny({ has: () => false, discreteness: () => "continuous" });
    const frames = fromAny([
      {
        binding: {
          color: { field: null, scaledConstant: null },
          fill: { field: null, scaledConstant: null },
        },
        colorValues: null,
        fillValues: null,
      },
    ]);
    expect(collectColorChannelValues("color", frames, table)).toEqual({
      values: [],
      anyDiscreteField: false,
      anyField: false,
    });
  });
});

describe("collectColorChannelFlags + countNullColorChannelValues", () => {
  it("flags mapping without materializing per-row values", async () => {
    const { collectColorChannelFlags, countNullColorChannelValues } =
      await import("../src/pipeline/scale-color-collect.ts");
    const table = ColumnTable.fromColumns({
      series: ["a", "b", null, "a"],
    });
    const frames = fromAny([
      {
        binding: {
          color: { field: "series", scaledConstant: null, statColumn: null },
          fill: { field: null, scaledConstant: null, statColumn: null },
        },
        colorValues: table.column("series"),
        fillValues: null,
      },
    ]);
    expect(collectColorChannelFlags("color", frames, table)).toEqual({
      anyDiscreteField: true,
      anyField: true,
    });
    expect(countNullColorChannelValues("color", frames)).toBe(1);
  });
});

describe("collectColorCatalogValues metadata", () => {
  it("keeps source-field flags without reading catalog rows", async () => {
    const { collectColorCatalogValues } = await import("../src/pipeline/scale-color-collect.ts");
    let columnReads = 0;
    const table = fromAny({
      has: () => true,
      discreteness: () => "discrete",
      column() {
        columnReads++;
        return ["first", "second"];
      },
    });
    const bindings = fromAny([
      {
        color: { field: "series", scaledConstant: null },
        sourceTable: table,
      },
    ]);

    expect(collectColorCatalogValues("color", bindings, table, false)).toEqual({
      catalogValues: [],
      anyDiscreteField: true,
      anyField: true,
    });
    expect(columnReads).toBe(0);
  });
});

describe("collectColorCatalogValues string monomorph path", () => {
  it("keeps first-seen order for series labels", async () => {
    const { collectColorCatalogValues } = await import("../src/pipeline/scale-color-collect.ts");
    const table = ColumnTable.fromColumns({
      series: [
        ...Array.from({ length: 64 }, () => "s0"),
        ...Array.from({ length: 64 }, () => "s1"),
        ...Array.from({ length: 64 }, () => "s0"),
        ...Array.from({ length: 64 }, () => "s2"),
      ],
    });
    const bindings = fromAny([
      {
        color: { field: "series", scaledConstant: null },
        fill: { field: null, scaledConstant: null },
        sourceTable: table,
      },
    ]);
    const catalog = collectColorCatalogValues("color", bindings, table);
    expect(catalog.catalogValues).toEqual(["s0", "s1", "s2"]);
    expect(catalog.anyDiscreteField).toBe(true);
    expect(catalog.anyField).toBe(true);
  });

  it("preserves adjacent signed zero catalog keys", async () => {
    const { collectColorCatalogValues } = await import("../src/pipeline/scale-color-collect.ts");
    const table = ColumnTable.fromColumns({
      series: [0, -0, Number.NaN, Number.NaN],
    });
    const bindings = fromAny([
      {
        color: { field: "series", scaledConstant: null },
        fill: { field: null, scaledConstant: null },
        sourceTable: table,
      },
    ]);
    const catalog = collectColorCatalogValues("color", bindings, table);
    expect(catalog.catalogValues).toEqual([0, -0, Number.NaN]);
  });

  it("keeps the baseline path for a misleading duplicate prefix", async () => {
    const { collectColorCatalogValues } = await import("../src/pipeline/scale-color-collect.ts");
    const table = ColumnTable.fromColumns({
      series: ["s0", "s0", ...Array.from({ length: 62 }, (_, index) => `s${index % 3}`)],
    });
    const bindings = fromAny([
      {
        color: { field: "series", scaledConstant: null },
        fill: { field: null, scaledConstant: null },
        sourceTable: table,
      },
    ]);
    expect(collectColorCatalogValues("color", bindings, table).catalogValues).toEqual([
      "s0",
      "s1",
      "s2",
    ]);
  });

  it("keeps canonical keys for mixed values inside dense string runs", async () => {
    const { collectColorCatalogValues } = await import("../src/pipeline/scale-color-collect.ts");
    const instant = new Date("2024-01-01T00:00:00.000Z");
    const table = ColumnTable.fromColumns({
      series: [
        ...Array.from({ length: 64 }, () => "@series"),
        0,
        -0,
        Number.NaN,
        Number.NaN,
        instant,
        new Date(instant),
        ...Array.from({ length: 64 }, () => "s1"),
        ...Array.from({ length: 64 }, () => "@series"),
      ],
    });
    const bindings = fromAny([
      {
        color: { field: "series", scaledConstant: null },
        fill: { field: null, scaledConstant: null },
        sourceTable: table,
      },
    ]);
    expect(collectColorCatalogValues("color", bindings, table).catalogValues).toEqual([
      "@series",
      0,
      -0,
      Number.NaN,
      instant,
      "s1",
    ]);
  });
});
