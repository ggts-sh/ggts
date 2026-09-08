/**
 * Docs-local known-name lists must match @ggts-sh/spec (ReferenceLede links).
 */
import { describe, expect, it } from "bun:test";
import { KNOWN_GEOMS as SpecGeoms, KNOWN_STATS as SpecStats } from "@ggts-sh/spec";

import {
  KNOWN_GEOMS as DocsGeoms,
  KNOWN_STATS as DocsStats,
} from "../apps/docs/src/lib/catalog/known-names.ts";

describe("docs known-names parity", () => {
  it("matches package KNOWN_GEOMS and KNOWN_STATS", () => {
    expect([...DocsGeoms]).toEqual([...SpecGeoms]);
    expect([...DocsStats]).toEqual([...SpecStats]);
  });
});
