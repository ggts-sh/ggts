/** Four homepage highlights; the full benchmark matrix stays in GitHub. */
import type { BenchmarkBar, BenchmarkChartInput } from "../../apps/docs/src/lib/benchmarks/charts";
import { BENCHMARK_LIBRARIES, timingMs, type BrowserResults } from "./results";

export interface ChartCard {
  readonly id: string;
  readonly tab: string;
  readonly facetLabel: string;
  readonly width: number;
  readonly height: number;
  readonly chart: BenchmarkChartInput;
}

const HIGHLIGHTS = [
  {
    caseId: "scatter-color-10k",
    slug: "scatter-10k",
    title: "10,000-point scatter",
    metric: "mount",
    tab: "10k points",
  },
  {
    caseId: "scatter-color-1k",
    slug: "scatter-1k",
    title: "1,000-point scatter",
    metric: "mount",
    tab: "1k points",
  },
  {
    caseId: "scatter-color-10k",
    slug: "scatter-10k",
    title: "10,000-point scatter",
    metric: "update",
    tab: "10k update",
  },
  {
    caseId: "line-3x10k",
    slug: "line-30k",
    title: "30,000-point line",
    metric: "update",
    tab: "30k line update",
  },
] as const;

export function buildCards(renderer: BrowserResults): readonly ChartCard[] {
  return HIGHLIGHTS.map(({ caseId, slug, title, metric, tab }) => {
    const id = `core-${slug}-${metric}`;
    const operation = metric === "mount" ? "First render" : "Data update";
    const subtitle = `${operation} · SVG`;
    const bars = BENCHMARK_LIBRARIES.map(([lib, label]): BenchmarkBar => {
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
      tab,
      facetLabel: `${title} · ${operation}`,
      width: 360,
      height: 250,
      chart: {
        id,
        title,
        subtitle,
        bars,
        ariaLabel: `${title}. ${subtitle}. Lower is better. ${bars.map((bar) => `${bar.lib} ${bar.label}`).join(", ")}.`,
      },
    };
  });
}
