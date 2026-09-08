import { describe, expect, it } from "vitest";

import type { SceneLegend } from "@ggts-sh/core";

import { buildLegendEntryKeyIndex } from "../../src/lib/legend/entry-key-index.js";
import { adapter } from "./focus-entry-key-index-fixtures.js";
import { discreteFill } from "./focus-fixtures.js";

describe("buildLegendEntryKeyIndex", () => {
  it("prefers the first legend entry when values share a legend value token", () => {
    // 0 and -0 share a token; findIndex / token lookup must
    // both resolve to the earliest entry (index 0), not the later -0 swatch.
    const dualZero: SceneLegend = {
      type: "discrete",
      scale: "fill",
      title: "Zero",
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      swatchSize: 12,
      entries: [
        { value: 0, label: "pos", color: "#0", y: 0 },
        { value: -0, label: "neg", color: "#1", y: 12 },
      ],
    };
    const index = buildLegendEntryKeyIndex(
      adapter({
        legends: [dualZero],
        candidates: [{ layerIndex: 0, lineage: 1, rowIndex: null }],
        fields: { 0: [{ channel: "fill", field: "v" }] },
        lineages: { 1: [0, 1] },
        rows: { 0: { v: -0 }, 1: { v: 0 } },
        keys: { 0: "neg-row", 1: "pos-row" },
      }),
    );
    expect(index.get("fill:0")).toEqual(["neg-row", "pos-row"]);
    expect(index.get("fill:1")).toEqual([]);
  });

  // Entry matching uses a pre-built value→index Map (O(E) prep + O(1) lookup)
  // rather than findIndex over entries inside the candidate/row walk. That is a
  // structural property of the implementation; perf-regression coverage lives
  // in the bench-smoke job, not a wall-clock unit assertion (which flakes under
  // CI contention). Behavioral coverage at scale is retained here.
  it("indexes many discrete entries across many rows in first-seen order", () => {
    const entryCount = 200;
    const rowsPerEntry = 5;
    const entries = Array.from({ length: entryCount }, (_, i) => ({
      value: `cat-${i}`,
      label: `C${i}`,
      color: "#000",
      y: i * 12,
    }));
    const multi: SceneLegend = {
      type: "discrete",
      scale: "fill",
      title: "Many",
      x: 0,
      y: 0,
      width: 40,
      height: entryCount * 12,
      swatchSize: 12,
      entries,
    };
    const rowCount = entryCount * rowsPerEntry;
    const rows: Record<number, Record<string, unknown>> = {};
    const keys: Record<number, PropertyKey> = {};
    const lineage: number[] = [];
    for (let i = 0; i < rowCount; i++) {
      const entryIndex = i % entryCount;
      rows[i] = { channel: `cat-${entryIndex}` };
      keys[i] = `k-${i}`;
      lineage.push(i);
    }
    const index = buildLegendEntryKeyIndex(
      adapter({
        legends: [multi],
        candidates: [{ layerIndex: 0, lineage: 1, rowIndex: null }],
        fields: { 0: [{ channel: "fill", field: "channel" }] },
        lineages: { 1: lineage },
        rows,
        keys,
      }),
    );
    expect(index.size).toBe(entryCount);
    // First entry collects every rowsPerEntry-th key starting at 0
    expect(index.get("fill:0")).toEqual(
      Array.from({ length: rowsPerEntry }, (_, r) => `k-${r * entryCount}`),
    );
    expect(index.get(`fill:${entryCount - 1}`)).toEqual(
      Array.from({ length: rowsPerEntry }, (_, r) => `k-${r * entryCount + (entryCount - 1)}`),
    );
    // Unmatched empty buckets still pre-seeded (every entry present)
    for (let i = 0; i < entryCount; i++) {
      expect(index.get(`fill:${i}`)).toHaveLength(rowsPerEntry);
    }
  });

  it("indexes first non-stat field per channel (skips leading stat, first non-stat wins)", () => {
    const index = buildLegendEntryKeyIndex(
      adapter({
        candidates: [{ layerIndex: 0, lineage: 1, rowIndex: null }],
        fields: {
          0: [
            { channel: "fill", field: "stat_fill", source: "stat" },
            { channel: "fill", field: "real_fill" },
            { channel: "fill", field: "second_fill" },
          ],
        },
        lineages: { 1: [0] },
        rows: { 0: { real_fill: "web", second_fill: "store", stat_fill: "ignored" } },
        keys: { 0: "k" },
      }),
    );
    // First non-stat mapping for fill is real_fill → "web" → entry 0.
    expect(index.get("fill:0")).toEqual(["k"]);
    expect(index.get("fill:1")).toEqual([]);
  });

  it("maps one candidate across field and scaled-constant discrete legends", () => {
    const colorLegend: SceneLegend = {
      type: "discrete",
      scale: "color",
      title: "Color",
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      swatchSize: 12,
      entries: [
        { label: "red", value: "red", color: "#f00" },
        { label: "blue", value: "blue", color: "#00f" },
      ],
    };
    const index = buildLegendEntryKeyIndex(
      adapter({
        legends: [discreteFill, colorLegend],
        candidates: [{ layerIndex: 0, lineage: 1, rowIndex: null }],
        fields: { 0: [{ channel: "fill", field: "channel" }] },
        scaledConstants: { 0: { color: "blue" } },
        lineages: { 1: [0, 1] },
        rows: {
          0: { channel: "web" },
          1: { channel: "store" },
        },
        keys: { 0: "a", 1: "b" },
      }),
    );
    expect(index.get("fill:0")).toEqual(["a"]);
    expect(index.get("fill:1")).toEqual(["b"]);
    // Scaled-constant color maps every lineage row to the same entry.
    expect(index.get("color:1")).toEqual(["a", "b"]);
    expect(index.get("color:0")).toEqual([]);
  });
});
