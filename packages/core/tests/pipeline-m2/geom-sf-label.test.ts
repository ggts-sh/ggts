/**
 * M2 pipeline — geom_sf_label boxed labels (#809 phase 3).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import { renderToSVGString } from "../../src/render-svg-full.ts";
import type { GlyphsBatch } from "../../src/scene.ts";
import { labelBoxOrigin } from "../../src/render-svg-marks.ts";

const size = { width: 400, height: 300 };

function geo(g: object): string {
  return JSON.stringify(g);
}

describe("labelBoxOrigin", () => {
  it("centers middle anchors and pins start/end", () => {
    expect(labelBoxOrigin(10, 20, 8, 4, "middle", 2)).toEqual({ x: 6, y: 18 });
    expect(labelBoxOrigin(10, 20, 8, 4, "start", 2)).toEqual({ x: 8, y: 18 });
    expect(labelBoxOrigin(10, 20, 8, 4, "end", 2)).toEqual({ x: 4, y: 18 });
  });
});

describe("geom_sf_label", () => {
  it("emits glyphs with measured background boxes", () => {
    const model = runPipeline(
      gg(
        {
          geometry: [geo({ type: "Point", coordinates: [1, 2] })],
          name: ["Region"],
        },
        aes({ label: "name" }),
      )
        .geomSfLabel({ padding: 4, radius: 2 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as GlyphsBatch;
    expect(batch.kind).toBe("glyphs");
    expect(batch.texts).toEqual(["Region"]);
    expect(batch.boxWidths).toBeDefined();
    expect(batch.boxHeights).toBeDefined();
    expect(batch.boxPadding).toBe(4);
    expect(batch.boxRadius).toBe(2);
    expect(batch.boxWidths![0]!).toBeGreaterThan(4);
    expect(batch.boxHeights![0]!).toBeGreaterThan(4);
  });

  it("renders box rect before text in SVG", () => {
    const spec = gg(
      {
        geometry: [geo({ type: "Point", coordinates: [0, 0] })],
        name: ["A"],
      },
      aes({ label: "name" }),
    )
      .geomSfLabel()
      .spec();
    const svg = renderToSVGString(spec, size);
    const rectAt = svg.indexOf("<rect ");
    const textAt = svg.indexOf("<text ");
    expect(rectAt).toBeGreaterThan(-1);
    expect(textAt).toBeGreaterThan(rectAt);
  });

  it("defaults stat to sf_coordinates", () => {
    const spec = gg(
      {
        geometry: [geo({ type: "Point", coordinates: [0, 0] })],
        name: ["z"],
      },
      aes({ label: "name" }),
    )
      .geomSfLabel()
      .spec();
    expect(spec.layers[0]?.stat).toBe("sf_coordinates");
    expect(spec.layers[0]?.geom).toBe("sf_label");
  });

  it("requires label channel", () => {
    try {
      runPipeline(
        gg({ geometry: [geo({ type: "Point", coordinates: [0, 0] })] }, aes({}))
          .geomSfLabel()
          .spec(),
        size,
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("missing-channel");
    }
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
        .geomSfLabel()
        .spec(),
      size,
    );
    expect(model.candidates.candidate(0)?.autoMode).toBe("exact");
  });
});
