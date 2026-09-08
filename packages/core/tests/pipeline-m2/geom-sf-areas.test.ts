/**
 * M2 pipeline — geom_sf portable GeoJSON geometries (#809 phase 1).
 * Polygon family: filled polygon rendering for Polygon, MultiPolygon and
 * GeometryCollection sources, plus params/stat surface basics.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { geo, polyA, polyB, size } from "./geom-sf-fixtures.ts";

describe("geom_sf", () => {
  it("renders closed filled polygons from GeoJSON Geometry strings", () => {
    const model = runPipeline(
      gg({ geometry: [polyA, polyB], rate: [10, 20] }, aes({ fill: "rate" }))
        .geomSf()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.closed).toBe(true);
    expect(batch.pathOffsets.length - 1).toBe(2);
    expect(batch.fills?.length).toBe(2);
    expect(batch.fills![0]).not.toBe(batch.fills![1]);
  });

  it("renders MultiPolygon as multiple closed rings", () => {
    const multi = geo({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [0.5, 1],
            [0, 0],
          ],
        ],
        [
          [
            [3, 0],
            [4, 0],
            [3.5, 1],
            [3, 0],
          ],
        ],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [multi], id: ["islands"] }, aes({ fill: "id" }))
        .geomSf()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.pathOffsets.length - 1).toBe(2);
  });

  it("renders GeometryCollection of polygons as multiple closed parts", () => {
    const gc = geo({
      type: "GeometryCollection",
      geometries: [
        {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [0.5, 1],
              [0, 0],
            ],
          ],
        },
        {
          type: "Polygon",
          coordinates: [
            [
              [3, 0],
              [4, 0],
              [3.5, 1],
              [3, 0],
            ],
          ],
        },
      ],
    });
    const model = runPipeline(
      gg({ geometry: [gc], id: ["parts"] }, aes({ fill: "id" }))
        .geomSf()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.pathOffsets.length - 1).toBe(2);
  });

  it("honors params.geometry column name", () => {
    const model = runPipeline(
      gg({ geom: [polyA], rate: [1] }, aes({ fill: "rate" }))
        .geomSf({ geometry: "geom" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.closed).toBe(true);
    expect(batch.pathOffsets.length - 1).toBe(1);
  });

  it("defaults stat to sf (ggplot2 stat_sf)", () => {
    const spec = gg({ geometry: [polyA] }, aes({}))
      .geomSf()
      .spec();
    expect(spec.layers[0]?.stat).toBe("sf");
  });
});
