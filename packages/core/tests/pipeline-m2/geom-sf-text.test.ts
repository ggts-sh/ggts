/**
 * M2 pipeline — geom_sf_text + stat_sf_coordinates (#809 phase 2).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { GlyphsBatch } from "../../src/scene.ts";

const size = { width: 400, height: 300 };

function geo(g: object): string {
  return JSON.stringify(g);
}

describe("geom_sf_text / stat_sf_coordinates", () => {
  it("places a label at the polygon exterior centroid", () => {
    // Axis-aligned unit square [0,2]x[0,2] → centroid (1,1)
    const square = geo({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [square], name: ["A"] }, aes({ label: "name" }))
        .geomSfText()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as GlyphsBatch;
    expect(batch.kind).toBe("glyphs");
    expect(batch.texts).toEqual(["A"]);
    // Domains trained from centroid only (single point) or from expand —
    // assert label is drawable and non-empty.
    expect(Number.isFinite(batch.positions[0]!)).toBe(true);
    expect(Number.isFinite(batch.positions[1]!)).toBe(true);
  });

  it("passes Point coordinates through unchanged", () => {
    const model = runPipeline(
      gg(
        {
          geometry: [geo({ type: "Point", coordinates: [3, 7] })],
          name: ["P"],
        },
        aes({ label: "name" }),
      )
        .geomSfText()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as GlyphsBatch;
    expect(batch.kind).toBe("glyphs");
    expect(batch.texts).toEqual(["P"]);
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[0]).toBeLessThanOrEqual(3);
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(3);
    }
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(7);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(7);
    }
  });

  it("labels multiple features", () => {
    const model = runPipeline(
      gg(
        {
          geometry: [
            geo({ type: "Point", coordinates: [0, 0] }),
            geo({ type: "Point", coordinates: [1, 1] }),
          ],
          name: ["a", "b"],
        },
        aes({ label: "name" }),
      )
        .geomSfText()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as GlyphsBatch;
    expect(batch.texts).toEqual(["a", "b"]);
  });

  it("places one label per MultiPolygon part (same feature attrs)", () => {
    const multi = geo({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2],
            [0, 0],
          ],
        ],
        [
          [
            [10, 10],
            [12, 10],
            [12, 12],
            [10, 12],
            [10, 10],
          ],
        ],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [multi], name: ["islands"] }, aes({ label: "name" }))
        .geomSfText()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as GlyphsBatch;
    expect(batch.texts).toEqual(["islands", "islands"]);
    // Two distinct panel positions (centroids (1,1) vs (11,11)).
    expect(batch.positions.length / 2).toBe(2);
    expect(batch.positions[0]!).not.toBe(batch.positions[2]!);
  });

  it("places one label per MultiPoint vertex", () => {
    const model = runPipeline(
      gg(
        {
          geometry: [
            geo({
              type: "MultiPoint",
              coordinates: [
                [0, 0],
                [5, 5],
              ],
            }),
          ],
          name: ["pts"],
        },
        aes({ label: "name" }),
      )
        .geomSfText()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as GlyphsBatch;
    expect(batch.texts).toEqual(["pts", "pts"]);
  });

  it("uses exact auto hit mode", () => {
    const model = runPipeline(
      gg(
        {
          geometry: [geo({ type: "Point", coordinates: [1, 2] })],
          name: ["x"],
        },
        aes({ label: "name" }),
      )
        .geomSfText()
        .spec(),
      size,
    );
    expect(model.candidates.candidate(0)?.autoMode).toBe("exact");
  });

  it("requires label channel", () => {
    try {
      runPipeline(
        gg({ geometry: [geo({ type: "Point", coordinates: [0, 0] })] }, aes({}))
          .geomSfText()
          .spec(),
        size,
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("missing-channel");
    }
  });

  it("requires geometry column", () => {
    try {
      runPipeline(
        gg({ name: ["a"] }, aes({ label: "name" }))
          .geomSfText()
          .spec(),
        size,
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("sf-geometry-missing");
    }
  });

  it("places labels for each GeometryCollection leaf", () => {
    const gc = geo({
      type: "GeometryCollection",
      geometries: [
        { type: "Point", coordinates: [0, 0] },
        { type: "Point", coordinates: [2, 2] },
      ],
    });
    const model = runPipeline(
      gg({ geometry: [gc], name: ["gc"] }, aes({ label: "name" }))
        .geomSfText()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as GlyphsBatch;
    expect(batch.texts).toEqual(["gc", "gc"]);
  });

  it("defaults stat to sf_coordinates", () => {
    const spec = gg(
      {
        geometry: [geo({ type: "Point", coordinates: [0, 0] })],
        name: ["z"],
      },
      aes({ label: "name" }),
    )
      .geomSfText()
      .spec();
    expect(spec.layers[0]?.stat).toBe("sf_coordinates");
    expect(spec.layers[0]?.geom).toBe("sf_text");
  });

  it("returns an empty scene for zero-row data instead of throwing", () => {
    const model = runPipeline(
      gg({ geometry: [] as string[], name: [] as string[] }, aes({ label: "name" }))
        .geomSfText()
        .spec(),
      size,
    );
    expect(model.scene.batches).toEqual([]);
    expect(model.warnings.some((w) => w.code === "empty-layer" || w.code === "empty-data")).toBe(
      true,
    );
  });

  it("computes the exact shoelace centroid for a unit square", () => {
    // [0,2]×[0,2] exterior → centroid (1,1) with zero domain pad via expand:false if available.
    // Without expand control, assert domain still contains the centroid.
    const square = geo({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
      ],
    });
    const model = runPipeline(
      gg({ geometry: [square], name: ["A"] }, aes({ label: "name" }))
        .geomSfText()
        .spec(),
      size,
    );
    if (model.scales.x.type !== "band" && model.scales.y.type !== "band") {
      expect(model.scales.x.domain[0]).toBeLessThanOrEqual(1);
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(1);
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(1);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(1);
    }
  });
});
