/** Four homepage highlights; the full benchmark matrix stays in GitHub. */
import type { BenchmarkBar, BenchmarkChartInput } from "../../apps/docs/src/lib/benchmarks/charts";
import { timingMs, type BrowserResults } from "./results";

export interface ChartCard {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly chart: BenchmarkChartInput;
}

const LIBRARIES = [
  ["ggsvelte-svg", "ggts core SVG"],
  ["layercake", "LayerCake"],
  ["unovis", "Unovis"],
  ["tanstack-svelte", "TanStack"],
  ["svelteplot", "SveltePlot"],
] as const;

const HIGHLIGHTS = [
  { caseId: "scatter-color-10k", slug: "scatter-10k", title: "10,000 points", metric: "mount" },
  { caseId: "scatter-color-1k", slug: "scatter-1k", title: "1,000 points", metric: "mount" },
  { caseId: "scatter-color-10k", slug: "scatter-10k", title: "10,000 points", metric: "update" },
  { caseId: "line-3x10k", slug: "line-30k", title: "30,000-point line chart", metric: "update" },
] as const;

export function buildCards(renderer: BrowserResults): readonly ChartCard[] {
  return HIGHLIGHTS.map(({ caseId, slug, title, metric }) => {
    const id = `core-${slug}-${metric}`;
    const subtitle = `${metric === "mount" ? "First render" : "Data update"} · SVG · milliseconds`;
    const bars = LIBRARIES.map(([lib, label]): BenchmarkBar => {
      const value = timingMs(renderer, lib, caseId, metric);
      return {
        lib: label,
        value,
        kind: lib === "ggsvelte-svg" ? "ggsvelte" : "peer",
        label: `${Number(value.toFixed(1)).toLocaleString("en-US")} ms`,
      };
    }).toSorted((a, b) => a.value - b.value || a.lib.localeCompare(b.lib));
    return {
      id,
      width: 360,
      height: 250,
      chart: {
        id,
        title,
        subtitle,
        bars,
        ariaLabel: `${title}. ${subtitle}. Lower is better. ${bars.map((bar) => `${bar.lib}: ${bar.label}`).join("; ")}.`,
      },
    };
  });
}
