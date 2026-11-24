/**
 * Color/fill scale lint behavior: manual-palette-too-large (issue #1961).
 *
 * Seams under test:
 * - lintSpec(spec, options?): spec-lint rule firing, thresholds, family filtering,
 *   omitted-type discrete/continuous discrimination, malformed-input safety, and
 *   co-firing with many-discrete-colors.
 * - validate(spec, { lint: true }): integration of schema validation + lintSpec.
 * - ggts check CLI (packages/cli/bin/ggts.js): end-to-end stderr JSONL emission
 *   and exit code 0 for the Issue #1961 repro.
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { lintSpec, type SpecAdvisory } from "../src/lint.ts";
import { validate } from "../src/validate.ts";

const CODE = "manual-palette-too-large";
const codesOf = (advisories: readonly SpecAdvisory[]) => advisories.map((a) => a.code);
const paletteAdvisories = (advisories: readonly SpecAdvisory[]) =>
  advisories.filter((a) => a.code === CODE);

const makePalette = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `#${(i + 1).toString(16).padStart(6, "0")}`);

const PALETTE_8 = makePalette(8);
const PALETTE_9 = [
  "#4e79a7",
  "#f28e2b",
  "#e15759",
  "#76b7b2",
  "#59a14f",
  "#edc948",
  "#b07aa1",
  "#ff9da7",
  "#9c755f",
];
const PALETTE_11 = makePalette(11);
const PALETTE_12 = makePalette(12);
const LABELS_9 = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
const LABS = { title: "Palette test", x: "Category", y: "Value" };

function reproSpec(): Record<string, unknown> {
  return {
    width: 960,
    height: 480,
    layers: [
      {
        geom: "col",
        aes: { x: { field: "section" }, y: { field: "n" }, fill: { field: "section" } },
      },
    ],
    scales: {
      x: { type: "band" },
      y: { type: "linear" },
      fill: {
        type: "manual",
        domain: LABELS_9,
        range: PALETTE_9,
      },
    },
    labs: { title: "Citas por sector", x: "Sector", y: "Citas" },
    data: {
      columns: {
        section: LABELS_9,
        n: [4, 7, 2, 9, 3, 6, 5, 8, 1],
      },
    },
  };
}

describe("manual-palette-too-large", () => {
  it("fires on the Issue #1961 repro via lintSpec, validate({ lint: true }), and ggts check", async () => {
    const spec = reproSpec();

    const lintHits = paletteAdvisories(lintSpec(spec));
    expect(lintHits).toHaveLength(1);
    const hit = lintHits[0]!;
    expect(hit.path).toBe("/scales/fill");
    expect(hit.message).toContain("fill");
    expect(hit.message).toContain("9");
    expect(hit.message).toContain("8");
    expect(hit.suggestion?.description).toMatch(/8|eight/i);
    expect(hit.suggestion?.description).toMatch(/Other/);
    expect(hit.suggestion?.description).toMatch(/position|small multiples/i);
    expect(hit.suggestion?.example).toBeUndefined();

    const validated = validate(spec, { lint: true });
    expect(validated.ok).toBe(true);
    expect(codesOf(validated.advisories ?? [])).toContain(CODE);

    const cliBin = join(import.meta.dir, "..", "..", "cli", "bin", "ggts.js");
    const proc = Bun.spawn(["bun", cliBin, "check"], {
      stdin: new TextEncoder().encode(JSON.stringify(spec)),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toBe("");
    const lines = stderr
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const cliHit = lines.find((line) => line["code"] === CODE);
    expect(cliHit).toBeDefined();
    expect(cliHit?.["kind"]).toBe("advisory");
    expect(cliHit?.["source"]).toBe("spec-lint");
    expect(cliHit?.["path"]).toBe("/scales/fill");
  }, 20_000);

  it("fires for scales.color manual (9), scales.color ordinal (9), and both color and fill independently", () => {
    const colorManual = lintSpec({
      labs: LABS,
      data: { columns: { x: [1, 2], y: [3, 4], g: ["A", "B"] } },
      aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "g" } },
      layers: [{ geom: "point" }],
      scales: { color: { type: "manual", domain: LABELS_9, range: PALETTE_9 } },
    });
    expect(paletteAdvisories(colorManual).map((a) => a.path)).toEqual(["/scales/color"]);

    const colorOrdinal = lintSpec({
      labs: LABS,
      data: { columns: { x: [1, 2], y: [3, 4], g: ["A", "B"] } },
      aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "g" } },
      layers: [{ geom: "point" }],
      scales: { color: { type: "ordinal", range: PALETTE_9 } },
    });
    expect(paletteAdvisories(colorOrdinal).map((a) => a.path)).toEqual(["/scales/color"]);
    expect(paletteAdvisories(colorOrdinal)[0]!.message).toContain("ordinal");

    const bothChannels = lintSpec({
      labs: LABS,
      data: { columns: { x: [1, 2], y: [3, 4], g: ["A", "B"], h: ["U", "V"] } },
      aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "g" }, fill: { field: "h" } },
      layers: [{ geom: "point" }],
      scales: {
        color: { type: "manual", domain: LABELS_9, range: PALETTE_9 },
        fill: { type: "ordinal", range: PALETTE_11 },
      },
    });
    expect(paletteAdvisories(bothChannels).map((a) => a.path)).toEqual([
      "/scales/color",
      "/scales/fill",
    ]);
  });

  it("respects boundary 8 (silent), fires on 12 colors with 6 observed classes, and fires without data (needs: spec)", () => {
    const exact8 = lintSpec({
      labs: LABS,
      data: { columns: { x: LABELS_9.slice(0, 8), y: [1, 2, 3, 4, 5, 6, 7, 8] } },
      aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "x" } },
      layers: [{ geom: "col" }],
      scales: { fill: { type: "manual", domain: LABELS_9.slice(0, 8), range: PALETTE_8 } },
    });
    expect(codesOf(exact8)).not.toContain(CODE);

    const twelveWithSixObserved = lintSpec({
      labs: LABS,
      data: { columns: { x: ["A", "B", "C", "D", "E", "F"], y: [1, 2, 3, 4, 5, 6] } },
      aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "x" } },
      layers: [{ geom: "col" }],
      scales: {
        fill: {
          type: "manual",
          domain: makePalette(12).map((_, i) => `C${i}`),
          range: PALETTE_12,
        },
      },
    });
    const hit12 = paletteAdvisories(twelveWithSixObserved);
    expect(hit12).toHaveLength(1);
    expect(hit12[0]!.message).toContain("12");

    const noDataSpec = {
      labs: LABS,
      aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "g" } },
      layers: [{ geom: "point" }],
      scales: { color: { type: "manual", domain: LABELS_9, range: PALETTE_9 } },
    };
    expect(codesOf(lintSpec(noDataSpec))).toContain(CODE);
    const validatedNoData = validate(noDataSpec, { lint: true });
    expect(codesOf(validatedNoData.advisories ?? [])).toContain(CODE);
  });

  it("handles named schemes and non-discrete color scale families", () => {
    const namedObservable10 = lintSpec({
      labs: LABS,
      data: { columns: { x: LABELS_9, y: [1, 2, 3, 4, 5, 6, 7, 8, 9] } },
      aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "x" } },
      layers: [{ geom: "col" }],
      scales: { fill: { type: "ordinal", scheme: "observable10" } },
    });
    expect(codesOf(namedObservable10)).not.toContain(CODE);

    const ordinalWithSchemeAndRange = lintSpec({
      labs: LABS,
      data: { columns: { x: ["A", "B"], y: [1, 2] } },
      aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "x" } },
      layers: [{ geom: "col" }],
      scales: { fill: { type: "ordinal", scheme: "Dark2", range: PALETTE_9 } },
    });
    expect(codesOf(ordinalWithSchemeAndRange)).toContain(CODE);

    const sequentialWithStops = lintSpec({
      labs: LABS,
      data: { columns: { x: [1, 2], y: [3, 4], z: [10, 20] } },
      aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "z" } },
      layers: [{ geom: "point" }],
      scales: { color: { type: "sequential", range: PALETTE_12 } },
    });
    expect(codesOf(sequentialWithStops)).not.toContain(CODE);

    const binnedWithStops = lintSpec({
      labs: LABS,
      data: { columns: { x: [1, 2], y: [3, 4], z: [10, 20] } },
      aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "z" } },
      layers: [{ geom: "point" }],
      scales: { color: { type: "binned", range: PALETTE_12 } },
    });
    expect(codesOf(binnedWithStops)).not.toContain(CODE);

    const identityWithRange = lintSpec({
      labs: LABS,
      layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
      scales: { color: { type: "identity", range: PALETTE_9 } },
    });
    expect(codesOf(identityWithRange)).not.toContain(CODE);
  });

  it("handles omitted scale type across ordinal options, discrete fields, continuous fields, and no data", () => {
    const omittedWithDomainMode = lintSpec({
      labs: LABS,
      layers: [
        { geom: "point", aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "g" } } },
      ],
      scales: { color: { domainMode: "grow", range: PALETTE_9 } },
    });
    expect(codesOf(omittedWithDomainMode)).toContain(CODE);

    const omittedWithOnExhaust = lintSpec({
      labs: LABS,
      layers: [
        { geom: "point", aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "g" } } },
      ],
      scales: { fill: { onExhaust: "cycle", range: PALETTE_9 } },
    });
    expect(codesOf(omittedWithOnExhaust)).toContain(CODE);

    const omittedDiscretePlotData = lintSpec({
      labs: LABS,
      data: { columns: { x: [1, 2], y: [3, 4], g: ["a", "b"] } },
      aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "g" } },
      layers: [{ geom: "point" }],
      scales: { color: { range: PALETTE_9 } },
    });
    expect(codesOf(omittedDiscretePlotData)).toContain(CODE);

    const omittedDiscreteLayerData = lintSpec({
      labs: LABS,
      layers: [
        {
          geom: "point",
          data: { columns: { x: [1, 2], y: [3, 4], g: ["a", "b"] } },
          aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "g" } },
        },
      ],
      scales: { fill: { range: PALETTE_9 } },
    });
    expect(codesOf(omittedDiscreteLayerData)).toContain(CODE);

    const omittedDiscreteProfile = lintSpec(
      {
        labs: LABS,
        aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "g" } },
        layers: [{ geom: "point" }],
        scales: { color: { range: PALETTE_9 } },
      },
      {
        profile: {
          fields: [
            { name: "x", type: "quantitative" },
            { name: "y", type: "quantitative" },
            { name: "g", type: "ordinal" },
          ],
        },
      },
    );
    expect(codesOf(omittedDiscreteProfile)).toContain(CODE);

    const omittedQuantField = lintSpec({
      labs: LABS,
      data: { columns: { x: [1, 2], y: [3, 4], z: [10, 20] } },
      aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "z" } },
      layers: [{ geom: "point" }],
      scales: { color: { range: PALETTE_9 } },
    });
    expect(codesOf(omittedQuantField)).not.toContain(CODE);

    const omittedNoData = lintSpec({
      labs: LABS,
      aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "z" } },
      layers: [{ geom: "point" }],
      scales: { color: { range: PALETTE_9 } },
    });
    expect(codesOf(omittedNoData)).not.toContain(CODE);
  });

  it("never throws on malformed scales, non-array/empty range, or malformed aes", () => {
    const malformedCases = [
      { layers: [{ geom: "point" }], scales: null },
      { layers: [{ geom: "point" }], scales: "bogus" },
      { layers: [{ geom: "point" }], scales: { color: null, fill: "manual" } },
      { layers: [{ geom: "point" }], scales: { color: { type: "manual", range: "#ff0000" } } },
      {
        layers: [{ geom: "point" }],
        scales: { fill: { type: "ordinal", range: { length: 12 } } },
      },
      { layers: [{ geom: "point" }], scales: { color: { type: "manual", range: [] } } },
      {
        layers: [{ geom: "point" }],
        aes: { color: 42 },
        scales: { color: { range: PALETTE_9 } },
      },
      {
        layers: [null, { geom: "point", aes: null }],
        scales: { fill: { type: "manual", range: PALETTE_8 } },
      },
    ];
    for (const spec of malformedCases) {
      expect(codesOf(lintSpec(spec))).not.toContain(CODE);
    }
  });

  it("co-fires with many-discrete-colors when 11+ distinct values meet an 11-color manual range", () => {
    const cats = Array.from({ length: 11 }, (_, i) => `cat-${i}`);
    const advisories = lintSpec({
      labs: LABS,
      data: {
        columns: {
          x: cats.map((_, i) => i),
          y: cats.map((_, i) => i + 1),
          g: cats,
        },
      },
      aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "g" } },
      layers: [{ geom: "col" }],
      scales: { fill: { type: "manual", domain: cats, range: PALETTE_11 } },
    });
    const codes = codesOf(advisories);
    expect(codes).toContain("many-discrete-colors");
    expect(codes).toContain(CODE);
  });

  it("does not leak plot-level field evidence onto layers with runtime or separate inline datasets", () => {
    const runtimeLayerSpec = {
      labs: LABS,
      data: { columns: { x: [1, 2], y: [3, 4], g: ["a", "b"] } },
      aes: { x: { field: "x" }, y: { field: "y" } },
      layers: [{ geom: "point", data: { name: "runtime_only" }, aes: { fill: { field: "g" } } }],
      scales: { fill: { range: PALETTE_9 } },
    };
    expect(codesOf(lintSpec(runtimeLayerSpec))).not.toContain(CODE);
    const validatedRuntime = validate(runtimeLayerSpec, { lint: true });
    expect(validatedRuntime.ok).toBe(true);
    expect(codesOf(validatedRuntime.advisories ?? [])).not.toContain(CODE);

    const inlineLayerMissingFieldSpec = {
      labs: LABS,
      data: { columns: { x: [1, 2], y: [3, 4], g: ["a", "b"] } },
      aes: { x: { field: "x" }, y: { field: "y" } },
      layers: [
        {
          geom: "point",
          data: { columns: { x: [1, 2], y: [3, 4] } },
          aes: { fill: { field: "g" } },
        },
      ],
      scales: { fill: { range: PALETTE_9 } },
    };
    expect(codesOf(lintSpec(inlineLayerMissingFieldSpec))).not.toContain(CODE);
    const validatedInlineMissing = validate(inlineLayerMissingFieldSpec, { lint: true });
    expect(codesOf(validatedInlineMissing.advisories ?? [])).not.toContain(CODE);

    const inlineLayerQuantSameNameSpec = {
      labs: LABS,
      data: { columns: { x: [1, 2], y: [3, 4], g: ["a", "b"] } },
      aes: { x: { field: "x" }, y: { field: "y" } },
      layers: [
        {
          geom: "point",
          data: { columns: { x: [1, 2], y: [3, 4], g: [10, 20] } },
          aes: { fill: { field: "g" } },
        },
      ],
      scales: { fill: { range: PALETTE_9 } },
    };
    expect(codesOf(lintSpec(inlineLayerQuantSameNameSpec))).not.toContain(CODE);
    const validatedInlineQuant = validate(inlineLayerQuantSameNameSpec, { lint: true });
    expect(validatedInlineQuant.ok).toBe(true);
    expect(codesOf(validatedInlineQuant.advisories ?? [])).not.toContain(CODE);

    const siblingInheritingPlotDataSpec = {
      labs: LABS,
      data: { columns: { x: [1, 2], y: [3, 4], g: ["a", "b"] } },
      aes: { x: { field: "x" }, y: { field: "y" } },
      layers: [
        { geom: "point", data: { name: "runtime_only" }, aes: { fill: { field: "g" } } },
        { geom: "point", aes: { fill: { field: "g" } } },
      ],
      scales: { fill: { range: PALETTE_9 } },
    };
    expect(codesOf(lintSpec(siblingInheritingPlotDataSpec))).toContain(CODE);
    const validatedSibling = validate(siblingInheritingPlotDataSpec, { lint: true });
    expect(validatedSibling.ok).toBe(true);
    expect(codesOf(validatedSibling.advisories ?? [])).toContain(CODE);
  });
});
