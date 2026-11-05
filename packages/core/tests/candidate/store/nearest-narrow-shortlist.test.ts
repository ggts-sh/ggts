/**
 * `nearest` runs on each pointer move. Its shortlist holds only candidates that
 * can win, and its result stays equal to a scan of every candidate.
 */
import { describe, expect, it } from "bun:test";

import { createHitGeometry } from "../../../src/candidate-hit-geometry.ts";
import { buildCandidateStore } from "../../../src/candidate-store.ts";
import { buildCandidateStoreIndexes } from "../../../src/candidate-store-indexes.ts";
import { findNearest } from "../../../src/candidate-store-nearest.ts";
import { buildSpatialIndex } from "../../../src/candidate-store-spatial-index.ts";
import type {
  CandidateInspectMode,
  CandidateStoreOptions,
} from "../../../src/candidate-store-types.ts";
import type { GeometryBatch, Scene } from "../../../src/scene.ts";
import { scene } from "../fixtures.ts";

const WIDTH = 200;
const HEIGHT = 120;
const COUNT = 5000;
const MODES: readonly CandidateInspectMode[] = ["auto", "exact", "x", "y", "xy"];

function seeded(seed: number) {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

function points(count: number, seed: number, panelIndex = 0, layerIndex = 0): GeometryBatch {
  const next = seeded(seed);
  const positions = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    positions[i * 2] = next() * WIDTH;
    positions[i * 2 + 1] = next() * HEIGHT;
  }
  return {
    kind: "points",
    layerIndex,
    panelIndex,
    positions,
    rowIndex: Uint32Array.from({ length: count }, (_, i) => i),
    size: 3,
    alpha: 1,
    shape: "circle",
    fill: null,
  };
}

/** One stroked path with x increasing across the panel. Auto mode x. */
function line(count: number, seed: number, layerIndex = 0): GeometryBatch {
  const next = seeded(seed);
  const positions = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    positions[i * 2] = (i / count) * WIDTH;
    positions[i * 2 + 1] = 40 + next() * 40;
  }
  return {
    kind: "paths",
    layerIndex,
    panelIndex: 0,
    positions,
    rowIndex: Uint32Array.from({ length: count }, (_, i) => i),
    pathOffsets: new Uint32Array([0, count]),
    strokes: [null],
    linewidth: 2,
    alpha: 1,
    curve: "linear",
  };
}

function rects(count: number, seed: number): GeometryBatch {
  const next = seeded(seed);
  const values = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    values[i * 4] = next() * WIDTH;
    values[i * 4 + 1] = next() * HEIGHT;
    values[i * 4 + 2] = 1 + next() * 2;
    values[i * 4 + 3] = 1 + next() * 2;
  }
  return {
    kind: "rects",
    layerIndex: 0,
    panelIndex: 0,
    rects: values,
    rowIndex: Uint32Array.from({ length: count }, (_, i) => i),
    fill: null,
    alpha: 1,
  };
}

/** Short segments: half tall (auto mode x), half wide (auto mode y). */
function segments(count: number, seed: number): GeometryBatch {
  const next = seeded(seed);
  const values = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const x = next() * WIDTH;
    const y = next() * HEIGHT;
    values[i * 4] = x;
    values[i * 4 + 1] = y;
    values[i * 4 + 2] = x + (i % 2 === 0 ? 0.5 : 4);
    values[i * 4 + 3] = y + (i % 2 === 0 ? 4 : 0.5);
  }
  return {
    kind: "segments",
    layerIndex: 0,
    panelIndex: 0,
    segments: values,
    rowIndex: Uint32Array.from({ length: count }, (_, i) => i),
    stroke: null,
    linewidth: 1,
    alpha: 1,
  };
}

/** One closed band: upper edge left to right, lower edge right to left. */
function filledBand(count: number, layerIndex = 0): GeometryBatch {
  const half = Math.floor(count / 2);
  const positions = new Float32Array(half * 4);
  for (let i = 0; i < half; i++) {
    positions[i * 2] = (i / half) * WIDTH;
    positions[i * 2 + 1] = 30;
    positions[(half * 2 - 1 - i) * 2] = (i / half) * WIDTH;
    positions[(half * 2 - 1 - i) * 2 + 1] = 90;
  }
  return {
    kind: "paths",
    layerIndex,
    panelIndex: 0,
    positions,
    rowIndex: Uint32Array.from({ length: half * 2 }, (_, i) => i),
    pathOffsets: new Uint32Array([0, half * 2]),
    fills: [null],
    strokes: [null],
    linewidth: 1,
    alpha: 1,
    curve: "linear",
  };
}

function plot(batches: readonly GeometryBatch[], panels = 1): Scene {
  const result = scene();
  result.batches = [...batches];
  result.panels = Array.from({ length: panels }, (_, index) => ({
    ...result.panels[0]!,
    id: `panel:${index}`,
  }));
  return result;
}

// Every third candidate has no x value and every fifth has no y value, so the
// axis modes also reject candidates that a strip finds.
const options: CandidateStoreOptions = {
  hitTolerance: 3,
  datum: ({ primitiveIndex }) => ({
    xValue: primitiveIndex % 3 === 0 ? null : primitiveIndex,
    yValue: primitiveIndex % 5 === 0 ? null : primitiveIndex,
  }),
};

const SCENES: Record<string, { scene: () => Scene; options?: CandidateStoreOptions }> = {
  scatter: { scene: () => plot([points(COUNT, 3)]) },
  line: { scene: () => plot([line(COUNT, 5)]) },
  "line flipped": { scene: () => plot([line(COUNT, 5)]), options: { flip: true } },
  "points and line": { scene: () => plot([points(COUNT, 7), line(COUNT, 11, 1)]) },
  rects: { scene: () => plot([rects(COUNT, 13)]) },
  segments: { scene: () => plot([segments(COUNT, 17)]) },
  "segments flipped": { scene: () => plot([segments(COUNT, 17)]), options: { flip: true } },
  "points and filled band": { scene: () => plot([filledBand(COUNT), points(COUNT, 19, 0, 1)]) },
  "two panels": { scene: () => plot([points(COUNT, 23, 0), points(COUNT, 29, 1, 1)], 2) },
  "points on a coarse grid": {
    scene: () => {
      const batch = points(COUNT, 31);
      if (batch.kind !== "points") throw new Error("expected points");
      batch.positions = batch.positions.map((value) => Math.round(value / 10) * 10);
      return plot([batch]);
    },
  },
};

function build(name: string) {
  const entry = SCENES[name]!;
  return { scene: entry.scene(), options: { ...options, ...entry.options } };
}

function probes(store: { x: Float32Array; y: Float32Array }) {
  const next = seeded(37);
  const result: [number, number][] = [];
  for (let i = 0; i < 16; i++) result.push([next() * 240 - 20, next() * 160 - 20]);
  // On a candidate, and at the radii of a search with several passes.
  for (const offset of [0, 1.5, -1.5, 6, -6, 24]) {
    const id = Math.floor(next() * store.x.length);
    result.push([store.x[id]! + offset, store.y[id]!], [store.x[id]!, store.y[id]! + offset]);
  }
  return result;
}

/** The same search through `findNearest`, with every candidate on the shortlist. */
function scanEveryCandidate(plotScene: Scene, storeOptions: CandidateStoreOptions) {
  const indexes = buildCandidateStoreIndexes(plotScene, storeOptions);
  const hit = createHitGeometry(indexes);
  const { isFilledPath, filledSpanStart, filledSpanEnd } = buildSpatialIndex(indexes, hit);
  const every = Array.from({ length: indexes.n }, (_, i) => indexes.n - 1 - i);
  const query = {
    shortlistNearest: () => every,
    firstNearestRadius: (_mode: CandidateInspectMode, maxDistance: number) => maxDistance,
  };
  return (
    px: number,
    py: number,
    search: { mode: CandidateInspectMode; maxDistance: number; panelId?: string },
  ) =>
    findNearest(
      {
        flip: indexes.flip,
        autoModes: indexes.autoModes,
        xTokenIds: indexes.xTokenIds,
        yTokenIds: indexes.yTokenIds,
        xs: indexes.xs,
        ys: indexes.ys,
        filledSpanStart,
        filledSpanEnd,
        probe: hit.probePoint(px, py),
        panelIds: indexes.panelIds,
        scene: plotScene,
        query,
        indexesFact: (id) => indexes.fact(id),
        isFilledPath,
      },
      px,
      py,
      search,
    );
}

const summary = (match: { id: number; distance: number; mode: string } | null) =>
  match === null ? "none" : `${match.id} ${match.mode} ${match.distance}`;

// Math.hypot can differ in its last digit between machines.
const pinned = (match: { id: number; distance: number; mode: string } | null) =>
  match === null ? "none" : `${match.id} ${match.mode} ${match.distance.toPrecision(10)}`;

describe("nearest shortlist", () => {
  for (const name of Object.keys(SCENES)) {
    it(`equals a scan of every candidate: ${name}`, () => {
      const { scene: plotScene, options: storeOptions } = build(name);
      const store = buildCandidateStore(plotScene, storeOptions);
      const scan = scanEveryCandidate(plotScene, storeOptions);
      const panelIds = plotScene.panels.length > 1 ? [undefined, "panel:1"] : [undefined];
      for (const [px, py] of probes(store)) {
        for (const mode of MODES) {
          for (const maxDistance of [24, 1.5]) {
            for (const panelId of panelIds) {
              const search = { mode, maxDistance, ...(panelId === undefined ? {} : { panelId }) };
              expect(summary(store.nearest(px, py, search))).toBe(summary(scan(px, py, search)));
            }
          }
        }
      }
    });

    // Written on the code before the narrow shortlist: the scan above is a reference
    // for later changes, and this snapshot shows that the results did not change.
    it(`pins the result: ${name}`, () => {
      const { scene: plotScene, options: storeOptions } = build(name);
      const store = buildCandidateStore(plotScene, storeOptions);
      const results: Record<string, string[]> = {};
      for (const mode of MODES) {
        results[mode] = probes(store).map(([px, py]) =>
          pinned(store.nearest(px, py, { mode, maxDistance: 24 })),
        );
      }
      expect(results).toMatchSnapshot();
    });
  }

  it("pins the result for NaN, negative, zero, infinite and extreme radii", () => {
    const { scene: plotScene, options: storeOptions } = build("points and line");
    const store = buildCandidateStore(plotScene, storeOptions);
    const [px, py] = [store.x[7]!, store.y[7]!];
    const results: Record<string, string> = {};
    for (const mode of MODES) {
      for (const maxDistance of [
        Number.NaN,
        -1,
        0,
        Number.POSITIVE_INFINITY,
        Number.MAX_VALUE,
        Number.MIN_VALUE,
      ]) {
        results[`${mode} ${maxDistance}`] = pinned(store.nearest(px, py, { mode, maxDistance }));
      }
    }
    expect(results).toMatchSnapshot();
  });

  function shortlist(plotScene: Scene, storeOptions: CandidateStoreOptions = {}) {
    const indexes = buildCandidateStoreIndexes(plotScene, storeOptions);
    return { indexes, query: buildSpatialIndex(indexes, createHitGeometry(indexes)) };
  }

  it("auto mode shortlists only the point anchors in hit reach on a scatter", () => {
    const { indexes, query } = shortlist(plot([points(COUNT, 3)]));
    const [px, py] = [100, 60];
    const reach = query.maxPointReach;
    let inReach = 0;
    for (let id = 0; id < indexes.n; id++) {
      if (Math.abs(indexes.xs[id]! - px) <= reach && Math.abs(indexes.ys[id]! - py) <= reach) {
        inReach++;
      }
    }
    expect(query.shortlistNearest(px, py, "auto", 24).length).toBe(inReach);
  });

  it("auto mode searches only the x strip on a line chart, and the y strip when flipped", () => {
    const radius = 24;
    // A vertex can reach the search box through its stroke and hit tolerance.
    const pad = radius + 5;
    const plain = shortlist(plot([line(COUNT, 5)]));
    for (const id of plain.query.shortlistNearest(100, 60, "auto", radius)) {
      expect(Math.abs(plain.indexes.xs[id]! - 100)).toBeLessThanOrEqual(pad);
    }
    const flipped = shortlist(plot([line(COUNT, 5)]), { flip: true });
    // The line stays between y = 40 and y = 80, so a strip at y = 110 holds nothing.
    expect(flipped.query.shortlistNearest(100, 110, "auto", radius)).toEqual([]);
    const onLine = flipped.query.shortlistNearest(100, 60, "auto", radius);
    expect(onLine.length).toBeGreaterThan(0);
    for (const id of onLine) {
      expect(Math.abs(flipped.indexes.ys[id]! - 60)).toBeLessThanOrEqual(pad);
    }
  });

  it("the narrow pass holds about the same number of candidates at any chart size", () => {
    const sizes = [5000, 20_000, 80_000].map((count) => {
      const { query } = shortlist(plot([points(count, 41)]));
      const radius = query.firstNearestRadius("x", 24);
      return query.shortlistNearest(100, 60, "x", radius).length;
    });
    expect(Math.max(...sizes) / Math.min(...sizes)).toBeLessThan(1.5);
  });

  it("searches the full radius in one pass when more passes cannot help", () => {
    const large = shortlist(plot([points(COUNT, 3)])).query;
    expect(large.firstNearestRadius("x", 24)).toBeLessThan(24);
    expect(large.firstNearestRadius("exact", 24)).toBe(24);
    // Exact-only anchors match at any radius, so auto mode needs one pass.
    expect(large.firstNearestRadius("auto", 24)).toBe(24);
    expect(shortlist(plot([line(COUNT, 5)])).query.firstNearestRadius("auto", 24)).toBeLessThan(24);
    expect(shortlist(plot([points(4096, 3)])).query.firstNearestRadius("x", 24)).toBe(24);
    // Each pass scans every vertex of each filled span that crosses a strip.
    const filled = shortlist(plot([filledBand(COUNT), points(COUNT, 19, 0, 1)])).query;
    expect(filled.firstNearestRadius("x", 24)).toBe(24);
  });
});
