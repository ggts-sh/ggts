/**
 * Pipeline tables keyed by the spec's closed name sets (#1042).
 *
 * The types make a missing row a compile error; these tests catch the other
 * direction — a row for a name the catalog no longer has, which `tsc` would
 * flag but a stale build would not.
 */
import { describe, expect, it } from "bun:test";
import { ALIAS_GEOMS, KNOWN_GEOMS, KNOWN_STATS } from "@ggts-sh/spec";

import { PATH_LIKE_GEOMS } from "../src/pipeline/assemble-geometry-batches.ts";
import { STAT_COLOR_COLUMNS, STAT_Y_COLUMNS } from "../src/pipeline/bind-layer-stat-columns.ts";

const normalizedGeoms = KNOWN_GEOMS.filter((geom) => !ALIAS_GEOMS.includes(geom));

describe("pipeline tables keyed by spec catalogs (#1042)", () => {
  it("PATH_LIKE_GEOMS has one row per geom that reaches the pipeline", () => {
    expect(new Set(Object.keys(PATH_LIKE_GEOMS))).toEqual(new Set(normalizedGeoms));
  });

  it("PATH_LIKE_GEOMS names no alias geom", () => {
    for (const alias of ALIAS_GEOMS) expect(Object.keys(PATH_LIKE_GEOMS)).not.toContain(alias);
  });

  it("STAT_Y_COLUMNS is total over the known stats", () => {
    expect(new Set(Object.keys(STAT_Y_COLUMNS))).toEqual(new Set(KNOWN_STATS));
  });

  it("STAT_COLOR_COLUMNS is opt-in, so its rows are a subset of the known stats", () => {
    for (const stat of Object.keys(STAT_COLOR_COLUMNS)) expect(KNOWN_STATS).toContain(stat);
  });
});
