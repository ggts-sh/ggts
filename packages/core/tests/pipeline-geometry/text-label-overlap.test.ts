import { describe, expect, it } from "bun:test";
import type { PortableSpec } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { checkTextLabelOverlap } from "../../src/pipeline/text-label-overlap.ts";
import type { GlyphsBatch } from "../../src/scene.ts";
import type { PipelineWarning } from "../../src/pipeline/types.ts";

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

describe("checkTextLabelOverlap", () => {
  const WIDTH = 700;
  const HEIGHT = 420;

  type Label = {
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    alpha?: number;
  };

  function batchOf(labels: readonly Label[]): GlyphsBatch {
    return {
      kind: "glyphs",
      layerIndex: 0,
      panelIndex: 0,
      texts: labels.map((label, index) => label.text ?? `label ${index}`),
      positions: Float64Array.from(labels.flatMap((label) => [label.x, label.y])),
      rowIndex: Uint32Array.from(labels, (_, index) => index),
      boxWidths: Float64Array.from(labels, (label) => label.width),
      boxHeights: Float64Array.from(labels, (label) => label.height),
      alphas: Float64Array.from(labels, (label) => label.alpha ?? 1),
      alpha: 1,
      anchor: "middle",
      boxPadding: 2,
    } as unknown as GlyphsBatch;
  }

  function run(labels: readonly Label[], checkOverlap: boolean, clip = true, withBox = false) {
    const batch = batchOf(labels);
    const warnings: PipelineWarning[] = [];
    checkTextLabelOverlap(
      batch,
      { withBox, checkOverlap, width: WIDTH, height: HEIGHT, clip },
      warnings,
    );
    return { rows: Array.from(batch.rowIndex).join(","), warnings: warnings.map((w) => w.message) };
  }

  it("counts a kept label that only a dropped label with a lower index touches", () => {
    // Label 1 overlaps labels 0 and 2. Labels 0 and 2 do not overlap each other.
    const labels = [
      { x: 100, y: 100, width: 20, height: 10 },
      { x: 125, y: 100, width: 40, height: 10 },
      { x: 150, y: 100, width: 20, height: 10 },
    ];
    expect(run(labels, false).warnings[0]).toMatch(/^3 labels overlap/);
    expect(run(labels, true).rows).toBe("0,2");
  });

  it("does not count labels whose boxes only share an edge", () => {
    const labels = [
      { x: 100, y: 100, width: 40, height: 10 },
      { x: 136, y: 100, width: 40, height: 10 },
      { x: 172, y: 100, width: 40, height: 10 },
    ];
    expect(run(labels, false).warnings).toEqual([]);
  });

  function seeded(seed: number) {
    let state = seed;
    return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  }

  const COUNT = 80;
  const LAYOUTS: Record<string, () => Label[]> = {
    sparse: () => {
      const next = seeded(3);
      return Array.from({ length: COUNT }, () => ({
        x: next() * WIDTH,
        y: next() * HEIGHT,
        width: 10 + next() * 30,
        height: 8,
      }));
    },
    dense: () => {
      const next = seeded(5);
      return Array.from({ length: COUNT }, () => ({
        x: 300 + next() * 60,
        y: 200 + next() * 60,
        width: 10 + next() * 30,
        height: 10,
      }));
    },
    chain: () =>
      Array.from({ length: COUNT }, (_, index) => ({
        x: index * 8,
        y: 100,
        width: 12,
        height: 10,
      })),
    "one wide label": () => [
      { x: 350, y: 100, width: 690, height: 12 },
      ...Array.from({ length: COUNT - 1 }, (_, index) => ({
        x: index * 9,
        y: index % 2 === 0 ? 100 : 300,
        width: 6,
        height: 6,
      })),
    ],
    identical: () => Array.from({ length: COUNT }, () => ({ x: 50, y: 50, width: 20, height: 10 })),
    "outside the panel": () => {
      const next = seeded(7);
      return Array.from({ length: COUNT }, () => ({
        x: -200 + next() * (WIDTH + 400),
        y: -200 + next() * (HEIGHT + 400),
        width: 60,
        height: 30,
      }));
    },
    "one long row": () =>
      Array.from({ length: COUNT }, (_, index) => ({
        x: index * 40,
        y: 100,
        width: index % 9 === 0 ? 50 : 20,
        height: 10,
      })),
    "one long row and one long column": () =>
      Array.from({ length: COUNT }, (_, index) =>
        index % 2 === 0
          ? { x: index * 30, y: 100, width: 40, height: 10 }
          : { x: 100, y: index * 30, width: 10, height: 40 },
      ),
    "non-finite boxes and one far outlier": () => {
      const next = seeded(17);
      return Array.from({ length: COUNT }, (_, index) => ({
        x: index % 11 === 0 ? Number.NaN : next() * WIDTH,
        y: index % 13 === 0 ? Number.POSITIVE_INFINITY : index === 1 ? 1e9 : next() * HEIGHT,
        width: 30,
        height: index % 17 === 0 ? Number.NaN : 12,
      }));
    },
    "zero width, no text, and no alpha": () => {
      const next = seeded(11);
      return Array.from({ length: COUNT }, (_, index) => ({
        x: 100 + next() * 200,
        y: 100 + next() * 100,
        width: index % 7 === 0 ? 0 : 30,
        height: 12,
        ...(index % 5 === 0 ? { text: "" } : {}),
        ...(index % 3 === 0 ? { alpha: 0 } : {}),
      }));
    },
  };

  for (const [name, layout] of Object.entries(LAYOUTS)) {
    for (const checkOverlap of [false, true]) {
      for (const clip of [true, false]) {
        for (const withBox of [false, true]) {
          it(`pins the result: ${name}, checkOverlap ${checkOverlap}, clip ${clip}, box ${withBox}`, () => {
            expect(run(layout(), checkOverlap, clip, withBox)).toMatchSnapshot();
          });
        }
      }
    }
  }

  it("does not compare every pair of a dense label layer", () => {
    // Pairwise tests take about 2.3 s here; bands take about 8 ms.
    const next = seeded(13);
    const labels = Array.from({ length: 32_000 }, () => ({
      x: next() * WIDTH,
      y: next() * HEIGHT,
      width: 30 + next() * 30,
      height: 12,
    }));
    const started = performance.now();
    run(labels, false);
    expect(performance.now() - started).toBeLessThan(500);
  }, 30_000);

  it("does not compare every pair of one long row with clip off", () => {
    // Bands across the row take about 7 s here; bands along it take about 10 ms.
    const next = seeded(19);
    const labels = Array.from({ length: 64_000 }, () => ({
      x: next() * 1e6,
      y: 100,
      width: 10,
      height: 10,
    }));
    const started = performance.now();
    run(labels, false, false);
    expect(performance.now() - started).toBeLessThan(500);
  }, 30_000);
});
