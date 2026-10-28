/**
 * Facet field config: closed levels, display labels, strip position/show
 * (issue #590). Spec seam only — PortableSpec schema, normalize, validate.
 */
import { describe, expect, it } from "bun:test";

import { normalize } from "../src/normalize.ts";
import { validate } from "../src/validate.ts";

const base = {
  data: {
    values: [
      { x: 1, y: 2, g: "b" },
      { x: 2, y: 3, g: "a" },
      { x: 3, y: 4, g: "c" },
    ],
  },
  layers: [{ geom: "point" as const, aes: { x: { field: "x" }, y: { field: "y" } } }],
};

describe("facet field config — PortableSpec seam (#590)", () => {
  it("normalizes bare-string wrap and preserves defaults (no levels/labels/strip)", () => {
    const spec = normalize({
      ...base,
      facet: { wrap: "g", ncol: 2 },
    });
    expect(spec.facet).toEqual({ wrap: { field: "g" }, ncol: 2 });
    expect(validate(spec).ok).toBe(true);
  });

  it("normalizes closed levels and display-label map on wrap", () => {
    const spec = normalize({
      ...base,
      facet: {
        wrap: {
          field: "g",
          levels: ["c", "a", "b"],
          labels: { c: "Charlie", a: "Alpha", b: "Bravo" },
        },
      },
    });
    expect(spec.facet).toEqual({
      wrap: {
        field: "g",
        levels: ["c", "a", "b"],
        labels: { c: "Charlie", a: "Alpha", b: "Bravo" },
      },
    });
    expect(validate(spec).ok).toBe(true);
  });

  it("normalizes strip position and show on the facet", () => {
    const spec = normalize({
      ...base,
      facet: {
        wrap: { field: "g" },
        strip: { position: "left", show: false },
      },
    });
    expect(spec.facet).toEqual({
      wrap: { field: "g" },
      strip: { position: "left", show: false },
    });
    expect(validate(spec).ok).toBe(true);
  });

  it("normalizes levels/labels on grid rows and cols independently", () => {
    const spec = normalize({
      ...base,
      facet: {
        rows: { field: "r", levels: ["south", "north"], labels: { south: "S", north: "N" } },
        cols: { field: "c", levels: ["east", "west"] },
        strip: { position: "right" },
      },
    });
    expect(spec.facet).toEqual({
      rows: { field: "r", levels: ["south", "north"], labels: { south: "S", north: "N" } },
      cols: { field: "c", levels: ["east", "west"] },
      strip: { position: "right" },
    });
    expect(validate(spec).ok).toBe(true);
  });

  it("rejects unknown strip position at tier 1", () => {
    const result = validate({
      ...base,
      facet: { wrap: { field: "g" }, strip: { position: "diagonal" } },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path.includes("/facet/strip"))).toBe(true);
  });

  it("rejects levels that are not an array of domain values", () => {
    const result = validate({
      ...base,
      facet: { wrap: { field: "g", levels: "a,b,c" } },
    });
    expect(result.ok).toBe(false);
  });

  it("normalizes and accepts facet_grid space on the grid form (#1825)", () => {
    for (const space of ["fixed", "free", "free_x", "free_y"] as const) {
      const spec = normalize({ ...base, facet: { cols: "g", scales: "free_x", space } });
      expect(spec.facet).toEqual({ cols: { field: "g" }, scales: "free_x", space });
      expect(validate(spec).ok).toBe(true);
    }
  });

  it("rejects an unknown space value at tier 1", () => {
    const result = validate({ ...base, facet: { cols: { field: "g" }, space: "wide" } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === "/facet/space")).toBe(true);
  });

  it("rejects space on the wrap form with facet-space-without-grid", () => {
    const result = validate({ ...base, facet: { wrap: { field: "g" }, space: "free_x" } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => [e.code, e.path])).toEqual([
      ["facet-space-without-grid", "/facet/space"],
    ]);
  });

  it("is idempotent with full facet field config", () => {
    const once = normalize({
      ...base,
      facet: {
        wrap: {
          field: "g",
          levels: ["c", "a"],
          labels: { c: "Charlie", a: "Alpha" },
        },
        strip: { position: "bottom", show: true },
      },
    });
    expect(normalize(once)).toEqual(once);
  });
});
