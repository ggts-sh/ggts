/**
 * Characterization tests for data-space position adjustments on LayerFrames.
 */
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { bindLayer } from "../src/pipeline/bind-layer.ts";
import { buildFrame } from "../src/pipeline/frame.ts";
import { barSlotKeys } from "../src/pipeline/position-bar.ts";
import { applyPosition } from "../src/pipeline/position.ts";
import { runPipeline } from "../src/pipeline.ts";
import { ColumnTable, type CellValue } from "../src/table.ts";
import type { Advisory, LayerFrame } from "../src/pipeline/types.ts";

const size = { width: 640, height: 400 };

describe("barSlotKeys", () => {
  it("prefers band categories, then numeric centers, else null", () => {
    const base = {
      xValues: null as CellValue[] | null,
      xNumeric: null as Float64Array | null,
    };
    expect(barSlotKeys(fromPartial<LayerFrame>(base))).toBeNull();
    expect(barSlotKeys(fromPartial<LayerFrame>({ ...base, xValues: ["a", "b"] }))).toEqual([
      "a",
      "b",
    ]);
    // Typed categories with colliding labels occupy distinct slots, matching
    // the band scale's typed identity (encodeKey: strings pass through).
    expect(barSlotKeys(fromPartial<LayerFrame>({ ...base, xValues: [1, "1"] }))).toEqual([
      "@n:1",
      "1",
    ]);
    expect(
      barSlotKeys(fromPartial<LayerFrame>({ ...base, xNumeric: Float64Array.of(1.5, 2.5) })),
    ).toEqual([1.5, 2.5]);
  });
});

describe("applyPosition — stack/fill/dodge on bars", () => {
  it("stacks grouped cols from zero baseline into ymin/ymax", () => {
    const table = ColumnTable.fromRows([
      { g: "a", cls: "x", y: 1 },
      { g: "a", cls: "y", y: 2 },
      { g: "b", cls: "x", y: 3 },
      { g: "b", cls: "y", y: 4 },
    ]);
    const binding = bindLayer(
      {
        geom: "col",
        aes: { x: { field: "g" }, y: { field: "y" }, fill: { field: "cls" } },
        position: "stack",
      },
      0,
      table,
      [],
    );
    const frame = buildFrame(binding, table, [], []);
    applyPosition(frame, [], table);
    expect(frame.ymin).not.toBeNull();
    expect(frame.ymax).not.toBeNull();
    // per x slot, stacked totals equal group y sums
    // first-seen group order: x then y for each band
    expect(frame.n).toBe(4);
    for (let i = 0; i < frame.n; i++) {
      expect(frame.ymax![i]!).toBeGreaterThan(frame.ymin![i]!);
    }
  });

  it("preserves non-finite pre-position y as NaN after stack rewrite (not 0)", () => {
    const table = ColumnTable.fromRows([
      { g: "a", cls: "x", y: 5 },
      { g: "a", cls: "y", y: Number.NaN },
    ]);
    const binding = bindLayer(
      {
        geom: "col",
        aes: { x: { field: "g" }, y: { field: "y" }, fill: { field: "cls" } },
        position: "stack",
      },
      0,
      table,
      [],
    );
    const frame = buildFrame(binding, table, [], []);
    // Force a non-finite measure so positionStack zero-heights it; rewrite
    // must not publish a hard 0 for tooltips.
    frame.yNumeric![1] = Number.NaN;
    applyPosition(frame, [], table);
    expect(Number.isNaN(frame.yNumeric![1])).toBe(true);
    expect(frame.yNumeric![0]).toBeCloseTo(5, 8);
  });

  it("dodges boxplots into per-slot indices", () => {
    const table = ColumnTable.fromRows([
      { g: "a", cls: "x", y: 1 },
      { g: "a", cls: "x", y: 2 },
      { g: "a", cls: "x", y: 3 },
      { g: "a", cls: "y", y: 4 },
      { g: "a", cls: "y", y: 5 },
      { g: "a", cls: "y", y: 6 },
    ]);
    const binding = bindLayer(
      {
        geom: "boxplot",
        aes: { x: { field: "g" }, y: { field: "y" }, fill: { field: "cls" } },
        position: "dodge",
      },
      0,
      table,
      [],
    );
    const frame = buildFrame(binding, table, [], []);
    applyPosition(frame, [], table);
    expect(frame.dodge).not.toBeNull();
    expect(frame.dodge!.slotCounts).toBeDefined();
    expect(new Set(frame.dodge!.slot).size).toBeGreaterThan(1);
  });
});

describe("applyPosition — jitter", () => {
  it("records seeded jitter advisory and offsets for points", () => {
    const table = ColumnTable.fromRows([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
    const binding = bindLayer(
      {
        geom: "point",
        aes: { x: { field: "x" }, y: { field: "y" } },
        position: "jitter",
        positionParams: { seed: 7, width: 0.2, height: 0.2 },
      },
      0,
      table,
      [],
    );
    const frame = buildFrame(binding, table, [], []);
    const advisories: Advisory[] = [];
    applyPosition(frame, advisories, table);
    expect(frame.offsetX).not.toBeNull();
    expect(frame.offsetY).not.toBeNull();
    expect(advisories.some((a) => a.code === "jitter-seeded")).toBe(true);
  });
});

describe("applyPosition via runPipeline (regression)", () => {
  it("stacked cols force zero and produce rects", () => {
    const model = runPipeline(
      gg(
        [
          { g: "a", cls: "x", y: 1 },
          { g: "a", cls: "y", y: 2 },
        ],
        aes({ x: "g", y: "y", fill: "cls" }),
      )
        .geomCol({ position: "stack" })
        .spec(),
      size,
    );
    expect(model.scene.batches.some((b) => b.kind === "rects")).toBe(true);
    expect(model.advisories.some((a) => a.code === "zero-forced")).toBe(true);
  });

  it("clips stacked rects to the panel when a pinned domain excludes zero (#1897)", () => {
    const model = runPipeline(
      gg(
        [
          { x: "one", g: "A", n: 100 },
          { x: "one", g: "B", n: 1 },
        ],
        aes({ x: "x", y: "n", fill: "g" }),
      )
        .geomCol({ position: "stack" })
        .scales({ y: { domain: [50, 150] } })
        .spec(),
      size,
    );
    const panel = model.scene.panels[0]!;
    const batch = model.scene.batches.find((b) => b.kind === "rects");
    if (batch?.kind !== "rects") throw new Error("expected rects");
    // Both segments survive: the in-domain run clipped at the panel edge, the
    // censored one collapsed to zero height — neither overflows the panel.
    expect(batch.rects.length).toBe(8);
    for (let i = 0; i < batch.rects.length; i += 4) {
      expect(batch.rects[i + 1]!).toBeGreaterThanOrEqual(0);
      expect(batch.rects[i + 1]! + batch.rects[i + 3]!).toBeLessThanOrEqual(panel.height);
    }
    // The 0 stack baseline projects below the panel; the rect bottoms clamp to it.
    expect(batch.rects[1]! + batch.rects[3]!).toBeCloseTo(panel.height, 5);
    expect(batch.rects[5]! + batch.rects[7]!).toBeCloseTo(panel.height, 5);
  });

  describe("stacked area under a pinned domain that excludes zero (#1905)", () => {
    const stackedArea = (rows: { x: number; g: string; n: number }[]) =>
      runPipeline(
        gg(rows, aes({ x: "x", y: "n", fill: "g" }))
          .geomArea({ position: "stack" })
          .scales({ y: { domain: [50, 150] } })
          .spec(),
        { width: 400, height: 400 },
      );
    const pathVertices = (model: ReturnType<typeof stackedArea>) => {
      const batch = model.scene.batches.find((b) => b.kind === "paths");
      if (batch?.kind !== "paths") throw new Error("expected paths");
      const out: [number, number][] = [];
      for (let i = 0; i < batch.positions.length; i += 2) {
        out.push([batch.positions[i]!, batch.positions[i + 1]!]);
      }
      return { batch, vertices: out };
    };

    it("keeps every path vertex inside the panel", () => {
      const model = stackedArea([
        { x: 1, g: "A", n: 60 },
        { x: 1, g: "B", n: 10 },
        { x: 2, g: "A", n: 70 },
        { x: 2, g: "B", n: 20 },
      ]);
      const panel = model.scene.panels[0]!;
      const { vertices } = pathVertices(model);
      expect(vertices.length).toBeGreaterThan(0);
      for (const [x, y] of vertices) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(panel.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(panel.height);
      }
    });

    it("clips an edge that leaves the panel at the crossing, not at the vertex", () => {
      // The upper edge of B stacks to 160 then 140. The default 5% expansion
      // puts the top of the panel at 155, so the edge crosses it a quarter of
      // the way between the two columns. Clamping the vertices alone would
      // bend that edge; the clipped edge must stay on the original line.
      const model = stackedArea([
        { x: 0, g: "A", n: 60 },
        { x: 0, g: "B", n: 100 },
        { x: 2, g: "A", n: 60 },
        { x: 2, g: "B", n: 80 },
      ]);
      const panel = model.scene.panels[0]!;
      const { vertices } = pathVertices(model);
      for (const [, y] of vertices) {
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(panel.height);
      }
      const onTop = vertices.filter(([, y]) => y === 0);
      const columns = vertices.map(([x]) => x);
      const left = Math.min(...columns);
      const crossing = left + 0.25 * (Math.max(...columns) - left);
      expect(onTop.some(([x]) => Math.abs(x - crossing) < 1e-3)).toBe(true);
    });

    it("keeps the vertex, row, and frame-row arrays the same length", () => {
      const { batch } = pathVertices(
        stackedArea([
          { x: 0, g: "A", n: 60 },
          { x: 0, g: "B", n: 100 },
          { x: 2, g: "A", n: 60 },
          { x: 2, g: "B", n: 80 },
        ]),
      );
      const count = batch.positions.length / 2;
      expect(batch.rowIndex.length).toBe(count);
      expect(batch.closedFrameRows?.length).toBe(count);
      expect(batch.pathOffsets.at(-1)).toBe(count);
    });

    it("leaves the path alone when the panel does not clip", () => {
      const spec = gg(
        [
          { x: 1, g: "A", n: 60 },
          { x: 2, g: "A", n: 70 },
        ],
        aes({ x: "x", y: "n", fill: "g" }),
      )
        .geomArea({ position: "stack" })
        .scales({ y: { domain: [50, 150] } })
        .spec();
      const model = runPipeline(
        { ...spec, coord: { type: "transform", clip: false } },
        { width: 400, height: 400 },
      );
      const { vertices } = pathVertices(model);
      expect(vertices.some(([, y]) => y > model.scene.panels[0]!.height)).toBe(true);
    });
  });
});
