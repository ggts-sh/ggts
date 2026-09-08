/** Fixed workloads stay published regardless of which library wins. */
import type { BenchmarkBar, BenchmarkChartInput } from "../../apps/docs/src/lib/benchmarks/charts";
import { timingMs, type BrowserResults } from "./results";

export interface ChartCard {
  readonly id: string;
  readonly framework: "core" | "react" | "svelte";
  readonly metric: "mount" | "update";
  readonly tab: string;
  readonly title: string;
  readonly subtitle: string;
  readonly width: number;
  readonly height: number;
  readonly chart: BenchmarkChartInput;
}

const GROUPS = [
  {
    framework: "core",
    libs: [
      ["ggsvelte-svg", "ggsvelte core SVG"],
      ["d3", "D3"],
      ["uplot", "uPlot (canvas)"],
      ["chartjs", "Chart.js (canvas)"],
      ["echarts", "ECharts (canvas)"],
    ],
  },
  {
    framework: "react",
    libs: [
      ["ggsvelte-react", "ggsvelte React"],
      ["tanstack-react", "TanStack React"],
      ["d3", "D3"],
      ["uplot", "uPlot (canvas)"],
      ["chartjs", "Chart.js (canvas)"],
      ["echarts", "ECharts (canvas)"],
    ],
  },
  {
    framework: "svelte",
    libs: [
      ["ggsvelte-ggplot", "ggsvelte Svelte"],
      ["tanstack-svelte", "TanStack Svelte"],
      ["svelteplot", "SveltePlot"],
      ["layercake", "LayerCake"],
      ["unovis", "Unovis Svelte"],
      ["echarts", "ECharts (canvas)"],
    ],
  },
] as const;
const CASES = [
  { id: "scatter-color-10k", slug: "scatter-10k", title: "10,000-point colored scatter" },
  { id: "line-3x10k", slug: "line-30k", title: "3 × 10,000-point line chart" },
] as const;

export function buildCards(browser: BrowserResults): readonly ChartCard[] {
  return GROUPS.flatMap(({ framework, libs }) =>
    CASES.flatMap((scenario) =>
      (["mount", "update"] as const).map((metric): ChartCard => {
        const id = `${framework}-${scenario.slug}-${metric}`;
        const title = `${framework === "core" ? "Core SVG" : framework === "react" ? "React" : "Svelte"} · ${scenario.title}`;
        const subtitle = `${metric === "mount" ? "Mount" : "In-place update"} · milliseconds · lower is better`;
        const bars: BenchmarkBar[] = libs
          .map(([lib, label]): BenchmarkBar => {
            const value = timingMs(browser, lib, scenario.id, metric);
            return {
              lib: label,
              value,
              kind: lib.startsWith("ggsvelte") ? "ggsvelte" : "peer",
              label: `${Number(value.toFixed(1)).toLocaleString("en-US")} ms`,
            };
          })
          .toSorted((a, b) => a.value - b.value || a.lib.localeCompare(b.lib));
        return {
          id,
          framework,
          metric,
          tab: scenario.slug === "scatter-10k" ? "Scatter 10k" : "Line 30k",
          title,
          subtitle,
          width: 560,
          height: 380,
          chart: {
            id,
            title,
            subtitle,
            bars,
            ariaLabel: `${title}. ${subtitle}. ${bars.map((bar) => `${bar.lib}: ${bar.label}`).join("; ")}.`,
          },
        };
      }),
    ),
  );
}
