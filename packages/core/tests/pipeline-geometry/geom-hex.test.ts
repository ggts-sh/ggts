/**
 * geom_hex + stat_bin_hex (#800).
 */
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "bun:test";
import { aes, gg, normalize, validate } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import { hexBatch } from "../../src/pipeline/geometry-hex.ts";
import type { Frame } from "../../src/pipeline/geometry-shared.ts";
import type { ResolvedStyleScales } from "../../src/pipeline/geometry-style.ts";
import type { LayerFrame } from "../../src/pipeline/types.ts";

const size = { width: 200, height: 100 };

describe("geom_hex schema (#800)", () => {
  it("accepts hex with continuous x/y", () => {
    const result = validate(
      {
        data: { values: [{ x: 1, y: 2 }] },
        aes: { x: { field: "x" }, y: { field: "y" } },
        layers: [{ geom: "hex", params: { bins: 5 } }],
      },
      {},
    );
    expect(result.ok).toBe(true);
  });

  it("normalize defaults fill to after_stat count", () => {
    const spec = normalize({
      data: { values: [{ x: 1, y: 2 }] },
      aes: { x: { field: "x" }, y: { field: "y" } },
      layers: [{ geom: "hex" }],
    });
    expect(spec.layers[0]?.geom).toBe("hex");
    expect(spec.layers[0]?.stat).toBe("bin_hex");
    expect(spec.layers[0]?.aes?.fill).toEqual({ stat: "count" });
  });

  it("builder sugar emits hex + params", () => {
    const spec = gg({ x: [1, 2], y: [3, 4] }, aes({ x: "x", y: "y" }))
      .geomHex({ bins: 10, drop: true })
      .spec();
    expect(spec.layers[0]?.geom).toBe("hex");
    expect(spec.layers[0]?.params).toMatchObject({ bins: 10, drop: true });
  });
});

describe("geom_hex geometry (#800)", () => {
  it("emits closed hex paths with fill from count", () => {
    const model = runPipeline(
      gg(
        {
          x: [0.1, 0.2, 0.8, 0.9, 0.5],
          y: [0.1, 0.15, 0.8, 0.9, 0.5],
        },
        aes({ x: "x", y: "y" }),
      )
        .geomHex({ bins: 6 })
        .spec(),
      size,
    );
    const paths = model.scene.batches.filter((b) => b.kind === "paths");
    expect(paths.length).toBe(1);
    const batch = paths[0]!;
    expect(batch.closed).toBe(true);
    expect(batch.fills).toBeDefined();
    const nHex = batch.pathOffsets.length - 1;
    expect(nHex).toBeGreaterThan(0);
    expect(batch.fills!.length).toBe(nHex);
    // 6 vertices per hex
    expect(batch.positions.length / 2).toBe(nHex * 6);
  });

  it("more bins can produce more occupied hexes", () => {
    const n = 50;
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      x.push(i / (n - 1));
      y.push(((i * 11) % n) / (n - 1));
    }
    const sparse = runPipeline(
      gg({ x, y }, aes({ x: "x", y: "y" }))
        .geomHex({ bins: 4 })
        .spec(),
      size,
    );
    const dense = runPipeline(
      gg({ x, y }, aes({ x: "x", y: "y" }))
        .geomHex({ bins: 12 })
        .spec(),
      size,
    );
    const sparsePaths = sparse.scene.batches.find((b) => b.kind === "paths");
    const densePaths = dense.scene.batches.find((b) => b.kind === "paths");
    expect(sparsePaths?.kind).toBe("paths");
    expect(densePaths?.kind).toBe("paths");
    const sparseN = sparsePaths!.pathOffsets.length - 1;
    const denseN = densePaths!.pathOffsets.length - 1;
    expect(denseN).toBeGreaterThanOrEqual(sparseN);
  });

  it("attaches closedFrameRows so each hex vertex maps to its cell row", () => {
    const model = runPipeline(
      gg(
        {
          x: [0.1, 0.2, 0.8, 0.9, 0.5],
          y: [0.1, 0.15, 0.8, 0.9, 0.5],
        },
        aes({ x: "x", y: "y" }),
      )
        .geomHex({ bins: 6 })
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "paths");
    expect(batch?.kind).toBe("paths");
    expect(batch!.closed).toBe(true);
    expect(batch!.closedFrameRows).toBeDefined();
    expect(batch!.closedFrameRows!.length).toBe(batch!.positions.length / 2);
    const nHex = batch!.pathOffsets.length - 1;
    expect(nHex).toBeGreaterThan(1);
    // First vertex of subpath 0 and subpath 1 must resolve to different cells.
    const row0 = batch!.closedFrameRows![batch!.pathOffsets[0]!]!;
    const row1 = batch!.closedFrameRows![batch!.pathOffsets[1]!]!;
    expect(row0).not.toBe(row1);
    // All six vertices of a hex share that cell's frame row.
    for (let v = 0; v < 6; v++) {
      expect(batch!.closedFrameRows![batch!.pathOffsets[0]! + v]).toBe(row0);
    }
  });

  it("resolves after_stat color (outline) from count like fill", () => {
    const model = runPipeline(
      gg(
        {
          x: [0.1, 0.15, 0.8, 0.85, 0.5],
          y: [0.1, 0.2, 0.75, 0.9, 0.5],
        },
        aes({ x: "x", y: "y", color: { stat: "count" }, fill: { stat: "count" } }),
      )
        .geomHex({ bins: 5, linewidth: 1 })
        .spec(),
      size,
    );
    expect(model.warnings.filter((w) => w.code === "stat-channel-unsupported")).toEqual([]);
    const batch = model.scene.batches.find((b) => b.kind === "paths");
    expect(batch?.kind).toBe("paths");
    const nHex = batch!.pathOffsets.length - 1;
    expect(nHex).toBeGreaterThan(0);
    const strokes = batch!.strokes ?? [];
    expect(strokes.length).toBe(nHex);
    // At least one hex should get a non-null stroke from the count scale.
    expect(strokes.some((s) => s !== null && s !== undefined)).toBe(true);
  });

  it("maps alpha/linewidth to kept subpaths when some hexes drop", () => {
    // Three candidate cells; middle center is non-finite so only rows 0 and 2 emit.
    const frame = fromAny<LayerFrame>({
      n: 3,
      xNumeric: new Float64Array([0.2, Number.NaN, 0.8]),
      yNumeric: new Float64Array([0.2, 0.5, 0.8]),
      hexWidth: new Float64Array([0.2, 0.2, 0.2]),
      hexHeight: new Float64Array([0.2, 0.2, 0.2]),
      rowIndex: new Uint32Array([0, 1, 2]),
      fillValues: null,
      colorValues: null,
      alphaValues: [0.2, 0.5, 0.9],
      linewidthValues: [0.5, 1.5, 2.5],
      binding: {
        index: 0,
        fill: { field: null, statColumn: null, constant: "#111", scaledConstant: null },
        color: { field: null, statColumn: null, constant: null, scaledConstant: null },
        alpha: { field: "a", statColumn: null, constant: null, scaledConstant: null },
        linewidth: { field: "lw", statColumn: null, constant: null, scaledConstant: null },
        layer: { geom: "hex", params: {} },
      },
    });
    const fx = fromAny<Frame>({
      xScale: {
        type: "linear",
        normalizeTransformed: (v: number) => v,
      },
      yScale: {
        type: "linear",
        normalizeTransformed: (v: number) => v,
      },
      innerWidth: 100,
      innerHeight: 100,
    });
    const styles = fromAny<ResolvedStyleScales>({
      alpha: { scale: { valueOf: Number } },
      linewidth: { scale: { valueOf: Number } },
      size: null,
      shape: null,
      linetype: null,
    });

    const batch = hexBatch(frame, fx, null, null, styles, []);
    expect(batch).not.toBeNull();
    const nHex = batch!.pathOffsets.length - 1;
    expect(nHex).toBe(2);
    expect(batch!.alphas).toBeDefined();
    expect(batch!.alphas!.length).toBe(2);
    expect(batch!.alphas![0]).toBeCloseTo(0.2);
    expect(batch!.alphas![1]).toBeCloseTo(0.9);
    expect(batch!.linewidths).toBeDefined();
    expect(batch!.linewidths!.length).toBe(2);
    expect(batch!.linewidths![0]).toBeCloseTo(0.5);
    expect(batch!.linewidths![1]).toBeCloseTo(2.5);
  });
});
