/** Fixed framework workloads, loss-preserving charts, and committed artifact consistency. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "bun:test";

import { benchmarkChartSrc } from "../apps/docs/src/lib/benchmarks/asset-url.ts";
import { benchmarkChartSpec, benchmarkChartSvg } from "../apps/docs/src/lib/benchmarks/charts.ts";
import { readmeSource } from "./benchmark-charts/projection";
import { buildCards } from "./benchmark-charts/cards";
import {
  validateSnapshot,
  type BrowserResults,
  type PublishedSnapshot,
} from "./benchmark-charts/results";
import { CASES, LIBS, libSupports } from "../benchmarks/competitive/scenarios";
import { BENCHMARK_CHART_CARDS } from "../apps/docs/src/lib/generated/benchmark-charts.ts";

const STATIC_BENCHMARKS = join(import.meta.dir, "..", "apps", "docs", "static", "benchmarks");

/** Tick titles from top to bottom (`translate(0, y)` on `.gg-tick`). */
function tickTitlesTopToBottom(svg: string): readonly string[] {
  return [...svg.matchAll(/transform="translate\(0,([0-9.]+)\)"><title>([^<]*)<\/title>/g)]
    .map((match) => ({ y: Number(match[1]), title: match[2]! }))
    .toSorted((a, b) => a.y - b.y)
    .map((tick) => tick.title);
}

function bandX(spec: ReturnType<typeof benchmarkChartSpec>) {
  const x = spec.scales?.x;
  if (x === undefined) {
    throw new Error("benchmark spec is missing scales.x");
  }
  return x;
}

describe("benchmarkChartSpec band order", () => {
  it("pins the x-band domain by ascending value so the fastest bar is on top after coord flip", () => {
    const spec = benchmarkChartSpec({
      id: "order-test",
      bars: [
        { lib: "LayerCake", value: 54.7, kind: "peer", label: "54.7 ms" },
        { lib: "TanStack", value: 51.2, kind: "peer", label: "51.2 ms" },
        { lib: "ggsvelte", value: 15.8, kind: "ggsvelte", label: "15.8 ms" },
        { lib: "SveltePlot", value: 647.6, kind: "peer", label: "647.6 ms" },
        { lib: "Unovis", value: 173.7, kind: "peer", label: "173.7 ms" },
      ],
      title: "order test",
      subtitle: "Cold-mount milliseconds · lower is better",
      ariaLabel: "order test",
    });
    const x = bandX(spec);
    expect(x.domain).toEqual(["ggsvelte", "TanStack", "LayerCake", "Unovis", "SveltePlot"]);
    expect(x.reverse).toBe(true);
  });

  it("breaks equal values by library name so the domain stays stable", () => {
    const spec = benchmarkChartSpec({
      id: "tie-test",
      bars: [
        { lib: "Zebra", value: 10, kind: "peer", label: "10 ms" },
        { lib: "Alpha", value: 10, kind: "peer", label: "10 ms" },
      ],
      title: "tie",
      subtitle: "s",
      ariaLabel: "a",
    });
    expect(bandX(spec).domain).toEqual(["Alpha", "Zebra"]);
  });

  it("renders those domain values from fastest at the top after coord flip", () => {
    const bars = [
      { lib: "LayerCake", value: 54.7, kind: "peer" as const, label: "54.7 ms" },
      { lib: "TanStack", value: 51.2, kind: "peer" as const, label: "51.2 ms" },
      { lib: "ggsvelte", value: 15.8, kind: "ggsvelte" as const, label: "15.8 ms" },
      { lib: "SveltePlot", value: 647.6, kind: "peer" as const, label: "647.6 ms" },
      { lib: "Unovis", value: 173.7, kind: "peer" as const, label: "173.7 ms" },
    ];
    const svg = benchmarkChartSvg(
      {
        id: "order-render",
        bars,
        title: "order test",
        subtitle: "Cold-mount milliseconds · lower is better",
        ariaLabel: "order test",
      },
      { width: 560, height: 335 },
    );
    expect(tickTitlesTopToBottom(svg)).toEqual([
      "ggsvelte",
      "TanStack",
      "LayerCake",
      "Unovis",
      "SveltePlot",
    ]);
  });
});

describe("committed bench SVGs", () => {
  it("draw every card's ticks in increasing mount time, top to bottom", () => {
    for (const card of BENCHMARK_CHART_CARDS) {
      const filename = card.path.replace("/benchmarks/", "");
      const svg = readFileSync(join(STATIC_BENCHMARKS, filename), "utf8");
      const titles = tickTitlesTopToBottom(svg);
      expect(titles.length, card.id).toBeGreaterThan(1);
      const values = [...svg.matchAll(/y="([0-9.]+)"[^>]*>(([0-9][0-9.,]*) ms)</g)]
        .map((match) => ({ y: Number(match[1]), value: Number(match[3]!.replaceAll(",", "")) }))
        .toSorted((a, b) => a.y - b.y)
        .map((row) => row.value);
      expect(values.length, card.id).toBe(titles.length);
      expect(values, card.id).toEqual([...values].toSorted((a, b) => a - b));
    }
  });
});

describe("benchmarkChartSrc", () => {
  it("appends the SVG sha so a regen busts the docs-site cache", () => {
    expect(
      benchmarkChartSrc(
        "/benchmarks/bench-scatter-1k-mount.svg",
        "fd2cb838c7c94b785796e5521f4920fb7ac75ecebced390e87789db548ee9df1",
      ),
    ).toBe(
      "/benchmarks/bench-scatter-1k-mount.svg?v=fd2cb838c7c94b785796e5521f4920fb7ac75ecebced390e87789db548ee9df1",
    );
  });
});

describe("published benchmark workloads", () => {
  it("publishes both fixed workloads for each framework and metric", () => {
    for (const framework of ["core", "react", "svelte"]) {
      for (const metric of ["mount", "update"]) {
        expect(
          BENCHMARK_CHART_CARDS.filter(
            (card) => card.framework === framework && card.metric === metric,
          ).map((card) => card.id),
        ).toEqual([`${framework}-scatter-10k-${metric}`, `${framework}-line-30k-${metric}`]);
      }
    }
  });
});

describe("benchmark claim integrity", () => {
  const libs = [
    "ggsvelte-svg",
    "ggsvelte-react",
    "ggsvelte-ggplot",
    "d3",
    "uplot",
    "chartjs",
    "echarts",
    "tanstack-react",
    "tanstack-svelte",
    "svelteplot",
    "layercake",
    "unovis",
  ];
  const browser: BrowserResults = {
    libs: [],
    generatedAt: "2026-09-08T00:00:00Z",
    provenance: { commit: "test", dirty: false, mode: "production", versions: {} },
    results: libs.flatMap((lib) =>
      ["scatter-color-10k", "line-3x10k"].map((caseId) => ({
        lib,
        caseId,
        ok: true,
        mountMedianMs: lib.startsWith("ggsvelte") ? 100 : 10,
        updateMedianMs: lib.startsWith("ggsvelte") ? 80 : 5,
      })),
    ),
  };
  it("retains every featured workload when gg loses", () => {
    const cards = buildCards(browser);
    expect(cards).toHaveLength(12);
    for (const card of cards) expect(card.chart.bars.at(-1)?.kind).toBe("ggsvelte");
  });
  it("generates README framework charts and measured adapter sizes without replacing surrounding prose", async () => {
    const source =
      "# Intro\n\n<!-- framework-benchmark-charts:start -->\nold charts\n<!-- framework-benchmark-charts:end -->\n\n| **Bundle size** (old) | 999 KB |\n";
    const bundles = {
      ggsvelteKb: 12,
      svelteKb: 12,
      coreKb: 8,
      reactKb: 14,
      tanstackReactKb: 7,
      tanstackKb: 6,
      svelteplotKb: 9,
      unovisKb: 10,
      layercakeKb: 5,
    };
    const rendered = await readmeSource(
      source,
      buildCards(browser),
      bundles,
      join(import.meta.dir, "../README.md"),
    );
    expect(rendered).toContain("# Intro");
    expect(rendered).toContain("bench-react-scatter-10k-mount.svg");
    expect(rendered).toContain("bench-svelte-scatter-10k-mount.svg");
    expect(rendered).not.toContain("bench-core");
    expect(rendered).not.toContain("999 KB");
    expect(rendered).toContain("12 KB");
    expect(rendered).toContain("scatter import graph");
  });

  it("binds published measurements to one clean commit while retaining historical provenance", () => {
    const snapshot: PublishedSnapshot = {
      browser: {
        ...browser,
        libs: LIBS,
        results: LIBS.filter((lib) => lib.browser).flatMap((lib) =>
          CASES.filter((c) => c.defaultBrowser && libSupports(lib, c.scenario)).map((c) => ({
            lib: lib.id,
            caseId: c.id,
            ok: true,
            mountMedianMs: 1,
            updateMedianMs: 1,
          })),
        ),
      },
      bundles: { generatedAt: browser.generatedAt, provenance: browser.provenance, results: [] },
      ssr: {
        generatedAt: browser.generatedAt,
        provenance: browser.provenance,
        method: "test",
        results: [],
      },
      highN: { generatedAt: "2026-08-10T00:00:00Z", host: {}, protocol: {}, results: [] },
    };
    expect(validateSnapshot(snapshot)).toBe(snapshot);
    expect(() =>
      validateSnapshot({
        ...snapshot,
        ssr: { ...snapshot.ssr, provenance: { ...browser.provenance, dirty: true } },
      }),
    ).toThrow(/same clean source commit/);
    expect(() =>
      validateSnapshot({
        ...snapshot,
        bundles: { ...snapshot.bundles, provenance: { ...browser.provenance, commit: "other" } },
      }),
    ).toThrow(/same clean source commit/);
  });

  it("rejects missing or invalid measurements instead of hiding their bars", () => {
    expect(() => buildCards({ ...browser, results: browser.results.slice(1) })).toThrow(
      /missing valid/,
    );
    expect(() =>
      buildCards({
        ...browser,
        results: browser.results.map((r) => ({ ...r, updateMedianMs: NaN })),
      }),
    ).toThrow(/missing valid/);
  });
});
