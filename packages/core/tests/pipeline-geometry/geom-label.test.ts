/**
 * geom_label — text with background box (#792).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg, validate } from "@ggts-sh/spec";

import { createHitGeometry } from "../../src/candidate-hit-geometry.ts";
import { buildCandidateStoreIndexes } from "../../src/candidate-store-indexes.ts";
import { runPipeline } from "../../src/pipeline.ts";
import { renderToSVGString } from "../../src/render-svg-full.ts";
import type { GlyphsBatch, Scene } from "../../src/scene.ts";
import { fromPartial } from "@total-typescript/shoehorn";

const size = { width: 200, height: 100 };

describe("geom_label schema (#792)", () => {
  it("accepts label with x y label", () => {
    const result = validate(
      {
        data: { values: [{ x: 1, y: 2, name: "a" }] },
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          label: { field: "name" },
        },
        layers: [{ geom: "label" }],
      },
      {},
    );
    expect(result.ok).toBe(true);
  });

  it("rejects missing label channel at pipeline", () => {
    expect(() =>
      runPipeline(
        gg({ x: [1], y: [2] }, aes({ x: "x", y: "y" }))
          .geomLabel()
          .spec(),
        size,
      ),
    ).toThrow(/label/i);
  });

  it("builder sugar emits geom + box params", () => {
    const spec = gg({ x: [1], y: [2], name: ["a"] }, aes({ x: "x", y: "y", label: "name" }))
      .geomLabel({ padding: 4, radius: 2, linewidth: 1 })
      .spec();
    expect(spec.layers[0]?.geom).toBe("label");
    expect(spec.layers[0]?.params).toMatchObject({ padding: 4, radius: 2, linewidth: 1 });
  });

  it("supports nudge position like text", () => {
    const result = validate(
      {
        data: { values: [{ x: 1, y: 2, name: "a" }] },
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          label: { field: "name" },
        },
        layers: [{ geom: "label", position: "nudge", positionParams: { y: 0.1 } }],
      },
      {},
    );
    expect(result.ok).toBe(true);
  });
});

describe("geom_label geometry (#792)", () => {
  it("emits glyphs with precomputed box sizes", () => {
    const model = runPipeline(
      gg({ x: [1, 2], y: [1, 2], name: ["A", "BB"] }, aes({ x: "x", y: "y", label: "name" }))
        .geomLabel({ padding: 3, size: 12 })
        .spec(),
      size,
    );
    const glyphs = model.scene.batches.filter((b) => b.kind === "glyphs");
    expect(glyphs).toHaveLength(1);
    const batch = glyphs[0]!;
    expect(batch.texts).toEqual(["A", "BB"]);
    expect(batch.boxWidths).toBeInstanceOf(Float32Array);
    expect(batch.boxHeights).toBeInstanceOf(Float32Array);
    expect(batch.boxWidths!.length).toBe(2);
    expect(batch.boxHeights![0]!).toBeGreaterThan(0);
    // Longer text → wider box (measure-driven).
    expect(batch.boxWidths![1]!).toBeGreaterThan(batch.boxWidths![0]!);
    expect(batch.boxPadding).toBe(3);
    expect(batch.boxRadius).toBeDefined();
  });

  it("maps fill to box background colors", () => {
    const model = runPipeline(
      gg(
        { x: [1, 2], y: [1, 2], name: ["a", "b"], g: ["u", "v"] },
        aes({ x: "x", y: "y", label: "name", fill: "g" }),
      )
        .geomLabel()
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "glyphs") as GlyphsBatch;
    expect(batch.boxFills).toBeDefined();
    expect(batch.boxFills).toHaveLength(2);
    expect(batch.boxFills![0]).not.toBe(batch.boxFills![1]);
  });

  it("drops rows with missing labels", () => {
    const model = runPipeline(
      gg(
        { x: [1, 2, 3], y: [1, 2, 3], name: ["a", null, "c"] },
        aes({ x: "x", y: "y", label: "name" }),
      )
        .geomLabel()
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "glyphs") as GlyphsBatch;
    expect(batch.texts).toEqual(["a", "c"]);
    expect(batch.boxWidths!.length).toBe(2);
  });

  it("measures text extents on plain text but does not paint a label box", () => {
    // boxWidths/Heights are measured for inspect hover/pin chrome + hit AABB;
    // visual label chrome (fill/stroke/radius) stays geom_label-only.
    const model = runPipeline(
      gg({ x: [1], y: [1], name: ["a"] }, aes({ x: "x", y: "y", label: "name" }))
        .geomText()
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "glyphs") as GlyphsBatch;
    expect(batch.boxWidths).toBeInstanceOf(Float32Array);
    expect(batch.boxHeights).toBeInstanceOf(Float32Array);
    expect(batch.boxWidths!.length).toBe(1);
    expect(batch.boxWidths![0]!).toBeGreaterThan(0);
    expect(batch.boxFills).toBeUndefined();
    expect(batch.boxStroke).toBeUndefined();
    expect(batch.boxRadius).toBeUndefined();
  });
});

describe("geom_label render + hit (#792)", () => {
  it("SVG includes rounded rect before text for label", () => {
    const svg = renderToSVGString(
      gg({ x: [1], y: [1], name: ["Hi"] }, aes({ x: "x", y: "y", label: "name" }))
        .geomLabel({ radius: 4, padding: 2 })
        .spec(),
      size,
    );
    expect(svg).toContain('class="gg-batch gg-glyphs"');
    expect(svg).toMatch(/<rect[^>]*rx="/);
    expect(svg).toContain(">Hi</text>");
    // rect appears before text inside the glyphs group
    const group = svg.match(/class="gg-batch gg-glyphs"[\s\S]*?<\/g>/)?.[0] ?? "";
    expect(group.indexOf("<rect")).toBeLessThan(group.indexOf("<text"));
  });

  it("plain text SVG has no label rect", () => {
    const svg = renderToSVGString(
      gg({ x: [1], y: [1], name: ["Hi"] }, aes({ x: "x", y: "y", label: "name" }))
        .geomText()
        .spec(),
      size,
    );
    const group = svg.match(/class="gg-batch gg-glyphs"[\s\S]*?<\/g>/)?.[0] ?? "";
    expect(group).not.toContain("<rect");
  });

  it("hit AABB uses box extents when present", () => {
    const glyphs: GlyphsBatch = {
      kind: "glyphs",
      layerIndex: 0,
      panelIndex: 0,
      positions: new Float32Array([100, 50]),
      rowIndex: new Uint32Array([0]),
      texts: ["WWWW"],
      color: "#000",
      size: 11,
      anchor: "middle",
      alpha: 1,
      boxWidths: new Float32Array([40]),
      boxHeights: new Float32Array([20]),
      boxPadding: 3,
      boxRadius: 3,
    };
    const plot = fromPartial<Scene>({
      width: 200,
      height: 120,
      panels: [{ id: "p0", x: 0, y: 0, width: 200, height: 120 }],
      batches: [glyphs],
    });
    const indexes = buildCandidateStoreIndexes(plot, { hitTolerance: 0 });
    const hit = createHitGeometry(indexes);
    const [minX, minY, maxX, maxY] = hit.aabb(0);
    // Box AABB is 40×20 centered at (100,50) — not the 11px font pad.
    expect(maxX - minX).toBeCloseTo(40, 5);
    expect(maxY - minY).toBeCloseTo(20, 5);
    expect(minX).toBeCloseTo(80, 5);
    expect(minY).toBeCloseTo(40, 5);
  });
});
