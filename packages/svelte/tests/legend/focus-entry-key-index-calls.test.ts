import { describe, expect, it } from "vitest";

import type { SceneLegend } from "@ggts-sh/core";

import {
  buildLegendEntryKeyIndex,
  type LegendKeyIndexAdapter,
} from "../../src/lib/legend/entry-key-index.js";
import { adapter } from "./focus-entry-key-index-fixtures.js";
import { discreteFill } from "./focus-fixtures.js";

describe("buildLegendEntryKeyIndex", () => {
  it("calls layerFields once per distinct layer and lineageKeys once per unique lineage", () => {
    let layerFieldsCalls = 0;
    let lineageKeysCalls = 0;
    const dualLegend: SceneLegend = {
      type: "discrete",
      scale: "color",
      title: "C",
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      swatchSize: 12,
      entries: [{ label: "x", value: "x", color: "#000" }],
    };
    const clean: LegendKeyIndexAdapter = {
      legends: [discreteFill, dualLegend],
      candidates: () => [
        { layerIndex: 0, lineage: 1, rowIndex: null },
        { layerIndex: 0, lineage: 2, rowIndex: null },
        { layerIndex: 1, lineage: 3, rowIndex: null },
      ],
      layerFields() {
        layerFieldsCalls += 1;
        return [{ channel: "fill", field: "channel" }];
      },
      layerScaledConstant: (_layerIndex, channel) => (channel === "color" ? "x" : undefined),
      lineageKeys(lineageId) {
        lineageKeysCalls += 1;
        return lineageId === 1 ? [0] : lineageId === 2 ? [1] : [2];
      },
      row: (rowIndex) => (rowIndex === 2 ? { channel: "store" } : { channel: "web" }),
      semanticKey: (rowIndex) => (rowIndex === 0 ? "a" : rowIndex === 1 ? "b" : "c"),
    };
    const index = buildLegendEntryKeyIndex(clean);
    expect(index.get("fill:0")).toEqual(["a", "b"]);
    expect(index.get("color:0")).toEqual(["a", "b", "c"]);
    // One layerFields call per distinct layerIndex (0 and 1), not per candidate×legend.
    expect(layerFieldsCalls).toBe(2);
    // One lineageKeys call per unique lineage id (1, 2, 3).
    expect(lineageKeysCalls).toBe(3);
  });

  it("expands a shared lineage once across many candidates (smooth eval grid)", () => {
    let lineageKeysCalls = 0;
    let rowCalls = 0;
    let semanticKeyCalls = 0;
    const sharedRows = Array.from({ length: 40 }, (_, i) => i);
    const index = buildLegendEntryKeyIndex({
      legends: [discreteFill],
      candidates: () =>
        Array.from({ length: 12 }, () => ({ layerIndex: 0, lineage: 7, rowIndex: null })),
      layerFields: () => [{ channel: "fill", field: "channel" }],
      lineageKeys(lineageId) {
        lineageKeysCalls += 1;
        return lineageId === 7 ? sharedRows : [];
      },
      row: (rowIndex) => {
        rowCalls += 1;
        return { channel: rowIndex % 2 === 0 ? "web" : "store" };
      },
      semanticKey: (rowIndex) => {
        semanticKeyCalls += 1;
        return `k${String(rowIndex)}`;
      },
    });
    expect(lineageKeysCalls).toBe(1);
    // Lineage-level visit (#1329): one expand for the shared bag, not N×R
    // probes across the 12 smooth eval-grid candidates.
    expect(rowCalls).toBe(40);
    expect(semanticKeyCalls).toBe(40);
    expect(index.get("fill:0")?.length).toBe(20);
    expect(index.get("fill:1")?.length).toBe(20);
  });

  it("appends a candidate-local row after a lineage already expanded by peers", () => {
    // First candidates share lineage 1 (rows 0,1); a later identity candidate
    // adds rowIndex 9 not in the lineage bag — must still index that row once.
    const index = buildLegendEntryKeyIndex(
      adapter({
        candidates: [
          { layerIndex: 0, lineage: 1, rowIndex: null },
          { layerIndex: 0, lineage: 1, rowIndex: null },
          { layerIndex: 0, lineage: 1, rowIndex: 9 },
        ],
        fields: { 0: [{ channel: "fill", field: "channel" }] },
        lineages: { 1: [0, 1] },
        rows: {
          0: { channel: "web" },
          1: { channel: "store" },
          9: { channel: "web" },
        },
        keys: { 0: "a", 1: "b", 9: "extra" },
      }),
    );
    expect(index.get("fill:0")).toEqual(["a", "extra"]);
    expect(index.get("fill:1")).toEqual(["b"]);
  });

  it("does not call lineageKeys when no discrete legend applies to the candidate", () => {
    let lineageKeysCalls = 0;
    const index = buildLegendEntryKeyIndex({
      legends: [discreteFill],
      candidates: () => [{ layerIndex: 0, lineage: 99, rowIndex: null }],
      layerFields: () => [{ channel: "color", field: "other" }], // fill legend only
      lineageKeys: () => {
        lineageKeysCalls += 1;
        return [0];
      },
      row: () => ({ other: "x" }),
      semanticKey: () => "k",
    });
    expect(index.get("fill:0")).toEqual([]);
    expect(lineageKeysCalls).toBe(0);
  });
});
