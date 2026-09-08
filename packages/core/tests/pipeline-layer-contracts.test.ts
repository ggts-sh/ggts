/**
 * Characterization tests for per-layer pipeline contracts: backends,
 * tooltip field maps, and scaled-constant legend-focus values.
 */
import { describe, expect, it } from "bun:test";

import { resolveLayerBackends } from "../src/pipeline/layer-backends.ts";
import { resolveLayerFields, resolveLayerScaledConstants } from "../src/pipeline/layer-fields.ts";
import { bindLayer } from "../src/pipeline/bind-layer.ts";
import type { Advisory } from "../src/pipeline/types.ts";
import { ColumnTable } from "../src/table.ts";
import type { GeometryBatch } from "../src/scene.ts";
import type { LayerSpec } from "@ggts-sh/spec";

const table = ColumnTable.fromRows([
  { x: 1, y: 10, g: "a" },
  { x: 2, y: 20, g: "b" },
]);

function pointLayers(): LayerSpec[] {
  return [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }];
}

function emptyPoints(n: number, layerIndex = 0): GeometryBatch {
  return {
    kind: "points",
    layerIndex,
    panelIndex: 0,
    positions: new Float32Array(n * 2),
    rowIndex: new Uint32Array(n),
    size: 2,
    alpha: 1,
    shape: "circle",
    fill: null,
  };
}

describe("resolveLayerBackends", () => {
  it("defaults auto layers under threshold to svg", () => {
    const advisories: Advisory[] = [];
    const backends = resolveLayerBackends(
      pointLayers(),
      [emptyPoints(10)],
      undefined,
      2000,
      advisories,
    );
    expect(backends).toEqual(["svg"]);
    expect(advisories).toHaveLength(0);
  });

  it("auto-switches to canvas above threshold with advisory", () => {
    const advisories: Advisory[] = [];
    const backends = resolveLayerBackends(
      pointLayers(),
      [emptyPoints(50)],
      undefined,
      10,
      advisories,
    );
    expect(backends).toEqual(["canvas"]);
    expect(advisories.some((a) => a.code === "canvas-auto")).toBe(true);
  });

  it("force-svg overrides canvas auto", () => {
    const advisories: Advisory[] = [];
    const backends = resolveLayerBackends(
      pointLayers(),
      [emptyPoints(50)],
      "force-svg",
      10,
      advisories,
    );
    expect(backends).toEqual(["svg"]);
    expect(advisories).toHaveLength(0);
  });

  it("honors explicit render hints", () => {
    const layers: LayerSpec[] = [
      { geom: "point", aes: { x: { field: "x" }, y: { field: "y" } }, render: "canvas" },
    ];
    expect(resolveLayerBackends(layers, [emptyPoints(1)], undefined, 2000, [])).toEqual(["canvas"]);
  });
});

describe("resolveLayerFields", () => {
  it("maps identity field channels for tooltips", () => {
    const binding = bindLayer(
      { geom: "point", aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "g" } } },
      0,
      table,
      [],
    );
    const fields = resolveLayerFields(1, [binding]);
    const labels = fields[0]!.map((f) => `${f.channel}:${f.field}`);
    expect(labels).toContain("x:x");
    expect(labels).toContain("y:y");
    expect(labels).toContain("color:g");
  });

  it("marks count-stat y as stat source", () => {
    const binding = bindLayer(
      {
        geom: "bar",
        aes: { x: { field: "g" }, y: { stat: "count" } },
        stat: "count",
      },
      0,
      table,
      [],
    );
    const fields = resolveLayerFields(1, [binding])[0]!;
    const y = fields.find((f) => f.channel === "y");
    expect(y?.field).toBe("count");
    expect(y?.source).toBe("stat");
  });

  it("advertises the rolling summary value for tooltips", () => {
    // Review on #1470: summary_rolling fell through the synthesized-stat
    // branch list, so tooltips on a running-median chart showed only x.
    const binding = bindLayer(
      {
        geom: "line",
        stat: "summary_rolling",
        aes: { x: { field: "x" }, y: { field: "y" } },
        params: { window: 30, fun: "median" },
      },
      0,
      table,
      [],
    );
    const fields = resolveLayerFields(1, [binding])[0]!;
    const y = fields.find((f) => f.channel === "y");
    expect(y?.field).toBe("y");
    expect(y?.source).toBe("stat");
  });

  it("pads empty bindings to declared layer count (empty-data contract)", () => {
    const fields = resolveLayerFields(2, []);
    expect(fields).toHaveLength(2);
    expect(fields[0]).toEqual([]);
    expect(fields[1]).toEqual([]);
  });

  it("qq / qq_line advertise theoretical + sample quantiles as stat x/y, not the input sample column", () => {
    // Regression: qq_line tooltips painted sample→source "value" as null (NO_ROW
    // synthesized rows) and omitted theoretical because aes.x is unset.
    const sampleTable = ColumnTable.fromRows([{ value: 1.1 }, { value: 2 }, { value: 3.4 }]);
    for (const geom of ["qq", "qq_line"] as const) {
      const binding = bindLayer(
        { geom, aes: { sample: { field: "value" } }, stat: geom },
        0,
        sampleTable,
        [],
      );
      const fields = resolveLayerFields(1, [binding])[0]!;
      const x = fields.find((f) => f.channel === "x");
      const y = fields.find((f) => f.channel === "y");
      expect(x).toEqual({ channel: "x", field: "theoretical", source: "stat" });
      expect(y).toEqual({ channel: "y", field: "sample", source: "stat" });
      // Input sample column is not a tooltip reading for after_stat marks.
      expect(fields.some((f) => f.channel === "sample" && f.source !== "stat")).toBe(false);
      expect(fields.some((f) => f.field === "value")).toBe(false);
    }
  });
});

describe("resolveLayerScaledConstants", () => {
  it("captures scaled constant color/fill values", () => {
    const binding = bindLayer(
      {
        geom: "point",
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          color: { value: "steelblue", scale: true },
        },
      },
      0,
      table,
      [],
    );
    const constants = resolveLayerScaledConstants(1, [binding]);
    expect(constants[0]?.["color"]).toBe("steelblue");
  });

  it("captures scaled style constants for legend focus/filter keys", () => {
    const binding = bindLayer(
      {
        geom: "point",
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          shape: { value: "A", scale: true },
          size: { value: 4, scale: true },
        },
      },
      0,
      table,
      [],
    );
    const constants = resolveLayerScaledConstants(1, [binding]);
    expect(constants[0]?.["shape"]).toBe("A");
    expect(constants[0]?.["size"]).toBe(4);
  });

  it("pads empty bindings to declared layer count (empty-data contract)", () => {
    const constants = resolveLayerScaledConstants(2, []);
    expect(constants).toHaveLength(2);
    expect(constants[0]).toEqual({});
    expect(constants[1]).toEqual({});
  });
});
