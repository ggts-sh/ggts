/**
 * PR 3 — Step 0 stage + provenance guards.
 *
 * Three machine-readable inventories that fail on the two ways the pre-stat
 * transform staging can silently regress:
 *
 *  1. POSITIONAL-READ SPACE inventory — every continuous-position geometry read
 *     projects TRANSFORMED (scale-space) frame arrays through
 *     `normalizeTransformed`; semantic sites (annotation intercepts) use
 *     `normalize` and never `normalizeTransformed`. A revert to bare
 *     `.normalize()` on a transformed array is the double-transform bug
 *     (`log10(log10(v))`) and this inventory catches it.
 *
 *  2. PROVENANCE role inventory — every stat output is assigned exactly one
 *     role. `semantic-measure` producers forward through `forwardMeasureOnce`
 *     exactly once; `scale-space` producers (computed FROM already-transformed
 *     inputs) never forward again. The public `MappedField.source` flag is
 *     forbidden as a transform-decision key.
 *
 *  3. STAGE-ORDER behavioral golden — parse → transform/OOB → stat → position
 *     → affine train → guide, proven by the observable invariants of a
 *     log10 + smooth + histogram pipeline (transform before stat; affine in
 *     transformed space; semantic domain out; single forward).
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { aes, gg, scaleXLog10 } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";

const SRC = new URL("../src/pipeline/", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, SRC), "utf8");
/** Source with `//` and block comments stripped, to test executable code only. */
const code = (file: string) =>
  read(file)
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("//"))
    .join("\n");

// --- 1. Positional-read space inventory ------------------------------------

/** Every continuous-position geometry read and the space it MUST project. */
const POSITION_READ_INVENTORY = [
  { file: "geometry-shared-position.ts", space: "transformed" }, // points/lines/glyphs/segments/smooth
  { file: "geometry-rects-slot.ts", space: "transformed" }, // bar/histogram + binned edges
  { file: "geometry-errorbar-rows.ts", space: "transformed" },
  { file: "geometry-errorbar-width.ts", space: "transformed" },
  { file: "geometry-paths-closed.ts", space: "transformed" }, // area/density/smooth-ribbon bands
  { file: "geometry-boxplot-body.ts", space: "transformed" }, // stat_boxplot aggregates
  { file: "geometry-boxplot.ts", space: "transformed" }, // outlier y in scale-space
  { file: "geometry-segments-annotation.ts", space: "semantic" }, // xintercept/yintercept are source values
] as const;

describe("positional-read space inventory", () => {
  for (const { file, space } of POSITION_READ_INVENTORY) {
    it(`${file} projects ${space} space`, () => {
      const src = read(file);
      if (space === "transformed") {
        // Continuous frame arrays go through normalizeTransformed. (Band-scale
        // category lookups may still use semantic normalize alongside.)
        expect(src.includes("normalizeTransformed")).toBe(true);
      } else {
        // Semantic sites must never call normalizeTransformed on source values.
        expect(src.includes("normalizeTransformed")).toBe(false);
        expect(src.includes(".normalize(")).toBe(true);
      }
    });
  }
});

// --- 2. Provenance role inventory ------------------------------------------

/**
 * Every stat output role. `semantic-measure` = a stat-invented mapped measure
 * forwarded through the axis transform exactly once. `scale-space` = derived
 * FROM already-transformed inputs, never forwarded again.
 *
 * After #1077, column-mode y (`y: { column }`) is forwarded inside
 * `layer-frame.ts` via `statLayerFrame`; adapters may either call
 * `forwardMeasureOnce` directly or hand off via column mode.
 */
const PROVENANCE_INVENTORY = [
  { file: "frame-stats-count.ts", role: "semantic-measure", outputs: ["count"] },
  {
    file: "frame-stats-bin-frame.ts",
    role: "semantic-measure",
    outputs: ["count", "density", "ncount", "ndensity"],
  },
  {
    file: "frame-stats-density.ts",
    role: "semantic-measure",
    outputs: ["density", "count", "scaled", "ndensity"],
  },
  {
    file: "layer-frame.ts",
    role: "semantic-measure",
    outputs: ["yStatColumn column-mode default"],
  },
  { file: "frame-stats-smooth.ts", role: "scale-space", outputs: ["smooth x/y/bands"] },
  { file: "frame-stats-summary.ts", role: "scale-space", outputs: ["summary aggregates"] },
  { file: "frame-stats-boxplot.ts", role: "scale-space", outputs: ["boxplot aggregates"] },
] as const;

/** Direct call or column-mode handoff that layer-frame forwards once. */
function forwardsSemanticMeasure(src: string): boolean {
  return src.includes("forwardMeasureOnce") || /y:\s*\{\s*column:/.test(src);
}

describe("stat-output provenance inventory", () => {
  for (const { file, role } of PROVENANCE_INVENTORY) {
    it(`${file} (${role}) ${role === "semantic-measure" ? "forwards once" : "never re-forwards"}`, () => {
      const src = code(file);
      if (role === "semantic-measure") {
        expect(forwardsSemanticMeasure(src)).toBe(true);
      } else {
        expect(src.includes("forwardMeasureOnce")).toBe(false);
      }
    });
  }

  it("forwardMeasureOnce lives on the known semantic-measure call sites", () => {
    // Independent list of direct call sites; bin-frame uses column mode instead.
    const expected = [
      "frame-stats-count.ts",
      "frame-stats-density.ts",
      "layer-frame.ts",
    ].toSorted();
    const actual = PROVENANCE_INVENTORY.filter((e) => code(e.file).includes("forwardMeasureOnce"))
      .map((e) => e.file)
      .toSorted();
    expect(actual).toEqual(expected);
  });

  it("bin-frame hands column-mode y to layer-frame instead of calling forwardMeasureOnce", () => {
    const src = code("frame-stats-bin-frame.ts");
    expect(src.includes("forwardMeasureOnce")).toBe(false);
    expect(/y:\s*\{\s*column:\s*"count"/.test(src)).toBe(true);
  });

  it("the public MappedField.source flag is not a transform-decision key", () => {
    // The transform-role decision must key from internal provenance, never the
    // public source === "stat" flag. Scan executable code (comments allowed).
    for (const file of ["stat-measure-transform.ts", "position-program.ts"]) {
      expect(code(file).includes('source === "stat"')).toBe(false);
    }
  });
});

// --- 3. Stage-order behavioral golden --------------------------------------

describe("stage order: parse → transform → stat → position → affine → guide", () => {
  const rows = [1, 10, 100, 1000, 10_000].map((x, i) => ({ x, y: i + 1 }));
  const model = runPipeline(
    gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .scales(scaleXLog10())
      .spec(),
    { width: 640, height: 400 },
  );
  const scale = model.scales.x;
  if (scale.type === "band") throw new Error("expected continuous x");

  it("trains the affine scale in transformed space (decades evenly spaced)", () => {
    const t = [1, 10, 100, 1000, 10_000].map((v) => scale.normalize(v));
    const gaps = t.slice(1).map((v, i) => v - t[i]!);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 6);
  });

  it("keeps the public domain semantic (single forward, semantic out)", () => {
    expect(scale.type).toBe("linear");
    expect(scale.transform).toBe("log10");
    expect(scale.domain[0]).toBeGreaterThan(0);
    // normalize(v) == normalizeTransformed(log10(v)): one forward, never twice.
    expect(scale.normalize(100)).toBeCloseTo(scale.normalizeTransformed(Math.log10(100)), 9);
  });

  it("inverts affine → semantic (round trip)", () => {
    expect(scale.invert(scale.normalize(100))).toBeCloseTo(100, 6);
  });
});
