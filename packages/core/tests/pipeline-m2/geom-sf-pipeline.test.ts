/**
 * M2 pipeline — geom_sf portable GeoJSON geometries (#809 phase 1).
 * Pipeline family: hit-testing mode, scale domain training, error paths and
 * the empty-scene degenerate case.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import { geo, polyA, size } from "./geom-sf-fixtures.ts";

describe("geom_sf", () => {
  it("uses exact auto hit mode", () => {
    const model = runPipeline(
      gg({ geometry: [polyA] }, aes({}))
        .geomSf()
        .spec(),
      size,
    );
    expect(model.candidates.candidate(0)?.autoMode).toBe("exact");
  });

  it("trains domains from geometry coordinates without aes.x/y", () => {
    const model = runPipeline(
      gg(
        {
          geometry: [
            geo({
              type: "Polygon",
              coordinates: [
                [
                  [2, 5],
                  [4, 5],
                  [3, 8],
                  [2, 5],
                ],
              ],
            }),
          ],
        },
        aes({}),
      )
        .geomSf()
        .spec(),
      size,
    );
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[0]).toBeLessThanOrEqual(2);
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(4);
    }
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[0]).toBeGreaterThan(0);
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(5);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(8);
    }
  });

  it("errors when geometry column is missing", () => {
    try {
      runPipeline(
        gg({ x: [1] }, aes({}))
          .geomSf()
          .spec(),
        size,
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("sf-geometry-missing");
    }
  });

  it("errors on mixed geometry families in one layer", () => {
    try {
      runPipeline(
        gg(
          {
            geometry: [polyA, geo({ type: "Point", coordinates: [0, 0] })],
          },
          aes({}),
        )
          .geomSf()
          .spec(),
        size,
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("sf-geometry-mixed");
    }
  });

  it("errors when GeometryCollection mixes geometry families", () => {
    try {
      runPipeline(
        gg(
          {
            geometry: [
              geo({
                type: "GeometryCollection",
                geometries: [
                  { type: "Point", coordinates: [0, 0] },
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
                ],
              }),
            ],
          },
          aes({}),
        )
          .geomSf()
          .spec(),
        size,
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("sf-geometry-mixed");
    }
  });

  it("returns an empty scene for zero-row data instead of throwing", () => {
    const model = runPipeline(
      gg({ geometry: [] as string[], rate: [] as number[] }, aes({ fill: "rate" }))
        .geomSf()
        .spec(),
      size,
    );
    expect(model.scene.batches).toEqual([]);
    expect(model.warnings.some((w) => w.code === "empty-layer" || w.code === "empty-data")).toBe(
      true,
    );
  });
});
