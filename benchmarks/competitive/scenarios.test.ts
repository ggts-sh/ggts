import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { scenarioSpec } from "./adapters/ggsvelte-svg";

import {
  CASES,
  casesForRun,
  dataForCase,
  LIBS,
  libSupports,
  makeMultiSeries,
  makeScatter,
  makeStackedBars,
  perturbForUpdate,
} from "./scenarios";

describe("competitive scenario catalog", () => {
  test("has multiple geom families (not just scatter)", () => {
    const scenarios = new Set(CASES.map((c) => c.scenario));
    expect(scenarios.has("scatter-color")).toBe(true);
    expect(scenarios.has("line-multiseries")).toBe(true);
    expect(scenarios.has("area-multiseries")).toBe(true);
    expect(scenarios.has("bars-stacked")).toBe(true);
  });

  test("includes uPlot-scale multi-series case", () => {
    const uplotScale = CASES.find((c) => c.id === "line-3x55k");
    expect(uplotScale).toBeDefined();
    expect(uplotScale!.n).toBe(166_650);
    expect(uplotScale!.defaultBrowser).toBe(false);
  });

  test("default browser matrix is multi-scenario and multi-size", () => {
    const defaults = casesForRun(false);
    const scenarios = new Set(defaults.map((c) => c.scenario));
    expect(scenarios.size).toBeGreaterThanOrEqual(3);
    expect(defaults.length).toBeGreaterThanOrEqual(5);
  });

  test("competitor set includes non-Svelte generalists", () => {
    const ids = new Set(LIBS.map((l) => l.id));
    expect(ids.has("uplot")).toBe(true);
    expect(ids.has("chartjs")).toBe(true);
    expect(ids.has("echarts")).toBe(true);
    expect(ids.has("tanstack-react")).toBe(true);
    expect(ids.has("d3")).toBe(true);
    expect(ids.has("ggsvelte-svg")).toBe(true);
    expect(ids.has("ggsvelte-canvas")).toBe(true);
    expect(ids.has("ggsvelte-react")).toBe(true);
  });

  test("Svelte peers remain for bundle comparison", () => {
    const ids = new Set(LIBS.map((l) => l.id));
    expect(ids.has("svelteplot")).toBe(true);
    expect(ids.has("layercake")).toBe(true);
    expect(ids.has("unovis")).toBe(true);
    expect(ids.has("tanstack-svelte")).toBe(true);
  });

  test("both shipped GGPlot hosts cover every default scenario and have bundle entries", () => {
    for (const id of ["ggsvelte-ggplot", "ggsvelte-react"]) {
      const lib = LIBS.find((item) => item.id === id)!;
      expect(lib.browser).toBe(true);
      for (const scenario of new Set(casesForRun(false).map((item) => item.scenario))) {
        expect(lib.scenarios).toContain(scenario);
        expect(scenarioSpec(scenario).layers?.[0]?.render).toBe("svg");
        expect(existsSync(new URL(`./entries/${id}__${scenario}.ts`, import.meta.url))).toBe(true);
      }
    }
  });

  test("data generators are deterministic and sized correctly", () => {
    const a = makeScatter(100);
    const b = makeScatter(100);
    expect(a.x).toEqual(b.x);
    expect(a.x).toHaveLength(100);

    const line = makeMultiSeries(3, 55_550);
    expect(line.x).toHaveLength(166_650);
    expect(new Set(line.series).size).toBe(3);

    const bars = makeStackedBars(50, 4);
    expect(bars.category).toHaveLength(200);
  });

  test("update variants remain visibly distinct after linear scale training (#1471)", () => {
    const data = makeScatter(1_000);
    const first = perturbForUpdate(data, 1);
    const second = perturbForUpdate(data, 2);
    if (!("cls" in first) || !("cls" in second)) throw new Error("expected scatter data");
    const normalize = (values: readonly number[]): number[] => {
      const min = Math.min(...values);
      const max = Math.max(...values);
      return values.map((value) => (value - min) / (max - min));
    };
    expect(normalize(first.y)).not.toEqual(normalize(second.y));
    expect(perturbForUpdate(data, 1)).toEqual(first);
  });

  test("update perturbations exercise every data shape and preserve categorical domains", () => {
    const scatter = {
      x: [1, 2],
      y: [10, 20],
      cls: ["series-0", "series-1"],
    };
    const scatterUpdate = perturbForUpdate(scatter, 1);
    expect(scatterUpdate).toMatchObject({
      x: scatter.x,
      cls: ["series-1", "series-0"],
    });

    const series = {
      x: [1, 2],
      y: [10, 20],
      series: ["s0", "s1"],
    };
    const seriesUpdate = perturbForUpdate(series, 2);
    if (!("series" in seriesUpdate)) throw new Error("expected series data");
    expect(seriesUpdate).toMatchObject({ x: series.x, series: series.series });
    expect(seriesUpdate.y).not.toEqual(series.y);

    const bars = {
      category: ["c0", "c0"],
      value: [10, 20],
      stack: ["stack-0", "stack-1"],
    };
    const barsUpdate = perturbForUpdate(bars, 1);
    if (!("stack" in barsUpdate)) throw new Error("expected bars data");
    expect(barsUpdate).toMatchObject({
      category: bars.category,
      stack: ["stack-1", "stack-0"],
    });
    expect(barsUpdate.value).not.toEqual(bars.value);

    const nonNumericLabels = perturbForUpdate({ ...scatter, cls: ["alpha", "beta"] }, 1);
    if (!("cls" in nonNumericLabels)) throw new Error("expected scatter data");
    expect(nonNumericLabels).toMatchObject({ cls: ["alpha", "beta"] });
  });

  test("dataForCase covers every catalog entry", () => {
    for (const c of CASES) {
      const data = dataForCase(c);
      if (c.scenario === "scatter-color") {
        expect("cls" in data).toBe(true);
        expect((data as { x: number[] }).x).toHaveLength(c.n);
      } else if (c.scenario === "bars-stacked") {
        expect("stack" in data).toBe(true);
      } else {
        expect("series" in data).toBe(true);
        expect((data as { x: number[] }).x).toHaveLength(c.n);
      }
    }
  });

  test("browser libs support line + scatter at minimum", () => {
    const browser = LIBS.filter((l) => l.browser);
    for (const lib of browser) {
      if (lib.id === "ggsvelte-canvas") {
        expect(libSupports(lib, "scatter-color")).toBe(true);
        expect(libSupports(lib, "line-multiseries")).toBe(true);
        continue;
      }
      expect(libSupports(lib, "scatter-color")).toBe(true);
      expect(libSupports(lib, "line-multiseries")).toBe(true);
    }
  });

  test("area-multiseries ggsvelte adapters force identity position (fair vs competitors) (#1357)", () => {
    // Competitors draw overlaid areas; geomArea defaults to stack.
    const svg = scenarioSpec("area-multiseries");
    const canvas = readFileSync(new URL("./adapters/ggsvelte-canvas.ts", import.meta.url), "utf8");
    expect(svg.layers?.[0]).toMatchObject({ geom: "area", position: "identity", render: "svg" });
    expect(canvas).toMatch(/geom:\s*["']area["'],\s*position:\s*["']identity["']/);
  });

  test("SSR bench entries exist for ggsvelte + Svelte peers (server-render matrix cannot collapse)", () => {
    for (const lib of [
      "ggsvelte",
      "ggsvelte-react",
      "ggsvelte-ggplot",
      "svelteplot",
      "layercake",
      "unovis",
      "tanstack-svelte",
    ]) {
      for (const scenario of ["scatter-color", "line-multiseries"]) {
        expect(existsSync(new URL(`./entries/ssr__${lib}__${scenario}.ts`, import.meta.url))).toBe(
          true,
        );
      }
    }
  });

  test("SSR bench keeps the empty-shell guard plus the SveltePlot capability record", () => {
    // minMarks: an unexpected empty server render fails loudly (no silent
    // throughput "win"). expectEmptyShell/ssrCapable: SveltePlot's documented
    // client-only mark rendering is recorded as a capability gap, not a 0 bar.
    const src = readFileSync(new URL("./measure-ssr.ts", import.meta.url), "utf8");
    expect(src).toMatch(/minMarks/);
    expect(src).toMatch(/expectEmptyShell/);
    expect(src).toMatch(/ssrCapable/);
  });

  test("browser harness does not re-sample replace as a second mount loop (#1357)", () => {
    // replaceLib is a full remount alias of mountLib; re-running medianMs doubles
    // wall time with no new information until in-place setData exists.
    const harness = readFileSync(new URL("./measure-browser.ts", import.meta.url), "utf8");
    expect(harness).not.toMatch(/competitiveBench\.replace/);
    expect(harness).toMatch(/replaceMedianMs:\s*mountStats\.median|replaceMedianMs:\s*mountStats/);
  });

  test("browser results pair sync and paint-inclusive medians from the same samples (#1486)", () => {
    const harness = readFileSync(new URL("./measure-browser.ts", import.meta.url), "utf8");
    expect(harness).toMatch(/medianTiming/);
    expect(harness).toMatch(/mountSyncMedianMs/);
    expect(harness).toMatch(/updateSyncMedianMs/);
    expect(harness).toMatch(/measuresSync:\s*true/);
  });

  test("known-gap ratchet closes only beyond the noise margin (#1471)", () => {
    const gate = readFileSync(new URL("./check-budgets.ts", import.meta.url), "utf8");
    expect(gate).toMatch(/if \(clearlyBeats\(c\.ggMs, c\.peerMs\)\)/);
    expect(gate).not.toMatch(/if \(c\.pass\) \{\s*\/\/ Ratchet/);
  });

  test("relative gate requires total and sync to corroborate a loss (#1471)", () => {
    const gate = readFileSync(new URL("./check-budgets.ts", import.meta.url), "utf8");
    expect(gate).toMatch(/const pass = totalPass \|\| syncPass/);
    expect(gate).toMatch(/PASS \(sync corroboration\)/);
  });
});
