/**
 * #704: single removal clock for the seven grammar props deprecated in 0.11.0.
 * After 0.13.0 they are gone from GGPlot types, runtime wiring, and exports.
 *
 * Seams: plot-props source, engine host (no PlotEngineInputs mirror), LayerDescriptor.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { GRAMMAR_PROP_NAMES } from "../../src/lib/layers/grammar-families.js";

const root = join(import.meta.dirname, "../../src/lib");

describe("#704 grammar prop removal", () => {
  it("GGPlotProps no longer declares the seven deprecated grammar props", () => {
    const source = readFileSync(join(root, "plot-props.ts"), "utf8");
    for (const prop of GRAMMAR_PROP_NAMES) {
      expect(source, `${prop} still on GGPlotProps`).not.toMatch(new RegExp(`\\b${prop}\\?:`));
    }
  });

  it("PlotEngineInputs is deleted — single prop surface is GGPlotProps/EnginePlotProps (#1040)", () => {
    const source = readFileSync(join(root, "plot-engine.svelte.ts"), "utf8");
    expect(source).not.toContain("PlotEngineInputs");
    expect(source).toContain("PlotEngineHost");
  });

  it("engine no longer emits DEPRECATED_PLOT_PROP for grammar props", () => {
    const source = readFileSync(join(root, "plot-engine.svelte.ts"), "utf8");
    // Grammar-prop emit path removed with the props (#704). Catalog types and
    // dual-read paths for legendFocus/legendFilter migrations may still call
    // deprecatedPropDiagnostic — that is not a grammar-prop regression.
    expect(source).not.toContain("deprecationDiagnostics");
    for (const prop of GRAMMAR_PROP_NAMES) {
      expect(source, `grammar prop ${prop} still wired for deprecation emit`).not.toMatch(
        new RegExp(`prop:\\s*["']${prop}["']`),
      );
    }
  });

  it("legendFocus/legendFilter dual-read emit sites still exist (S5 diagnostics module)", () => {
    // Emit sites moved from plot-engine.svelte.ts to the diagnostics module
    // (plan §5) — intent unchanged: the dual-read emit paths must still exist.
    const source = readFileSync(
      join(root, "diagnostics/plot-engine-diagnostics.svelte.ts"),
      "utf8",
    );
    expect(source).toContain('prop: "legendFocus"');
    expect(source).toContain('prop: "legendFilter"');
  });

  it("LayerDescriptor alias is removed (use MarkLayerDescriptor)", () => {
    const registry = readFileSync(join(root, "geoms/registry.svelte.ts"), "utf8");
    const index = readFileSync(join(root, "lean.ts"), "utf8");
    expect(registry).not.toMatch(/\bexport type LayerDescriptor\b/);
    expect(index).not.toMatch(/\bLayerDescriptor\b/);
  });
});
