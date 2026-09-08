import { describe, expect, it } from "vitest";

import type { SceneLegend } from "@ggts-sh/core";

import { buildLegendEntryKeyIndex } from "../../src/lib/legend/entry-key-index.js";
import { adapter } from "./focus-entry-key-index-fixtures.js";
import { discreteFill, ramp } from "./focus-fixtures.js";

describe("buildLegendEntryKeyIndex", () => {
  it("pre-seeds empty buckets for discrete entries and ignores ramps", () => {
    const index = buildLegendEntryKeyIndex(
      adapter({ legends: [discreteFill, ramp], candidates: [] }),
    );
    expect([...index.keys()]).toEqual(["fill:0", "fill:1"]);
    expect(index.get("fill:0")).toEqual([]);
    expect(index.get("fill:1")).toEqual([]);
  });

  it("indexes every aesthetic represented by a semantically merged guide", () => {
    const merged = { ...discreteFill, aesthetics: ["fill", "shape"] as const };
    const index = buildLegendEntryKeyIndex(
      adapter({
        legends: [merged],
        candidates: [{ layerIndex: 0, lineage: 1, rowIndex: null }],
        fields: {
          0: [
            { channel: "fill", field: "fillGroup" },
            { channel: "shape", field: "shapeGroup" },
          ],
        },
        lineages: { 1: [0, 1] },
        rows: {
          0: { fillGroup: "web", shapeGroup: "web" },
          1: { fillGroup: "other", shapeGroup: "web" },
        },
        keys: { 0: "both", 1: "shape-only" },
      }),
    );
    expect(index.get("fill:0")).toEqual(["both", "shape-only"]);
  });

  it("maps encoded values to first-seen unique semantic keys in lineage order", () => {
    const index = buildLegendEntryKeyIndex(
      adapter({
        candidates: [{ layerIndex: 0, lineage: 1, rowIndex: null }],
        fields: { 0: [{ channel: "fill", field: "channel" }] },
        lineages: { 1: [2, 0, 2] },
        rows: {
          0: { channel: "web" },
          2: { channel: "web" },
        },
        keys: { 0: "c", 2: "a" },
      }),
    );
    // Set insertion from lineage: 2 then 0; first-seen unique keys preserve that order
    expect(index.get("fill:0")).toEqual(["a", "c"]);
    expect(index.get("fill:1")).toEqual([]);
  });

  it("appends candidate rowIndex after lineage rows when missing", () => {
    const index = buildLegendEntryKeyIndex(
      adapter({
        candidates: [{ layerIndex: 0, lineage: 1, rowIndex: 5 }],
        fields: { 0: [{ channel: "fill", field: "channel" }] },
        lineages: { 1: [0] },
        rows: {
          0: { channel: "web" },
          5: { channel: "web" },
        },
        keys: { 0: "first", 5: "appended" },
      }),
    );
    expect(index.get("fill:0")).toEqual(["first", "appended"]);
  });

  it("skips stat mappings, null rows, and null keys", () => {
    const index = buildLegendEntryKeyIndex(
      adapter({
        candidates: [
          { layerIndex: 0, lineage: 1, rowIndex: null },
          { layerIndex: 1, lineage: 2, rowIndex: null },
        ],
        fields: {
          0: [{ channel: "fill", field: "channel", source: "stat" }],
          1: [{ channel: "fill", field: "channel" }],
        },
        lineages: { 1: [0], 2: [1, 2, 3] },
        rows: {
          1: null,
          2: { channel: "web" },
          3: { channel: "web" },
        },
        keys: { 1: "x", 2: null, 3: "kept" },
      }),
    );
    expect(index.get("fill:0")).toEqual(["kept"]);
  });

  it("dedupes repeated candidates for the same scale/layer/field/row", () => {
    const index = buildLegendEntryKeyIndex(
      adapter({
        candidates: [
          { layerIndex: 0, lineage: 1, rowIndex: 0 },
          { layerIndex: 0, lineage: 1, rowIndex: 0 },
        ],
        fields: { 0: [{ channel: "fill", field: "channel" }] },
        lineages: { 1: [0] },
        rows: { 0: { channel: "store" } },
        keys: { 0: "b" },
      }),
    );
    expect(index.get("fill:1")).toEqual(["b"]);
    expect(index.get("fill:0")).toEqual([]);
  });

  it("matches Date, NaN, and -0 via legend value tokens and isolates scales", () => {
    const dateLegend: SceneLegend = {
      type: "discrete",
      scale: "color",
      title: "When",
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      swatchSize: 12,
      entries: [
        { value: new Date("2020-01-01T00:00:00.000Z"), label: "d", color: "#0", y: 0 },
        { value: Number.NaN, label: "nan", color: "#1", y: 12 },
        { value: 0, label: "zero", color: "#2", y: 24 },
      ],
    };
    const index = buildLegendEntryKeyIndex(
      adapter({
        legends: [discreteFill, dateLegend],
        candidates: [
          { layerIndex: 0, lineage: 1, rowIndex: null },
          { layerIndex: 1, lineage: 2, rowIndex: null },
        ],
        fields: {
          0: [{ channel: "fill", field: "channel" }],
          1: [{ channel: "color", field: "when" }],
        },
        lineages: { 1: [0], 2: [10, 11, 12] },
        rows: {
          0: { channel: "store" },
          10: { when: new Date("2020-01-01T00:00:00.000Z") },
          11: { when: Number.NaN },
          12: { when: -0 },
        },
        keys: { 0: "fill-store", 10: "date-k", 11: "nan-k", 12: "zero-k" },
      }),
    );
    expect(index.get("fill:1")).toEqual(["fill-store"]);
    expect(index.get("color:0")).toEqual(["date-k"]);
    expect(index.get("color:1")).toEqual(["nan-k"]);
    expect(index.get("color:2")).toEqual(["zero-k"]);
    // fill scale must not absorb color keys
    expect(index.get("fill:0")).toEqual([]);
  });

  it("leaves unmatched entry values empty", () => {
    const index = buildLegendEntryKeyIndex(
      adapter({
        candidates: [{ layerIndex: 0, lineage: 1, rowIndex: null }],
        fields: { 0: [{ channel: "fill", field: "channel" }] },
        lineages: { 1: [0] },
        rows: { 0: { channel: "unknown" } },
        keys: { 0: "orphan" },
      }),
    );
    expect(index.get("fill:0")).toEqual([]);
    expect(index.get("fill:1")).toEqual([]);
  });

  it("supports multi-layer membership on the same scale", () => {
    const index = buildLegendEntryKeyIndex(
      adapter({
        candidates: [
          { layerIndex: 0, lineage: 1, rowIndex: null },
          { layerIndex: 1, lineage: 2, rowIndex: null },
        ],
        fields: {
          0: [{ channel: "fill", field: "channel" }],
          1: [{ channel: "fill", field: "channel" }],
        },
        lineages: { 1: [0], 2: [1] },
        rows: {
          0: { channel: "web" },
          1: { channel: "web" },
        },
        keys: { 0: "layer0", 1: "layer1" },
      }),
    );
    expect(index.get("fill:0")).toEqual(["layer0", "layer1"]);
  });

  it("preserves Symbol semantic keys", () => {
    const sym = Symbol("row-a");
    const index = buildLegendEntryKeyIndex(
      adapter({
        candidates: [{ layerIndex: 0, lineage: 1, rowIndex: null }],
        fields: { 0: [{ channel: "fill", field: "channel" }] },
        lineages: { 1: [0] },
        rows: { 0: { channel: "web" } },
        keys: { 0: sym },
      }),
    );
    expect(index.get("fill:0")).toEqual([sym]);
  });

  it("maps scaled-constant layers onto the matching legend entry", () => {
    const index = buildLegendEntryKeyIndex(
      adapter({
        candidates: [
          { layerIndex: 0, lineage: 1, rowIndex: null },
          { layerIndex: 0, lineage: 2, rowIndex: null },
        ],
        // No field mapping — constant-only layer.
        scaledConstants: { 0: { fill: "web" } },
        lineages: { 1: [0], 2: [1] },
        rows: { 0: {}, 1: {} },
        keys: { 0: "const-a", 1: "const-b" },
      }),
    );
    expect(index.get("fill:0")).toEqual(["const-a", "const-b"]);
    expect(index.get("fill:1")).toEqual([]);
  });
});
