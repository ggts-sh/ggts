/**
 * M2 pipeline — geom_sf portable GeoJSON geometries (#809 phase 1).
 * Path family: LineString and Point layers plus the pathData/ringStarts
 * ring-cutting contract shared by every paths-batch consumer.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { pathData } from "../../src/render-svg-marks.ts";
import type { PathsBatch, PointsBatch } from "../../src/scene.ts";
import { geo, size } from "./geom-sf-fixtures.ts";

describe("geom_sf", () => {
  it("renders LineString as open path in data order", () => {
    const line = geo({
      type: "LineString",
      coordinates: [
        [3, 30],
        [1, 10],
        [2, 20],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [line] }, aes({}))
        .geomSf()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.closed).toBeFalsy();
    // Data order preserved (first vertex is x=3 → largest pixel x under linear).
    expect(batch.positions[0]!).toBeGreaterThan(batch.positions[2]!);
  });

  it("renders Point geometries as a points batch", () => {
    const model = runPipeline(
      gg(
        {
          geometry: [
            geo({ type: "Point", coordinates: [1, 2] }),
            geo({ type: "Point", coordinates: [3, 4] }),
          ],
          g: ["a", "b"],
        },
        aes({ color: "g" }),
      )
        .geomSf()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.kind).toBe("points");
    expect(batch.positions.length / 2).toBe(2);
  });

  it("pathData with ringStarts emits separate exterior and hole rings", () => {
    const withHole = geo({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [3, 3],
          [7, 3],
          [7, 7],
          [3, 7],
          [3, 3],
        ],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [withHole], rate: [1] }, aes({ fill: "rate" }))
        .geomSf()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.fillRule).toBe("evenodd");
    expect(batch.ringStarts).toBeDefined();
    const d = pathData(
      batch.positions,
      batch.pathOffsets[0]!,
      batch.pathOffsets[1]!,
      batch.curve,
      true,
      batch.ringStarts,
    );
    // Two closed rings (exterior + hole) — each ends with Z; without ringStarts
    // the d would be a single M…Z joining exterior into the hole.
    const zCount = (d.match(/Z/g) ?? []).length;
    expect(zCount).toBe(2);
    expect((d.match(/M/g) ?? []).length).toBe(2);
  });

  it("pathData cuts each subpath only on its own ring starts", () => {
    // Two compounds, each with a hole: subpath 0 must not cut on subpath 1's
    // break, and subpath 1 must not cut on subpath 0's.
    const twoHoles = geo({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
          [
            [3, 3],
            [7, 3],
            [7, 7],
            [3, 7],
            [3, 3],
          ],
        ],
        [
          [
            [20, 0],
            [30, 0],
            [30, 10],
            [20, 10],
            [20, 0],
          ],
          [
            [23, 3],
            [27, 3],
            [27, 7],
            [23, 7],
            [23, 3],
          ],
        ],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [twoHoles] }, aes({}))
        .geomSf()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.pathOffsets.length - 1).toBe(2);
    const breaks = [...batch.ringStarts!];
    expect(breaks.length).toBe(2);
    // ringStarts is ascending, and one break lands in each subpath window.
    expect(breaks[0]!).toBeLessThan(breaks[1]!);
    expect(breaks[0]!).toBeGreaterThan(batch.pathOffsets[0]!);
    expect(breaks[0]!).toBeLessThan(batch.pathOffsets[1]!);
    expect(breaks[1]!).toBeGreaterThan(batch.pathOffsets[1]!);
    expect(breaks[1]!).toBeLessThan(batch.pathOffsets[2]!);

    for (let s = 0; s < 2; s++) {
      const d = pathData(
        batch.positions,
        batch.pathOffsets[s]!,
        batch.pathOffsets[s + 1]!,
        batch.curve,
        true,
        batch.ringStarts,
      );
      // Exactly two rings — the out-of-window break must not add a third.
      expect((d.match(/M/g) ?? []).length).toBe(2);
      expect((d.match(/Z/g) ?? []).length).toBe(2);
      // Same d the whole-batch break list and a window-local one produce.
      const own = batch.ringStarts!.filter(
        (b) => b > batch.pathOffsets[s]! && b < batch.pathOffsets[s + 1]!,
      );
      expect(d).toBe(
        pathData(
          batch.positions,
          batch.pathOffsets[s]!,
          batch.pathOffsets[s + 1]!,
          batch.curve,
          true,
          own,
        ),
      );
    }
  });

  it("emits ringStarts in ascending vertex order", () => {
    // Consumers window ringStarts by binary search and pair the cuts into
    // rings, so both producers must keep it ascending.
    const nested = geo({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
          [
            [1, 1],
            [4, 1],
            [4, 4],
            [1, 4],
            [1, 1],
          ],
          [
            [6, 6],
            [9, 6],
            [9, 9],
            [6, 9],
            [6, 6],
          ],
        ],
        [
          [
            [20, 0],
            [30, 0],
            [30, 10],
            [20, 10],
            [20, 0],
          ],
          [
            [23, 3],
            [27, 3],
            [27, 7],
            [23, 7],
            [23, 3],
          ],
        ],
      ],
    });
    const spec = gg({ geometry: [nested] }, aes({})).geomSf();
    const plain = runPipeline(spec.spec(), size);
    const plainBatch = plain.scene.batches[0] as PathsBatch;
    const plainBreaks = [...plainBatch.ringStarts!];
    expect(plainBreaks.length).toBe(3);
    for (let i = 1; i < plainBreaks.length; i++) {
      expect(plainBreaks[i]!).toBeGreaterThan(plainBreaks[i - 1]!);
    }

    // The coord path rewrites ringStarts to post-projection indices; that
    // remap must stay ascending too.
    const projected = runPipeline(
      gg({ geometry: [nested] }, aes({}))
        .geomSf()
        .scales({
          x: { type: "linear", domain: [1, 100], expand: { mult: 0, add: 0 } },
          y: { type: "linear", domain: [1, 100], expand: { mult: 0, add: 0 } },
        })
        .coordTransform({ x: { transform: "log10", expand: false } })
        .spec(),
      size,
    );
    const projectedBatch = projected.scene.batches[0] as PathsBatch;
    const projectedBreaks = [...projectedBatch.ringStarts!];
    expect(projectedBreaks.length).toBeGreaterThan(0);
    for (let i = 1; i < projectedBreaks.length; i++) {
      expect(projectedBreaks[i]!).toBeGreaterThan(projectedBreaks[i - 1]!);
    }
  });

  it("keeps the closing vertex on a closed LineString (open path draw)", () => {
    const closedLine = geo({
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [closedLine] }, aes({}))
        .geomSf()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.closed).toBeFalsy();
    // 4 vertices → 8 position floats (closing edge retained for open paths).
    expect(batch.positions.length).toBe(8);
  });

  it("honors params.size/alpha for Point sf layers", () => {
    const model = runPipeline(
      gg(
        {
          geometry: [geo({ type: "Point", coordinates: [1, 2] })],
        },
        aes({}),
      )
        .geomSf({ size: 12, alpha: 0.4 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.size).toBe(12);
    expect(batch.alpha).toBe(0.4);
  });

  it("applies coordTransform to Point sf layers", () => {
    // Points must take the early panel-frame projector (pathLike false for
    // sf.kind === "point"); otherwise dots sit on linear pixels under log10.
    const model = runPipeline(
      gg(
        {
          geometry: [
            geo({ type: "Point", coordinates: [10, 1] }),
            geo({ type: "Point", coordinates: [100, 1] }),
          ],
        },
        aes({}),
      )
        .geomSf()
        .scales({
          x: { type: "linear", domain: [1, 1000], expand: { mult: 0, add: 0 } },
          y: { type: "linear", domain: [0, 2], expand: { mult: 0, add: 0 } },
        })
        .coordTransform({ x: { transform: "log10", expand: false } })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.kind).toBe("points");
    const panelW = model.scene.panels[0]!.width;
    // log10 domain [0, 3]: 10 → 1/3, 100 → 2/3 of panel width.
    expect(batch.positions[0]).toBeCloseTo(panelW / 3, 1);
    expect(batch.positions[2]).toBeCloseTo((2 * panelW) / 3, 1);
  });

  it("honors params.linewidth/alpha for LineString sf layers", () => {
    const line = geo({
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [line] }, aes({}))
        .geomSf({ linewidth: 3.5, alpha: 0.25 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.linewidth).toBe(3.5);
    expect(batch.alpha).toBe(0.25);
  });
});
