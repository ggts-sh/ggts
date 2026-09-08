/**
 * M2 pipeline — geom_map fortified region join (#808).
 */
import { describe, expect, it, spyOn } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import { buildMapFrame, resolveMapJoinIndex } from "../../src/pipeline/frame-stats-map.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { ColumnTable } from "../../src/table.ts";

const size = { width: 400, height: 300 };

/** Two triangles (regions A, B) with long/lat + region id. */
const fortified = {
  long: [0, 1, 0.5, 2, 3, 2.5],
  lat: [0, 0, 1, 0, 0, 1],
  region: ["A", "A", "A", "B", "B", "B"],
};

const values = {
  state: ["A", "B"],
  rate: [10, 20],
};

function pathBatch(model: ReturnType<typeof runPipeline>): PathsBatch {
  const batch = model.scene.batches[0] as PathsBatch;
  expect(batch.kind).toBe("paths");
  return batch;
}

describe("geom_map", () => {
  it("joins value rows to fortified map and emits closed filled paths", () => {
    const model = runPipeline(
      gg(values, aes({ map_id: "state", fill: "rate" }))
        .geomMap({ map: { columns: fortified } })
        .spec(),
      size,
    );
    const batch = pathBatch(model);
    expect(batch.closed).toBe(true);
    expect(batch.pathOffsets.length - 1).toBe(2);
    expect(batch.fills?.length).toBe(2);
    expect(batch.fills![0]).not.toBe(batch.fills![1]);
    // 3 vertices per region
    expect(batch.pathOffsets[1]! - batch.pathOffsets[0]!).toBe(3);
    expect(batch.pathOffsets[2]! - batch.pathOffsets[1]!).toBe(3);
  });

  it("accepts x/y map coordinates and custom mapId column", () => {
    const model = runPipeline(
      gg({ id: ["north"], score: [1] }, aes({ map_id: "id", fill: "score" }))
        .geomMap({
          map: {
            values: [
              { x: 0, y: 0, zone: "north" },
              { x: 1, y: 0, zone: "north" },
              { x: 0.5, y: 1, zone: "north" },
            ],
          },
          mapId: "zone",
        })
        .spec(),
      size,
    );
    const batch = pathBatch(model);
    expect(batch.closed).toBe(true);
    expect(batch.pathOffsets.length - 1).toBe(1);
  });

  it("splits multipoly rings via optional group column", () => {
    const model = runPipeline(
      gg({ state: ["A"], rate: [5] }, aes({ map_id: "state", fill: "rate" }))
        .geomMap({
          map: {
            values: [
              { long: 0, lat: 0, region: "A", group: 1 },
              { long: 1, lat: 0, region: "A", group: 1 },
              { long: 0.5, lat: 1, region: "A", group: 1 },
              { long: 3, lat: 0, region: "A", group: 2 },
              { long: 4, lat: 0, region: "A", group: 2 },
              { long: 3.5, lat: 1, region: "A", group: 2 },
            ],
          },
        })
        .spec(),
      size,
    );
    const batch = pathBatch(model);
    expect(batch.pathOffsets.length - 1).toBe(2);
    // Same fill on both rings (style from one value row)
    expect(batch.fills![0]).toBe(batch.fills![1]);
  });

  it("warns and drops value rows with no matching map region", () => {
    const model = runPipeline(
      gg({ state: ["A", "missing"], rate: [10, 99] }, aes({ map_id: "state", fill: "rate" }))
        .geomMap({ map: { columns: fortified } })
        .spec(),
      size,
    );
    expect(model.warnings.some((w) => w.code === "map-region-missing")).toBe(true);
    const batch = pathBatch(model);
    expect(batch.pathOffsets.length - 1).toBe(1);
  });

  it("uses exact auto hit mode for region selection", () => {
    const model = runPipeline(
      gg(values, aes({ map_id: "state", fill: "rate" }))
        .geomMap({ map: { columns: fortified } })
        .spec(),
      size,
    );
    expect(model.candidates.candidate(0)?.autoMode).toBe("exact");
  });

  it("attaches closedFrameRows so coord-projected hits map to the correct region (#808)", () => {
    const model = runPipeline(
      gg(values, aes({ map_id: "state", fill: "rate" }))
        .geomMap({ map: { columns: fortified } })
        // Flip so the projector remaps path vertices; lineage must stay
        // per-vertex (not ribbon 2×N topology).
        .coordFlip()
        .spec(),
      size,
    );
    const batch = pathBatch(model);
    expect(batch.closedFrameRows).toBeDefined();
    expect(batch.closedFrameRows!.length).toBe(batch.positions.length / 2);
    // Region A then B: three vertices each, frame rows index the expanded frame.
    const aRow = batch.closedFrameRows![0]!;
    const bRow = batch.closedFrameRows![3]!;
    expect(aRow).not.toBe(bRow);
    // Source value rows: A→0, B→1
    expect(batch.rowIndex[0]).toBe(0);
    expect(batch.rowIndex[3]).toBe(1);
  });

  it("throws map-data-required when params.map is absent (frame expand)", () => {
    // Schema already requires params.map; this guards buildMapFrame when a
    // PortableSpec reaches the pipeline without that property.
    try {
      buildMapFrame(
        {
          layer: { geom: "map", params: {} },
          index: 0,
          mapIdField: "state",
        } as never,
        ColumnTable.fromRows([{ state: "A" }]),
        [0],
        [],
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("map-data-required");
    }
  });

  it("requires map_id channel", () => {
    try {
      runPipeline(
        gg(values, aes({ fill: "rate" }))
          .geomMap({ map: { columns: fortified } })
          .spec(),
        size,
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("missing-channel");
    }
  });

  it("errors when map lacks coordinate columns", () => {
    try {
      runPipeline(
        gg(values, aes({ map_id: "state" }))
          .geomMap({
            map: {
              values: [{ region: "A" }, { region: "A" }, { region: "A" }],
            },
          })
          .spec(),
        size,
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("map-coords-missing");
    }
  });

  it("trains position domains from map vertices (no zero baseline invent)", () => {
    const model = runPipeline(
      gg({ state: ["A"], rate: [1] }, aes({ map_id: "state", fill: "rate" }))
        .geomMap({
          map: {
            values: [
              { long: 2, lat: 5, region: "A" },
              { long: 4, lat: 5, region: "A" },
              { long: 3, lat: 8, region: "A" },
            ],
          },
        })
        .spec(),
      size,
    );
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[0]).toBeLessThanOrEqual(2);
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(4);
    }
    if (model.scales.y.type !== "band") {
      // 5% display expansion may pad slightly outside [5,8]; no forced zero.
      expect(model.scales.y.domain[0]).toBeGreaterThan(0);
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(5);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(8);
    }
  });

  it("resolves named map datasets from spec.datasets", () => {
    const base = gg(values, aes({ map_id: "state", fill: "rate" }))
      .geomMap({ map: { name: "states" } })
      .spec();
    const model = runPipeline({ ...base, datasets: { states: { columns: fortified } } }, size);
    const batch = pathBatch(model);
    expect(batch.pathOffsets.length - 1).toBe(2);
  });

  it("errors when explicit mapId column is missing (no silent fallback)", () => {
    expect(() =>
      runPipeline(
        gg({ state: ["A"], rate: [1] }, aes({ map_id: "state", fill: "rate" }))
          .geomMap({
            map: {
              values: [
                { long: 0, lat: 0, region: "A" },
                { long: 1, lat: 0, region: "A" },
                { long: 0.5, lat: 1, region: "A" },
              ],
            },
            mapId: "zone_typo",
          })
          .spec(),
        size,
      ),
    ).toThrow(/map-id-column-missing|zone_typo/);
  });

  it("memoizes fortified map table + byKey once per layer across facet panels (#910)", () => {
    // Pre-fix: buildMapFrame called ColumnTable.fromColumns(map) once per panel.
    const fromColumns = spyOn(ColumnTable, "fromColumns");
    try {
      const model = runPipeline(
        gg(
          {
            state: ["A", "B", "A", "B"],
            rate: [10, 20, 11, 21],
            panel: ["p1", "p1", "p2", "p2"],
          },
          aes({ map_id: "state", fill: "rate" }),
        )
          .geomMap({ map: { columns: fortified } })
          .facet({ wrap: "panel" })
          .spec(),
        size,
      );
      expect(model.scene.panels.length).toBe(2);
      // Two region paths total still materialise across panels.
      const batch = pathBatch(model);
      expect(batch.pathOffsets.length - 1).toBeGreaterThanOrEqual(2);
      const mapBuilds = fromColumns.mock.calls.filter((args) => args[0] === fortified).length;
      expect(mapBuilds).toBe(1);
    } finally {
      fromColumns.mockRestore();
    }
  });

  it("emits map-region-missing at most once per layer under facets (#910)", () => {
    const model = runPipeline(
      gg(
        {
          state: ["A", "missing", "B", "also-missing"],
          rate: [10, 1, 20, 2],
          panel: ["p1", "p1", "p2", "p2"],
        },
        aes({ map_id: "state", fill: "rate" }),
      )
        .geomMap({ map: { columns: fortified } })
        .facet({ wrap: "panel" })
        .spec(),
      size,
    );
    expect(model.scene.panels.length).toBe(2);
    const missing = model.warnings.filter((w) => w.code === "map-region-missing");
    expect(missing).toHaveLength(1);
  });

  it("resolveMapJoinIndex returns the same object for the same binding", () => {
    const binding = {
      layer: { geom: "map", params: { map: { columns: fortified } } },
      index: 0,
      mapIdField: "state",
    } as never;
    const a = resolveMapJoinIndex(binding);
    const b = resolveMapJoinIndex(binding);
    expect(a).toBe(b);
    expect(a.byKey.get("A")?.length).toBe(3);
  });
});
