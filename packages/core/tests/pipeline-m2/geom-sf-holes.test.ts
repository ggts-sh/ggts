/**
 * M2 pipeline — geom_sf portable GeoJSON geometries (#809 phase 1).
 * Hole family: interior rings as even-odd holes, hit-testing minus holes,
 * and hole topology remapping under nonlinear coord_transform.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { geo, size } from "./geom-sf-fixtures.ts";

describe("geom_sf", () => {
  it("draws interior rings as even-odd holes (no ignore warning)", () => {
    // Exterior triangle (0,0)-(4,0)-(2,4); hole triangle (1,1)-(2,1)-(1.5,2).
    const withHole = geo({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [2, 4],
          [0, 0],
        ],
        [
          [1, 1],
          [2, 1],
          [1.5, 2],
          [1, 1],
        ],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [withHole] }, aes({}))
        .geomSf()
        .spec(),
      size,
    );
    expect(model.warnings.some((w) => w.code === "sf-holes-ignored")).toBe(false);
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.pathOffsets.length - 1).toBe(1);
    // Exterior 3 verts + hole 3 verts (closing duplicates dropped).
    expect(batch.positions.length / 2).toBe(6);
    expect(batch.fillRule).toBe("evenodd");
    expect(batch.ringStarts).toBeDefined();
    expect([...batch.ringStarts!]).toEqual([3]);
  });

  it("hit-tests exterior minus holes (even-odd)", () => {
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
      gg({ geometry: [withHole] }, aes({}))
        .geomSf()
        .spec(),
      size,
    );
    // Map data → panel px via scales (linear trained on [0,10] × [0,10]).
    const panel = model.scene.panels[0]!;
    const toPlot = (dx: number, dy: number) => {
      const sx = model.scales.x;
      const sy = model.scales.y;
      if (sx.type === "band" || sy.type === "band") throw new Error("expected continuous");
      const nx = sx.normalizeTransformed(dx);
      const ny = sy.normalizeTransformed(dy);
      if (nx === undefined || ny === undefined) throw new Error("normalize failed");
      const px = panel.x + nx * panel.width;
      const py = panel.y + (1 - ny) * panel.height;
      return { px, py };
    };
    const exterior = toPlot(1, 1);
    const hole = toPlot(5, 5);
    expect(model.candidates.hitTest(exterior.px, exterior.py)).not.toBeNull();
    expect(model.candidates.hitTest(hole.px, hole.py)).toBeNull();
  });

  it("preserves even-odd holes under nonlinear coord_transform (#809 phase 9)", () => {
    // Diagonal edges under log10 (x only) need tessellation midpoints — axis-aligned
    // edges stay collinear after an x-only warp, so they never insert verts.
    // ringStarts must use post-projection indices (source [3] would be stale).
    const withHole = geo({
      type: "Polygon",
      coordinates: [
        [
          [1, 1],
          [100, 1],
          [50, 100],
          [1, 1],
        ],
        [
          [20, 20],
          [80, 20],
          [50, 50],
          [20, 20],
        ],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [withHole] }, aes({}))
        .geomSf()
        .scales({
          x: { type: "linear", domain: [1, 100], expand: { mult: 0, add: 0 } },
          y: { type: "linear", domain: [1, 100], expand: { mult: 0, add: 0 } },
        })
        .coordTransform({ x: { transform: "log10", expand: false } })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.closed).toBe(true);
    expect(batch.fillRule).toBe("evenodd");
    expect(batch.ringStarts).toBeDefined();
    expect(batch.ringStarts!.length).toBeGreaterThan(0);
    // Exterior+hole source had 6 verts; log tessellation grows past that so
    // remapped ringStarts cannot equal a naive source-index copy of [3].
    expect(batch.positions.length / 2).toBeGreaterThan(6);
    const holeBreak = batch.ringStarts![0]!;
    expect(holeBreak).toBeGreaterThan(3);
    expect(holeBreak).toBeLessThan(batch.positions.length / 2);

    const scenePanel = model.scene.panels[0]!;
    const vp = model.viewport.panel(scenePanel.id)!;
    const toPlot = (dx: number, dy: number) => {
      const rect = vp.project({
        x: { kind: "continuous", domain: [dx, dx] },
        y: { kind: "continuous", domain: [dy, dy] },
      });
      return { px: (rect.x0 + rect.x1) / 2, py: (rect.y0 + rect.y1) / 2 };
    };
    // Near exterior base (inside fill) vs triangular lake interior.
    const exterior = toPlot(50, 10);
    const hole = toPlot(50, 30);
    expect(model.candidates.hitTest(exterior.px, exterior.py)).not.toBeNull();
    expect(model.candidates.hitTest(hole.px, hole.py)).toBeNull();
  });

  it("drops multi-ring compounds with invalid verts under coord_transform", () => {
    // log10 + limits: projector builds on [1,100] but verts at x=0 are NaN
    // (same pattern as path-topology filled drop). Whole invalid compound drops;
    // valid compound keeps remapped hole topology only.
    const invalid = geo({
      type: "Polygon",
      coordinates: [
        [
          [0, 1],
          [10, 1],
          [10, 10],
          [0, 10],
          [0, 1],
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
    const valid = geo({
      type: "Polygon",
      coordinates: [
        [
          [20, 20],
          [40, 20],
          [40, 40],
          [20, 40],
          [20, 20],
        ],
        [
          [25, 25],
          [35, 25],
          [35, 35],
          [25, 35],
          [25, 25],
        ],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [invalid, valid] }, aes({}))
        .geomSf()
        .scales({
          x: { type: "linear", domain: [0, 100], expand: { mult: 0, add: 0 } },
          y: { type: "linear", domain: [0, 100], expand: { mult: 0, add: 0 } },
        })
        .coordTransform({
          x: { transform: "log10", limits: [1, 100], expand: false },
        })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    // Only the valid compound remains as a filled subpath.
    expect(batch.pathOffsets.length - 1).toBe(1);
    expect(batch.fillRule).toBe("evenodd");
    expect(batch.ringStarts).toBeDefined();
    expect(batch.ringStarts!.length).toBe(1);
    // Single surviving compound: one interior-ring break strictly inside path.
    const start = batch.pathOffsets[0]!;
    const end = batch.pathOffsets[1]!;
    const breakAt = batch.ringStarts![0]!;
    expect(breakAt).toBeGreaterThan(start);
    expect(breakAt).toBeLessThan(end);
    expect(model.warnings.some((w) => w.code === "coord-invalid-geometry")).toBe(true);
  });

  it("remaps MultiPolygon holes under nonlinear coord_transform", () => {
    // Diagonal first part tessellates under log10; second solid triangle has no hole.
    const multi = geo({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [1, 1],
            [100, 1],
            [50, 80],
            [1, 1],
          ],
          [
            [20, 15],
            [80, 15],
            [50, 40],
            [20, 15],
          ],
        ],
        [
          [
            [10, 85],
            [40, 85],
            [25, 100],
            [10, 85],
          ],
        ],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [multi] }, aes({}))
        .geomSf()
        .scales({
          x: { type: "linear", domain: [1, 100], expand: { mult: 0, add: 0 } },
          y: { type: "linear", domain: [1, 100], expand: { mult: 0, add: 0 } },
        })
        .coordTransform({ x: { transform: "log10", expand: false } })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.pathOffsets.length - 1).toBe(2);
    expect(batch.fillRule).toBe("evenodd");
    expect(batch.ringStarts).toBeDefined();
    // One hole break for the first compound only; second part is solid.
    expect(batch.ringStarts!.length).toBe(1);
    const start0 = batch.pathOffsets[0]!;
    const end0 = batch.pathOffsets[1]!;
    const start1 = batch.pathOffsets[1]!;
    const end1 = batch.pathOffsets[2]!;
    const holeBreak = batch.ringStarts![0]!;
    expect(holeBreak).toBeGreaterThan(start0);
    expect(holeBreak).toBeLessThan(end0);
    // Second compound has no interior break in ringStarts.
    expect(holeBreak < start1 || holeBreak >= end1).toBe(true);
    // Tessellation grew past the 6+3 source verts (closings dropped).
    expect(batch.positions.length / 2).toBeGreaterThan(9);

    const scenePanel = model.scene.panels[0]!;
    const vp = model.viewport.panel(scenePanel.id)!;
    const toPlot = (dx: number, dy: number) => {
      const rect = vp.project({
        x: { kind: "continuous", domain: [dx, dx] },
        y: { kind: "continuous", domain: [dy, dy] },
      });
      return { px: (rect.x0 + rect.x1) / 2, py: (rect.y0 + rect.y1) / 2 };
    };
    expect(model.candidates.hitTest(toPlot(50, 8).px, toPlot(50, 8).py)).not.toBeNull();
    expect(model.candidates.hitTest(toPlot(50, 25).px, toPlot(50, 25).py)).toBeNull();
    expect(model.candidates.hitTest(toPlot(25, 90).px, toPlot(25, 90).py)).not.toBeNull();
  });

  it("keeps MultiPolygon parts as separate compounds when one has a hole", () => {
    const multi = geo({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [0, 0],
            [2, 0],
            [1, 2],
            [0, 0],
          ],
          [
            [0.5, 0.4],
            [1.5, 0.4],
            [1, 1.2],
            [0.5, 0.4],
          ],
        ],
        [
          [
            [4, 0],
            [6, 0],
            [5, 2],
            [4, 0],
          ],
        ],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [multi] }, aes({}))
        .geomSf()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    // Two polygon parts → two path subpaths.
    expect(batch.pathOffsets.length - 1).toBe(2);
    expect(batch.fillRule).toBe("evenodd");
    // First part: 3 exterior + 3 hole; second part: 3 exterior.
    expect(batch.positions.length / 2).toBe(9);
  });

  it("preserves even-odd holes on GeometryCollection polygon leaves", () => {
    const gc = geo({
      type: "GeometryCollection",
      geometries: [
        {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [4, 0],
              [2, 4],
              [0, 0],
            ],
            [
              [1, 1],
              [2, 1],
              [1.5, 2],
              [1, 1],
            ],
          ],
        },
        {
          type: "Polygon",
          coordinates: [
            [
              [5, 0],
              [6, 0],
              [5.5, 1],
              [5, 0],
            ],
          ],
        },
      ],
    });
    const model = runPipeline(
      gg({ geometry: [gc] }, aes({}))
        .geomSf()
        .spec(),
      size,
    );
    expect(model.warnings.some((w) => w.code === "sf-holes-ignored")).toBe(false);
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.pathOffsets.length - 1).toBe(2);
    expect(batch.fillRule).toBe("evenodd");
    // First leaf: exterior 3 + hole 3; second leaf: exterior 3.
    expect(batch.positions.length / 2).toBe(9);
    expect(batch.ringStarts).toBeDefined();
    expect([...batch.ringStarts!]).toEqual([3]);
  });
});
