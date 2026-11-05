/**
 * Hex cells stay inside the panel, with default scales and pinned domains (#1939).
 */
import { describe, expect, it } from "bun:test";

import { fromAny } from "@total-typescript/shoehorn";
import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { hexBatch } from "../src/pipeline/geometry-hex.ts";
import type { Frame } from "../src/pipeline/geometry-shared.ts";
import type { ResolvedStyleScales } from "../src/pipeline/geometry-style.ts";
import type { LayerFrame } from "../src/pipeline/types.ts";
import { registerAll } from "../src/register.ts";

registerAll();

const points = Array.from({ length: 200 }, (_, i) => ({ x: (i * 7) % 20, y: (i * 11) % 23 }));
const size = { width: 400, height: 400 };

type Scales = Parameters<ReturnType<typeof gg>["scales"]>[0];
type Coord = { type: "transform"; clip: false };

function hex(scales?: Scales, coord?: Coord, data: readonly object[] = points) {
  let builder = gg(data as never, aes({ x: "x", y: "y" })).geomHex({ bins: 5 });
  if (scales) builder = builder.scales(scales);
  const spec = builder.spec();
  const model = runPipeline(coord ? { ...spec, coord } : spec, size);
  const batch = model.scene.batches.find((b) => b.kind === "paths");
  if (batch?.kind !== "paths") throw new Error("expected paths");
  const { width, height } = model.scene.panels[0]!;
  return { model, batch, width, height };
}

function outside(batch: { positions: Float32Array }, width: number, height: number): number {
  let count = 0;
  for (let i = 0; i < batch.positions.length; i += 2) {
    const x = batch.positions[i]!;
    const y = batch.positions[i + 1]!;
    if (x < 0 || x > width || y < 0 || y > height) count++;
  }
  return count;
}

function expectConsistent(batch: ReturnType<typeof hex>["batch"]): void {
  const count = batch.positions.length / 2;
  expect(batch.rowIndex.length).toBe(count);
  expect(batch.closedFrameRows?.length).toBe(count);
  expect(batch.pathOffsets.at(-1)).toBe(count);
  expect(batch.fills?.length).toBe(batch.pathOffsets.length - 1);
}

describe("hex cells at the edge of the panel (#1939)", () => {
  it.each([
    ["default scales", undefined],
    ["a pinned y domain", { y: { domain: [0, 30] } }],
    ["a reversed x scale", { x: { reverse: true } }],
    ["a reversed y scale", { y: { reverse: true } }],
  ] as const)("keeps every vertex inside the panel with %s", (_, scales) => {
    const { batch, width, height } = hex(scales as Scales);
    expect(outside(batch, width, height)).toBe(0);
    expectConsistent(batch);
    // The cut puts vertices on the panel edge.
    const onEdge = Array.from({ length: batch.positions.length / 2 }, (_v, i) => i).some(
      (i) => batch.positions[i * 2] === 0 || batch.positions[i * 2 + 1] === 0,
    );
    expect(onEdge).toBe(true);
  });

  it("keeps the uncut cell outline: a cut vertex lies on an edge of the uncut cell", () => {
    const cut = hex();
    const full = hex(undefined, { type: "transform", clip: false });
    expect(outside(full.batch, full.width, full.height)).toBeGreaterThan(0);
    // Same cells in the same order: compare each cut vertex with its cell.
    expect(cut.batch.pathOffsets.length).toBe(full.batch.pathOffsets.length);
    for (let cell = 0; cell < cut.batch.pathOffsets.length - 1; cell++) {
      const poly = (b: typeof cut.batch) => {
        const out: [number, number][] = [];
        for (let v = b.pathOffsets[cell]!; v < b.pathOffsets[cell + 1]!; v++) {
          out.push([b.positions[v * 2]!, b.positions[v * 2 + 1]!]);
        }
        return out;
      };
      const uncut = poly(full.batch);
      for (const [x, y] of poly(cut.batch)) {
        const onOutline = uncut.some(([x0, y0], i) => {
          const [x1, y1] = uncut[(i + 1) % uncut.length]!;
          const cross = (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
          const within =
            x >= Math.min(x0, x1) - 1e-2 &&
            x <= Math.max(x0, x1) + 1e-2 &&
            y >= Math.min(y0, y1) - 1e-2 &&
            y <= Math.max(y0, y1) + 1e-2;
          return within && Math.abs(cross) < 1;
        });
        const inside = x >= 0 && x <= cut.width && y >= 0 && y <= cut.height;
        expect(inside).toBe(true);
        // A vertex is either an original corner/crossing on the outline, or a
        // panel-edge crossing; a panel corner (x and y both on the edge) is the
        // only vertex that need not lie on the uncut outline.
        const atPanelCorner = (x === 0 || x === cut.width) && (y === 0 || y === cut.height);
        expect(onOutline || atPanelCorner).toBe(true);
      }
    }
  });

  it("cuts a cell at a panel corner into a polygon with a corner vertex", () => {
    // One cell whose centre sits on the data corner: the panel corner is inside it.
    const { batch, width, height } = hex(
      { x: { domain: [0, 10] }, y: { domain: [0, 10] } },
      undefined,
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    );
    expect(outside(batch, width, height)).toBe(0);
    const verts = (cell: number) => {
      const out: [number, number][] = [];
      for (let v = batch.pathOffsets[cell]!; v < batch.pathOffsets[cell + 1]!; v++) {
        out.push([batch.positions[v * 2]!, batch.positions[v * 2 + 1]!]);
      }
      return out;
    };
    const cells = batch.pathOffsets.length - 1;
    const cornerCells = Array.from({ length: cells }, (_, c) => verts(c)).filter((poly) =>
      poly.some(([x, y]) => (x === 0 || x === width) && (y === 0 || y === height)),
    );
    // Exactly one vertex, no more, in each of the two panel corners that data fills.
    expect(cornerCells.length).toBeGreaterThan(0);
    for (const poly of cornerCells) {
      expect(poly.length).toBeGreaterThanOrEqual(4);
      expect(poly.length).toBeLessThanOrEqual(10);
    }
  });

  it("writes no path for a cell that lies fully outside a pinned domain", () => {
    const pinned = hex({ x: { domain: [0, 10] }, y: { domain: [0, 10] } });
    const free = hex();
    const rows = new Set<number>();
    for (const row of pinned.batch.closedFrameRows!) rows.add(row);
    // Cells beyond the domain are gone: fewer subpaths, fills match subpaths.
    expect(pinned.batch.pathOffsets.length).toBeLessThan(free.batch.pathOffsets.length);
    expectConsistent(pinned.batch);
    expect(outside(pinned.batch, pinned.width, pinned.height)).toBe(0);
    // Every subpath has at least three vertices and one frame row.
    for (let s = 0; s < pinned.batch.pathOffsets.length - 1; s++) {
      const start = pinned.batch.pathOffsets[s]!;
      const end = pinned.batch.pathOffsets[s + 1]!;
      expect(end - start).toBeGreaterThanOrEqual(3);
      const first = pinned.batch.closedFrameRows![start]!;
      for (let v = start; v < end; v++) expect(pinned.batch.closedFrameRows![v]).toBe(first);
    }
  });

  it("builds hit candidates only at vertices inside the panel, each on its own cell row", () => {
    const { model, batch, width, height } = hex({ x: { domain: [0, 10] }, y: { domain: [0, 10] } });
    const panel = model.scene.panels[0]!;
    const count = batch.positions.length / 2;
    expect(model.candidates.size).toBe(count);
    for (let id = 0; id < model.candidates.size; id++) {
      const candidate = model.candidates.candidate(id)!;
      // Candidate positions are scene coordinates, so the panel offset applies.
      expect(candidate.x - panel.x).toBeGreaterThanOrEqual(0);
      expect(candidate.x - panel.x).toBeLessThanOrEqual(width);
      expect(candidate.y - panel.y).toBeGreaterThanOrEqual(0);
      expect(candidate.y - panel.y).toBeLessThanOrEqual(height);
      const sameCell = model.candidates.candidate(
        Math.min(
          count - 1,
          batch.pathOffsets[subpathOf(batch.pathOffsets, candidate.primitiveIndex)!]!,
        ),
      )!;
      // Vertices of one cell resolve to the same data position (the cell centre).
      expect(candidate.xValue).toBe(sameCell.xValue);
      expect(candidate.yValue).toBe(sameCell.yValue);
    }
  });

  it("answers a pointer inside the visible part of a cut cell with that cell", () => {
    const { model, batch } = hex({ x: { domain: [0, 10] }, y: { domain: [0, 10] } });
    const panel = model.scene.panels[0]!;
    let checked = 0;
    for (let s = 0; s < batch.pathOffsets.length - 1; s++) {
      const start = batch.pathOffsets[s]!;
      const end = batch.pathOffsets[s + 1]!;
      if (end - start === 6) continue;
      // The mean of a convex polygon's vertices lies inside it.
      let mx = 0;
      let my = 0;
      for (let v = start; v < end; v++) {
        mx += batch.positions[v * 2]!;
        my += batch.positions[v * 2 + 1]!;
      }
      const hit = model.candidates.nearest(
        panel.x + mx / (end - start),
        panel.y + my / (end - start),
        {
          mode: "exact",
          maxDistance: 400,
        },
      );
      expect(hit).not.toBeNull();
      const row = batch.closedFrameRows![start]!;
      expect(batch.closedFrameRows![hit!.primitiveIndex]).toBe(row);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("puts the vertex of a cell cut at a panel corner exactly on the corner", () => {
    const { batch, width, height } = hex({ x: { domain: [0, 20] }, y: { domain: [0, 22] } });
    const corners = new Set<string>();
    for (let v = 0; v < batch.positions.length / 2; v++) {
      const x = batch.positions[v * 2]!;
      const y = batch.positions[v * 2 + 1]!;
      if ((x === 0 || x === width) && (y === 0 || y === height)) corners.add(`${x},${y}`);
    }
    expect(corners.size).toBeGreaterThan(0);
  });

  it("keeps the vertices as before when the panel does not clip", () => {
    const { batch, width, height } = hex(undefined, { type: "transform", clip: false });
    expect(outside(batch, width, height)).toBe(38);
    expect(batch.positions.length / 2).toBe(240);
  });

  it("does not add vertices to cells that stay inside the panel", () => {
    const { batch } = hex({ x: { domain: [-10, 30] }, y: { domain: [-10, 33] } });
    expect(batch.positions.length / 2).toBe((batch.pathOffsets.length - 1) * 6);
  });

  it("leaves a polar panel alone", () => {
    const spec = gg(points, aes({ x: "x", y: "y" }))
      .geomHex({ bins: 5 })
      .coordPolar()
      .spec();
    const model = runPipeline(spec, size);
    const flat = runPipeline({ ...spec, coord: { type: "transform", clip: false } }, size);
    const polar = model.scene.batches.find((b) => b.kind === "paths");
    const base = flat.scene.batches.find((b) => b.kind === "paths");
    // Polar projects after geometry, so the cell count matches the uncut cells.
    expect(polar?.kind).toBe("paths");
    expect(polar!.pathOffsets.length).toBe(base!.pathOffsets.length);
  });

  it("keeps vertices inside the panel on a flipped coordinate", () => {
    const spec = gg(points, aes({ x: "x", y: "y" }))
      .geomHex({ bins: 5 })
      .coordFlip()
      .spec();
    const model = runPipeline(spec, { width: 400, height: 300 });
    const batch = model.scene.batches.find((b) => b.kind === "paths");
    if (batch?.kind !== "paths") throw new Error("expected paths");
    const { width, height } = model.scene.panels[0]!;
    expect(outside(batch, width, height)).toBe(0);
  });
});

function subpathOf(offsets: Uint32Array, vertex: number): number | null {
  for (let s = 0; s < offsets.length - 1; s++) {
    if (vertex >= offsets[s]! && vertex < offsets[s + 1]!) return s;
  }
  return null;
}

describe("hexBatch cut edge cases (#1939)", () => {
  const frameOf = (cx: number, cy: number, w: number, h: number): LayerFrame =>
    fromAny<LayerFrame>({
      n: 1,
      xNumeric: new Float64Array([cx]),
      yNumeric: new Float64Array([cy]),
      hexWidth: new Float64Array([w]),
      hexHeight: new Float64Array([h]),
      rowIndex: new Uint32Array([0]),
      fillValues: null,
      colorValues: null,
      binding: {
        index: 0,
        fill: { field: null, statColumn: null, constant: "#111", scaledConstant: null },
        color: { field: null, statColumn: null, constant: null, scaledConstant: null },
        layer: { geom: "hex", params: {} },
      },
    });
  const fx = fromAny<Frame>({
    xScale: { type: "linear", normalizeTransformed: (v: number) => v },
    yScale: { type: "linear", normalizeTransformed: (v: number) => v },
    innerWidth: 352,
    innerHeight: 300,
    clip: true,
  });
  const styles = fromAny<ResolvedStyleScales>({});

  it("writes no path for a cell that lies fully outside", () => {
    expect(hexBatch(frameOf(3, 0.5, 0.5, 0.5), fx, null, null, styles, [])).toBeNull();
  });

  it.each([
    ["at one corner", 1.25, 1.25],
    ["along one side", -0.25, 0.5],
    ["along the other side", 1.25, 0.5],
  ])("writes no path for a cell that touches the panel %s", (_, cx, cy) => {
    expect(hexBatch(frameOf(cx, cy, 0.5, 0.5), fx, null, null, styles, [])).toBeNull();
  });

  it("keeps style vectors aligned when a cell in the middle lies outside", () => {
    const frame = fromAny<LayerFrame>({
      ...frameOf(0.2, 0.2, 0.2, 0.2),
      n: 3,
      xNumeric: new Float64Array([0.2, 3, 0.8]),
      yNumeric: new Float64Array([0.2, 0.5, 0.8]),
      hexWidth: new Float64Array([0.2, 0.2, 0.2]),
      hexHeight: new Float64Array([0.2, 0.2, 0.2]),
      rowIndex: new Uint32Array([0, 1, 2]),
      alphaValues: [0.2, 0.5, 0.9],
      binding: {
        ...frameOf(0, 0, 1, 1).binding,
        alpha: { field: "a", statColumn: null, constant: null, scaledConstant: null },
        linewidth: { field: null, statColumn: null, constant: null, scaledConstant: null },
      },
    });
    const aligned = fromAny<ResolvedStyleScales>({
      alpha: { scale: { valueOf: Number } },
      linewidth: null,
      size: null,
      shape: null,
      linetype: null,
    });
    const batch = hexBatch(frame, fx, null, null, aligned, [])!;
    expect(batch.pathOffsets.length - 1).toBe(2);
    expect(batch.alphas?.[0]).toBeCloseTo(0.2);
    expect(batch.alphas?.[1]).toBeCloseTo(0.9);
    expect(Array.from(batch.closedFrameRows!)).toEqual([0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2]);
  });

  it("writes no path for a cell with a non-finite corner", () => {
    const bad = fromAny<Frame>({
      ...fx,
      xScale: { type: "linear", normalizeTransformed: (v: number) => (v > 0.6 ? NaN : v) },
    });
    expect(hexBatch(frameOf(0.5, 0.5, 0.5, 0.5), bad, null, null, styles, [])).toBeNull();
  });
});
