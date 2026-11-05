/**
 * #1342 — filled-area shortlist must be O(subpaths), not O(vertices).
 * Id-exact parity with the topmost / nearest-anchor / axis-snap contracts.
 */
import { describe, expect, it } from "bun:test";

import { pathRange } from "../../../src/candidate-geometry.ts";
import { createHitGeometry } from "../../../src/candidate-hit-geometry.ts";
import { buildCandidateStore } from "../../../src/candidate-store.ts";
import { buildCandidateStoreIndexes } from "../../../src/candidate-store-indexes.ts";
import { buildSpatialIndex } from "../../../src/candidate-store-spatial-index.ts";
import type { PathsBatch, Scene } from "../../../src/scene.ts";
import { scene } from "../fixtures.ts";

/** Closed band: upper ascending, lower descending — same layout as geom_area. */
function stackedAreaScene(
  groups: number,
  rows: number,
  panelW = 200,
  panelH = 120,
): Scene {
  const pathOffsets = [0];
  const positions: number[] = [];
  const rowIndex: number[] = [];
  const fills: null[] = [];
  let v = 0;
  for (let g = 0; g < groups; g++) {
    for (let i = 0; i < rows; i++) {
      const x = rows === 1 ? panelW / 2 : (i / (rows - 1)) * panelW;
      const yTop = 15 + g * 6 + Math.sin(i / 7) * 4;
      positions.push(x, yTop);
      rowIndex.push(g * rows + i);
      v++;
    }
    for (let i = rows - 1; i >= 0; i--) {
      const x = rows === 1 ? panelW / 2 : (i / (rows - 1)) * panelW;
      const yBot = panelH - 10 - g * 2;
      positions.push(x, yBot);
      rowIndex.push(g * rows + i);
      v++;
    }
    pathOffsets.push(v);
    fills.push(null);
  }
  const plot = scene();
  plot.width = panelW;
  plot.height = panelH;
  plot.panels = [
    {
      id: "panel:all",
      x: 0,
      y: 0,
      width: panelW,
      height: panelH,
      strip: "",
      axisX: [],
      axisY: [],
      grid: { x: [], y: [] },
    },
  ];
  plot.batches = [
    {
      kind: "paths",
      layerIndex: 0,
      panelIndex: 0,
      positions: new Float32Array(positions),
      rowIndex: new Uint32Array(rowIndex),
      pathOffsets: new Uint32Array(pathOffsets),
      fills,
      strokes: fills.map(() => null),
      closed: true,
      linewidth: 0,
      alpha: 1,
      curve: "linear",
    } satisfies PathsBatch,
  ];
  return plot;
}

function areaStore(plot: Scene) {
  return buildCandidateStore(plot, {
    datum: ({ primitiveIndex, batchIndex }) => {
      const batch = plot.batches[batchIndex]!;
      if (batch.kind !== "paths") return { autoMode: "x" as const };
      const x = batch.positions[primitiveIndex * 2]!;
      const y = batch.positions[primitiveIndex * 2 + 1]!;
      return { xValue: x, yValue: y, autoMode: "x" as const, seriesId: 0 };
    },
  });
}

/** Independent hitTest oracle: topmost containing subpath, then nearest anchor. */
function oracleHitId(plot: Scene, px: number, py: number): number | null {
  const indexes = buildCandidateStoreIndexes(plot, { hitTolerance: 3 });
  const hit = createHitGeometry(indexes);
  const probe = hit.probePoint(px, py);
  let best = -1;
  let bestBatch = -1;
  let bestPathStart = -1;
  let bestDistance = Infinity;
  let bestPrimitive = Infinity;
  for (let id = 0; id < indexes.n; id++) {
    const batchIndex = indexes.batchIds[id]!;
    const batch = plot.batches[batchIndex]!;
    if (batch.kind !== "paths" || batch.fills === undefined) continue;
    const distance = probe.distance(id);
    if (distance === null) continue;
    const primitive = indexes.primitiveIds[id]!;
    const range = pathRange(batch, primitive);
    const pathStart = range?.[0] ?? -1;
    const sameBatch = batchIndex === bestBatch;
    const improves =
      batchIndex > bestBatch ||
      (sameBatch &&
        (pathStart > bestPathStart ||
          (pathStart === bestPathStart &&
            (distance < bestDistance ||
              (distance === bestDistance && primitive < bestPrimitive)))));
    if (improves) {
      best = id;
      bestBatch = batchIndex;
      bestPathStart = pathStart;
      bestDistance = distance;
      bestPrimitive = primitive;
    }
  }
  return best < 0 ? null : best;
}

/** Independent nearest-x oracle over every candidate (axis distance then orth). */
function oracleNearestX(
  plot: Scene,
  px: number,
  py: number,
  maxDistance: number,
): number | null {
  const indexes = buildCandidateStoreIndexes(plot, { hitTolerance: 3 });
  let best = -1;
  let bestDistance = Infinity;
  let bestOrth = Infinity;
  for (let id = 0; id < indexes.n; id++) {
    const distance = Math.abs(indexes.xs[id]! - px);
    if (distance > maxDistance) continue;
    const orth = Math.abs(indexes.ys[id]! - py);
    if (
      distance < bestDistance ||
      (distance === bestDistance && orth < bestOrth)
    ) {
      best = id;
      bestDistance = distance;
      bestOrth = orth;
    }
  }
  return best < 0 ? null : best;
}

describe("filled-area hit shortlist (#1342)", () => {
  it("hitTest matches the topmost+nearest-anchor oracle on a multi-group grid", () => {
    const plot = stackedAreaScene(3, 40);
    const store = areaStore(plot);
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 8; j++) {
        const px = 10 + i * 18;
        const py = 20 + j * 10;
        const got = store.hitTest(px, py)?.id ?? null;
        const want = oracleHitId(plot, px, py);
        expect(got).toBe(want);
      }
    }
  });

  it("nearest mode x matches the full-scan axis oracle", () => {
    const plot = stackedAreaScene(3, 40);
    const store = areaStore(plot);
    const maxDistance = 24;
    for (let i = 0; i < 12; i++) {
      const px = 8 + i * 15;
      const py = 40 + (i % 5) * 8;
      const got = store.nearest(px, py, { mode: "x", maxDistance })?.id ?? null;
      const want = oracleNearestX(plot, px, py, maxDistance);
      expect(got).toBe(want);
    }
  });

  it("nearest auto on a filled-only area x-snaps to the oracle vertex", () => {
    const plot = stackedAreaScene(2, 30);
    const store = areaStore(plot);
    const maxDistance = 24;
    for (let i = 0; i < 8; i++) {
      const px = 20 + i * 20;
      const py = 55;
      const got =
        store.nearest(px, py, { mode: "auto", maxDistance })?.id ?? null;
      const want = oracleNearestX(plot, px, py, maxDistance);
      expect(got).toBe(want);
    }
  });

  it("nearest auto x-snaps a filled band when the probe is far on y", () => {
    // Thin band near the bottom; probe shares x with a vertex but sits far above
    // the subpath AABB. Pre-#1342 the x-strip shortlisted anchors; after NaN
    // omission auto must still pull filled reps via strip extended AABBs.
    const plot = scene();
    plot.batches = [
      {
        kind: "paths",
        layerIndex: 0,
        panelIndex: 0,
        positions: new Float32Array([
          20,
          90,
          60,
          88,
          100,
          90,
          140,
          87,
          180,
          91, // upper
          180,
          100,
          140,
          102,
          100,
          100,
          60,
          101,
          20,
          100, // lower reversed
        ]),
        rowIndex: new Uint32Array([0, 1, 2, 3, 4, 4, 3, 2, 1, 0]),
        pathOffsets: new Uint32Array([0, 10]),
        fills: [null],
        strokes: [null],
        closed: true,
        linewidth: 0,
        alpha: 1,
        curve: "linear",
      },
    ];
    const store = areaStore(plot);
    const maxDistance = 24;
    const px = 100;
    const py = 20; // far above the band (y≈87–102)
    const explicit =
      store.nearest(px, py, { mode: "x", maxDistance })?.id ?? null;
    const auto =
      store.nearest(px, py, { mode: "auto", maxDistance })?.id ?? null;
    const want = oracleNearestX(plot, px, py, maxDistance);
    expect(want).not.toBeNull();
    expect(explicit).toBe(want);
    expect(auto).toBe(want);
  });

  it("extended index holds one entry per filled subpath, not per vertex", () => {
    const groups = 4;
    const rows = 80;
    const plot = stackedAreaScene(groups, rows);
    const indexes = buildCandidateStoreIndexes(plot, { hitTolerance: 3 });
    const hit = createHitGeometry(indexes);
    const query = buildSpatialIndex(indexes, hit);
    // Public structural signal: shortlist for a panel-wide probe must not grow
    // with V. Count candidates that addExtendedIntersecting returns at the center.
    const shortlist: number[] = [];
    query.addExtendedIntersecting(100, 60, 100, 60, shortlist);
    // One representative per filled subpath (groups closed bands).
    expect(shortlist.length).toBe(groups);
    expect(indexes.n).toBe(groups * rows * 2);
  });

  it("queryRect still returns every vertex of a hit filled subpath", () => {
    const rows = 25;
    const plot = stackedAreaScene(1, rows);
    const store = areaStore(plot);
    // Interior brush whose center is inside the band, anchors may lie outside.
    const hits = Array.from(store.queryRect(90, 40, 110, 50)).toSorted(
      (a, b) => a - b,
    );
    expect(hits).toEqual(Array.from({ length: rows * 2 }, (_, i) => i));
  });

  it("queryRect selects only local vertices when the brush center is outside the fill", () => {
    // Triangle (20,20) (80,20) (50,80). Brush over the top edge near (50,20)
    // with center outside the fill — only nearby top-edge vertices, not the
    // whole subpath (and not empty via rep-only edge checks).
    const plot = scene();
    plot.batches = [
      {
        kind: "paths",
        layerIndex: 0,
        panelIndex: 0,
        positions: new Float32Array([20, 20, 50, 20, 80, 20, 50, 80]),
        rowIndex: new Uint32Array([0, 1, 2, 3]),
        pathOffsets: new Uint32Array([0, 4]),
        fills: [null],
        strokes: [null],
        closed: true,
        linewidth: 0,
        alpha: 1,
        curve: "linear",
      },
    ];
    const store = areaStore(plot);
    // Brush (45,15)-(55,22): covers the mid top vertex (50,20); center (50,18.5)
    // is outside the fill (above the top edge). Must not return the bottom tip.
    const hits = new Set(Array.from(store.queryRect(45, 15, 55, 22)));
    expect(hits.has(1)).toBe(true); // mid top vertex
    expect(hits.has(3)).toBe(false); // bottom tip (50,80)
  });

  it("hitTest and nearest(auto) read batches per subpath, not per vertex, on a dense stacked area", () => {
    // 8 × 2000 closed-band verts = 32k candidates. A scan of every vertex
    // reads a batch once per vertex (batchAt in candidate-hit-geometry). Counting reads does not depend on CI speed.
    const plot = stackedAreaScene(8, 2000);
    let batchIndexReads = 0;
    plot.batches = new Proxy(plot.batches, {
      get(target, property, receiver): unknown {
        if (typeof property === "string" && /^\d+$/.test(property))
          batchIndexReads++;
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    const store = areaStore(plot);
    expect(store.size).toBe(32_000);
    const probes: [number, number][] = [];
    for (let i = 0; i < 20; i++) probes.push([15 + i * 9, 50]);
    // Warm up once so build cost is not in the sample.
    for (const [x, y] of probes) {
      store.hitTest(x, y);
      store.nearest(x, y, { mode: "auto", maxDistance: 24 });
    }
    batchIndexReads = 0;
    for (const [x, y] of probes) store.hitTest(x, y);
    const hitReads = batchIndexReads;
    batchIndexReads = 0;
    for (const [x, y] of probes)
      store.nearest(x, y, { mode: "auto", maxDistance: 24 });
    const nearestReads = batchIndexReads;
    // The shortlist holds at most one entry per subpath (8), so reads stay
    // far below the 32k vertices that one probe would read in a full scan.
    // Reads must be counted at all, or the bounds below pass without a check.
    expect(hitReads).toBeGreaterThan(0);
    expect(nearestReads).toBeGreaterThan(0);
    expect(hitReads / probes.length).toBeLessThan(200);
    expect(nearestReads / probes.length).toBeLessThan(200);
  });

  it("nearest prefers the higher id on an exact (distance, orth) tie inside a filled span", () => {
    // Zero-height band: upper and lower vertices share (x,y). Descending
    // shortlist contract → highest id wins the tie (topmost).
    const plot = scene();
    plot.batches = [
      {
        kind: "paths",
        layerIndex: 0,
        panelIndex: 0,
        positions: new Float32Array([
          0,
          50,
          50,
          50,
          100,
          50, // upper
          100,
          50,
          50,
          50,
          0,
          50, // lower (coincident)
        ]),
        rowIndex: new Uint32Array([0, 1, 2, 2, 1, 0]),
        pathOffsets: new Uint32Array([0, 6]),
        fills: [null],
        strokes: [null],
        closed: true,
        linewidth: 0,
        alpha: 1,
        curve: "linear",
      },
    ];
    const store = areaStore(plot);
    const hit = store.nearest(50, 50, { mode: "x", maxDistance: 24 });
    expect(hit).not.toBeNull();
    // Coincident at x=50: ids 1 (upper mid) and 4 (lower mid). Prefer 4.
    expect(hit!.id).toBe(4);
  });

  it("nearest mode x skips filled vertices without an x token, not the whole subpath", () => {
    const plot = scene();
    plot.batches = [
      {
        kind: "paths",
        layerIndex: 0,
        panelIndex: 0,
        positions: new Float32Array([
          20, 40, 60, 40, 100, 40, 100, 80, 60, 80, 20, 80,
        ]),
        rowIndex: new Uint32Array([0, 1, 2, 2, 1, 0]),
        pathOffsets: new Uint32Array([0, 6]),
        fills: [null],
        strokes: [null],
        closed: true,
        linewidth: 0,
        alpha: 1,
        curve: "linear",
      },
    ];
    // Rep (id 0) has no x token; later vertices do — whole subpath must still snap.
    const store = buildCandidateStore(plot, {
      datum: ({ primitiveIndex }) =>
        primitiveIndex === 0
          ? { xValue: null, yValue: 40, autoMode: "x" as const }
          : {
              xValue: [20, 60, 100, 100, 60, 20][primitiveIndex],
              yValue: [40, 40, 40, 80, 80, 80][primitiveIndex],
              autoMode: "x" as const,
            },
    });
    const hit = store.nearest(60, 30, { mode: "x", maxDistance: 24 });
    expect(hit).not.toBeNull();
    expect(hit!.id).not.toBe(0);
    expect(hit!.id).toBe(1);
  });

  it("picks the nearest upper-edge anchor inside a single filled band", () => {
    // Triangle-like band so anchors are not uniform — nearest vertex is non-obvious.
    const plot = scene();
    plot.batches = [
      {
        kind: "paths",
        layerIndex: 0,
        panelIndex: 0,
        positions: new Float32Array([
          20,
          30,
          60,
          20,
          100,
          30,
          140,
          25,
          180,
          35, // upper
          180,
          90,
          140,
          95,
          100,
          90,
          60,
          95,
          20,
          90, // lower reversed
        ]),
        rowIndex: new Uint32Array([0, 1, 2, 3, 4, 4, 3, 2, 1, 0]),
        pathOffsets: new Uint32Array([0, 10]),
        fills: [null],
        strokes: [null],
        closed: true,
        linewidth: 0,
        alpha: 1,
        curve: "linear",
      },
    ];
    const store = areaStore(plot);
    // Probe near upper vertex at (100, 30).
    const hit = store.hitTest(102, 40);
    expect(hit).not.toBeNull();
    expect(hit!.id).toBe(oracleHitId(plot, 102, 40));
    // Nearest on x near the right side should prefer the rightmost upper vertex.
    const near = store.nearest(175, 50, { mode: "x", maxDistance: 24 });
    expect(near?.id).toBe(oracleNearestX(plot, 175, 50, 24));
  });
});
