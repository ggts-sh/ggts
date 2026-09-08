import { describe, expect, it } from "bun:test";

import { gg, aes } from "@ggts-sh/spec";

import { PipelineError, runPipeline } from "../src/pipeline.ts";
import type { PathsBatch, PointsBatch } from "../src/scene.ts";

const rows = [
  { x: 1, y: 10, cls: "a" },
  { x: 2, y: 20, cls: "b" },
  { x: 3, y: 15, cls: "a" },
  { x: 4, y: 25, cls: "b" },
];

const size = { width: 640, height: 400 };

function pointSpec() {
  return gg(rows, aes({ x: "x", y: "y", color: "cls" }))
    .geomPoint()
    .spec();
}

describe("runPipeline — basics", () => {
  it("produces a scene with one panel, axes, grid, and a points batch", () => {
    const model = runPipeline(pointSpec(), size);
    expect(model.scene.panels).toHaveLength(1);
    const panel = model.scene.panels[0]!;
    expect(panel.width).toBeGreaterThan(300);
    expect(panel.height).toBeGreaterThan(200);
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.kind).toBe("points");
    expect(batch.rowIndex.length).toBe(4);
    expect(batch.positions.length).toBe(8);
    // panel-local coords inside the panel
    for (let j = 0; j < 4; j++) {
      expect(batch.positions[j * 2]!).toBeGreaterThanOrEqual(0);
      expect(batch.positions[j * 2]!).toBeLessThanOrEqual(panel.width);
      expect(batch.positions[j * 2 + 1]!).toBeGreaterThanOrEqual(0);
      expect(batch.positions[j * 2 + 1]!).toBeLessThanOrEqual(panel.height);
    }
    expect(model.scene.axes.x.ticks.length).toBeGreaterThan(1);
    expect(model.scene.axes.x.title).toBe("x");
    expect(model.scene.axes.y.title).toBe("y");
  });

  it("run ids are monotonic", () => {
    const a = runPipeline(pointSpec(), size);
    const b = runPipeline(pointSpec(), size);
    expect(b.runId).toBeGreaterThan(a.runId);
  });

  it("emits scale-type advisories with override guidance", () => {
    const model = runPipeline(pointSpec(), size);
    const codes = model.advisories.map((a) => `${a.code}:${a.path}`);
    expect(codes).toContain("scale-type-inferred:scales.x");
    expect(codes).toContain("scale-type-inferred:scales.y");
    expect(codes).toContain("palette-inferred:scales.color");
    for (const advisory of model.advisories) {
      expect(advisory.chosen.length).toBeGreaterThan(0);
      expect(advisory.howToOverride.length).toBeGreaterThan(0);
    }
  });

  it("accepts a raw SpecInput (bare-string channels) — normalize is built in", () => {
    const model = runPipeline(
      { data: { values: rows }, aes: { x: "x", y: "y" }, layers: [{ geom: "point" }] },
      size,
    );
    expect((model.scene.batches[0] as PointsBatch).rowIndex.length).toBe(4);
  });
});

describe("runPipeline — scales", () => {
  it("discrete x -> band scale; continuous -> linear (inference)", () => {
    const banded = runPipeline(
      gg(rows, aes({ x: "cls", y: "y" }))
        .geomPoint()
        .spec(),
      size,
    );
    expect(banded.scales.x.type).toBe("band");
    expect(banded.scene.axes.x.ticks.map((t) => t.label)).toEqual(["a", "b"]);

    const linear = runPipeline(pointSpec(), size);
    expect(linear.scales.x.type).toBe("linear");
  });

  it("THE flagship behavior: removing a series never reshuffles the others", () => {
    const ordinal = (model: ReturnType<typeof runPipeline>) => {
      const resolved = model.scales.color;
      if (resolved?.kind !== "ordinal") throw new Error("expected an ordinal color scale");
      return resolved.scale;
    };
    const all = runPipeline(pointSpec(), size);
    const colorOfA = ordinal(all).colorOf("a")!;
    const colorOfB = ordinal(all).colorOf("b")!;
    expect(colorOfA).not.toBe(colorOfB);

    // remove series "a"
    const onlyB = gg(
      rows.filter((r) => r.cls === "b"),
      aes({ x: "x", y: "y", color: "cls" }),
    )
      .geomPoint()
      .spec();
    const second = runPipeline(onlyB, { ...size, prevScales: all.scales.state });
    expect(ordinal(second).colorOf("b")).toBe(colorOfB);

    // re-add series "a": old color returns
    const third = runPipeline(pointSpec(), { ...size, prevScales: second.scales.state });
    expect(ordinal(third).colorOf("a")).toBe(colorOfA);
    expect(ordinal(third).colorOf("b")).toBe(colorOfB);
  });

  it("continuous color mappings train a sequential ramp (M1)", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "y" }))
        .geomPoint()
        .spec(),
      size,
    );
    const resolved = model.scales.color;
    expect(resolved?.kind).toBe("sequential");
    if (resolved?.kind !== "sequential") throw new Error("unreachable");
    expect(resolved.scale.domain).toEqual([10, 25]);
    const low = resolved.scale.colorOf(10);
    const high = resolved.scale.colorOf(25);
    expect(low).toMatch(/^#[0-9a-f]{6}$/);
    expect(low).not.toBe(high);
    // a ramp legend is produced and placed
    expect(model.scene.legends.some((l) => l.type === "ramp")).toBe(true);
  });
});

describe("runPipeline — lines and groups", () => {
  it("line layers split into one subpath per group (color interaction)", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y", color: "cls" }))
        .geomLine()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.pathOffsets.length).toBe(3); // 2 subpaths + terminator
    expect(batch.strokes).toHaveLength(2);
    expect(batch.strokes[0]).not.toBe(batch.strokes[1]);
  });

  it("rows are sorted by x within each group", () => {
    const shuffled = [
      { x: 3, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 3 },
    ];
    const model = runPipeline(
      gg(shuffled, aes({ x: "x", y: "y" }))
        .geomLine()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect([...batch.rowIndex]).toEqual([1, 2, 0]);
    expect(batch.positions[0]!).toBeLessThan(batch.positions[2]!);
    expect(batch.positions[2]!).toBeLessThan(batch.positions[4]!);
  });
});

describe("runPipeline — data resolution and failures", () => {
  it("resolves { name } from spec.datasets and RunOptions.data", () => {
    const spec = gg({ name: "cars" }, aes({ x: "x", y: "y" }))
      .geomPoint()
      .spec();
    const viaOptions = runPipeline(spec, { ...size, data: { cars: rows } });
    expect((viaOptions.scene.batches[0] as PointsBatch).rowIndex.length).toBe(4);
  });

  it("dataset name collisions error unless allowOverride", () => {
    const spec = {
      data: { name: "cars" },
      datasets: { cars: { values: [{ x: 1, y: 1 }] } },
      layers: [{ geom: "point" as const, aes: { x: "x", y: "y" } }],
    };
    expect(() => runPipeline(spec, { ...size, data: { cars: rows } })).toThrow(PipelineError);
    const model = runPipeline(spec, { ...size, data: { cars: rows }, allowOverride: true });
    expect((model.scene.batches[0] as PointsBatch).rowIndex.length).toBe(4); // runtime data won
  });

  it("unknown dataset / field / channel produce structured PipelineErrors", () => {
    const spec = gg({ name: "nope" }, aes({ x: "x", y: "y" }))
      .geomPoint()
      .spec();
    try {
      runPipeline(spec, size);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("unknown-dataset");
    }

    const badField = gg(rows, aes({ x: "xx", y: "y" }))
      .geomPoint()
      .spec();
    try {
      runPipeline(badField, size);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as PipelineError).code).toBe("unknown-field");
      expect((e as PipelineError).message).toContain('Did you mean "x"');
    }

    const noY = gg(rows, aes({ x: "x" }))
      .geomPoint()
      .spec();
    try {
      runPipeline(noY, size);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as PipelineError).code).toBe("missing-channel");
    }
  });

  it("missing values are removed with a warning, not an error", () => {
    const withNulls = [...rows, { x: null, y: 1, cls: "a" }, { x: 9, y: null, cls: "b" }];
    const model = runPipeline(
      gg(withNulls, aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
      size,
    );
    expect((model.scene.batches[0] as PointsBatch).rowIndex.length).toBe(4);
    expect(model.warnings.some((w) => w.code === "removed-missing")).toBe(true);
  });
});
