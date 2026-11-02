import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { EXAMPLES } from "../examples/manifest.ts";
import { LEGEND_TITLE_SCENARIOS } from "../tests/visual/legend-title-scenarios.ts";
import {
  INTERACTION_HANDLERS,
  SMOKE_BASE_NAMES,
  SMOKE_SCENARIOS,
  smokeExampleIds,
  type InteractionHandlerId,
  type SmokeScenario,
} from "../tests/visual/smoke-matrix.ts";

const EXAMPLE_IDS = new Set(EXAMPLES.map((e) => e.id));

describe("SMOKE_SCENARIOS inventory", () => {
  test("count is in the enforced 15–18 band", () => {
    expect(SMOKE_SCENARIOS.length).toBeGreaterThanOrEqual(15);
    expect(SMOKE_SCENARIOS.length).toBeLessThanOrEqual(18);
  });

  test("includes at least two dark scenarios", () => {
    const dark = SMOKE_SCENARIOS.filter((s) => s.theme === "dark");
    expect(dark.length).toBeGreaterThanOrEqual(2);
  });

  test("every example scenario id exists in the manifest", () => {
    for (const scenario of SMOKE_SCENARIOS) {
      if (scenario.kind !== "example") continue;
      expect(EXAMPLE_IDS.has(scenario.exampleId), scenario.exampleId).toBe(true);
    }
  });

  test("ids and basenames are unique (declaration order preserved)", () => {
    const ids = SMOKE_SCENARIOS.map((s) => s.id);
    const bases = SMOKE_SCENARIOS.map((s) => s.basename);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(bases).size).toBe(bases.length);
    expect(SMOKE_BASE_NAMES).toEqual(bases);
  });

  test("exact ordered basename fixture (do not sort)", () => {
    expect(SMOKE_BASE_NAMES).toEqual([
      "point-scatter-color-light.png",
      "point-abline-identity-dark.png",
      "line-multi-series-light.png",
      "bar-stacked-light.png",
      "area-basic-light.png",
      "col-long-labels-light.png",
      "facet-wrap-light.png",
      "smooth-loess-scatter-light.png",
      "col-basic-light.png",
      "boxplot-by-category-light.png",
      "interaction-tooltip-pinned-light.png",
      "interaction-legend-focus-committed-light.png",
      "interaction-interval-selected-light.png",
      "interaction-tool-rail-460-light.png",
      "interaction-tooltip-dark.png",
      "interaction-zoom-draft-forced-colors.png",
    ]);
  });

  test("interaction handlers are bijective with interaction scenarios", () => {
    const handlers = SMOKE_SCENARIOS.filter(
      (s): s is Extract<SmokeScenario, { kind: "interaction" }> => s.kind === "interaction",
    ).map((s) => s.handler);
    expect(new Set(handlers).size).toBe(handlers.length);
    const required = new Set<InteractionHandlerId>(INTERACTION_HANDLERS);
    for (const handler of handlers) expect(required.has(handler)).toBe(true);
    expect(handlers.length).toBe(INTERACTION_HANDLERS.length);
  });

  test("smoke example ids are a strict subset of the full corpus", () => {
    const ids = smokeExampleIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThan(EXAMPLES.length);
    for (const id of ids) expect(EXAMPLE_IDS.has(id)).toBe(true);
  });
});

describe("committed VR baseline directory", () => {
  test("when baselines exist, PNG set equals enforced VR basenames exactly", () => {
    const dir = join(import.meta.dir, "../tests/visual/__screenshots__");
    let files: string[];
    try {
      files = readdirSync(dir)
        .filter((f) => f.endsWith(".png"))
        .toSorted();
    } catch {
      // Empty/missing dir is bootstrap mode — inventory still defines truth.
      return;
    }
    if (files.length === 0) return;
    // The core-rendered legend-title seats live in their own inventory
    // (legend-title-scenarios.ts) but share the pinned baseline directory.
    const expected = [
      ...SMOKE_BASE_NAMES,
      ...LEGEND_TITLE_SCENARIOS.map((scenario) => scenario.basename),
    ];
    expect(files).toEqual(expected.toSorted());
  });
});
