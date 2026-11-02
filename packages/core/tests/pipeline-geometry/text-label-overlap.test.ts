import { describe, expect, it } from "bun:test";
import type { PortableSpec } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";

const size = { width: 400, height: 300 };

function spec(geom: "text" | "label"): PortableSpec {
  return {
    data: {
      values: [
        { x: 0, y: 0, label: "first" },
        { x: 0, y: 0, label: "second" },
        { x: 0, y: 0, label: "third" },
        { x: 10, y: 10, label: "apart" },
      ],
    },
    aes: { x: { field: "x" }, y: { field: "y" }, label: { field: "label" } },
    layers: [{ geom }],
  };
}

describe("text-label-overlap", () => {
  for (const geom of ["text", "label"] as const) {
    it(`counts overlapping ${geom} marks once, not pairs`, () => {
      const model = runPipeline(spec(geom), size);
      const warnings = model.warnings.filter((w) => w.code === "text-label-overlap");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.message).toMatch(/3 labels.*layer 0.*panel 0/);
      expect(model.scene.batches.find((b) => b.kind === "glyphs")?.texts).toEqual([
        "first",
        "second",
        "third",
        "apart",
      ]);
    });
    it(`keeps the first ${geom} and later non-overlapping marks in draw order`, () => {
      const input = spec(geom);
      input.layers[0]!.params = { checkOverlap: true };
      const model = runPipeline(input, size);
      const batch = model.scene.batches.find((b) => b.kind === "glyphs")!;
      expect(batch.texts).toEqual(["first", "apart"]);
      expect(Array.from(batch.rowIndex)).toEqual([0, 3]);
      expect(batch.positions.length).toBe(4);
      expect(batch.boxWidths!.length).toBe(2);
      expect(model.warnings.filter((w) => w.code === "text-label-overlap")).toEqual([]);
    });
  }
  it("does not compare labels across layers or facet panels", () => {
    const input = spec("text");
    input.data = {
      values: [
        { x: 0, y: 0, label: "a", panel: "a" },
        { x: 0, y: 0, label: "b", panel: "b" },
      ],
    };
    input.facet = { wrap: { field: "panel" } };
    input.layers.push({ geom: "label" });
    const model = runPipeline(input, size);
    expect(model.scene.batches.filter((b) => b.kind === "glyphs").map((b) => b.texts)).toEqual([
      ["a"],
      ["b"],
      ["a"],
      ["b"],
    ]);
    expect(model.warnings.filter((w) => w.code === "text-label-overlap")).toEqual([]);
  });

  it("keeps mapped styles aligned with surviving source rows", () => {
    const input = spec("label");
    input.aes = {
      ...input.aes,
      color: { field: "label" },
      fill: { field: "label" },
      size: { field: "x" },
      alpha: { field: "y" },
    };
    const before = runPipeline(input, size).scene.batches.find((b) => b.kind === "glyphs")!;
    input.layers[0]!.params = { checkOverlap: true };
    const after = runPipeline(input, size).scene.batches.find((b) => b.kind === "glyphs")!;
    expect(after.texts).toEqual(["first", "apart"]);
    for (const field of [
      "colors",
      "boxFills",
      "boxStrokes",
      "sizes",
      "alphas",
      "boxWidths",
      "boxHeights",
    ] as const) {
      expect(Array.from(after[field]!)).toEqual([before[field]![0]!, before[field]![3]!]);
    }
  });

  it("ignores empty, transparent, and fully clipped labels", () => {
    const input = spec("text");
    input.data = {
      values: [
        { x: 0, y: 0, label: "visible", opacity: 1 },
        { x: 0, y: 0, label: "", opacity: 1 },
        { x: 0, y: 0, label: "transparent", opacity: 0 },
        { x: 10, y: 10, label: "outside", opacity: 1 },
        { x: 10, y: 10, label: "also outside", opacity: 1 },
      ],
    };
    input.aes = { ...input.aes, alpha: { field: "opacity" } };
    input.scales = { alpha: { type: "identity" } };
    input.coord = {
      type: "transform",
      x: { transform: "identity", limits: [-1, 1] },
      y: { transform: "identity", limits: [-1, 1] },
    };
    expect(
      runPipeline(input, size).warnings.filter((w) => w.code === "text-label-overlap"),
    ).toEqual([]);
  });
  it("includes visible label boxes even when their text is empty", () => {
    const input = spec("label");
    input.data = {
      values: [
        { x: 0, y: 0, label: "" },
        { x: 0, y: 0, label: "visible" },
      ],
    };
    expect(
      runPipeline(input, size).warnings.find((w) => w.code === "text-label-overlap")?.message,
    ).toMatch(/2 labels/);
    input.layers[0]!.params = { checkOverlap: true };
    const model = runPipeline(input, size);
    expect(model.scene.batches.find((b) => b.kind === "glyphs")?.texts).toEqual([""]);
    expect(model.warnings.filter((w) => w.code === "text-label-overlap")).toEqual([]);
  });
});
