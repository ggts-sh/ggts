import { FONT_METRICS, MetricsTableMeasurer, planTemporalAxis, runPipeline } from "@ggts-sh/core";

import { temporalFreeFacetSpec, temporalLineSpec } from "../workload-specs";
import { fmtK, opts, type Workload } from "./shared";

export function registerTemporalWorkloads(smoke: boolean): Workload[] {
  const workloads: Workload[] = [];

  {
    const n = smoke ? 1_000 : 100_000;
    const spec = temporalLineSpec(n);
    workloads.push({
      id: `pipeline temporal-line ${fmtK(n)}`,
      group: `temporal line ${fmtK(n)}`,
      bench: `runPipeline temporal line ${fmtK(n)}`,
      fn: () => runPipeline(spec, opts),
    });
  }

  {
    const measurer = new MetricsTableMeasurer(FONT_METRICS);
    const input = {
      aesthetic: "x" as const,
      panelIndex: 0,
      domain: [Date.UTC(1800, 0, 1), Date.UTC(2100, 0, 1)] as const,
      kind: "date" as const,
      orient: "horizontal" as const,
      extentPx: 800,
      reverse: false,
      measurer,
      fontSize: 11.5,
      marginCapPx: 92,
      config: {},
    };
    const resizeInput = {
      ...input,
      domain: [Date.UTC(1835, 0, 1), Date.UTC(2025, 0, 1)] as const,
    };
    workloads.push(
      {
        id: "temporal guide candidate-selection 300y",
        group: "temporal guide candidate selection",
        bench: "planTemporalAxis 300-year domain",
        fn: () => planTemporalAxis(input),
      },
      {
        id: "temporal guide resize-churn 191y",
        group: "temporal guide responsive planning",
        bench: "planTemporalAxis 191-year resize sequence",
        fn: () => {
          let previousInterval: string | null | undefined;
          let result;
          for (const extentPx of [320, 640, 1_200, 640, 320]) {
            result = planTemporalAxis({
              ...resizeInput,
              extentPx,
              ...(previousInterval !== undefined && { previousInterval }),
            });
            previousInterval = result.interval;
          }
          return result;
        },
      },
      {
        id: "temporal guide DST-heavy 3y",
        group: "temporal guide zoned calendar planning",
        bench: "planTemporalAxis DST-heavy datetime domain",
        fn: () =>
          planTemporalAxis({
            ...input,
            domain: [Date.UTC(2022, 0, 1), Date.UTC(2025, 0, 1)],
            kind: "datetime",
            config: { timezone: "America/New_York", dateBreaks: "1 month" },
          }),
      },
    );
  }

  {
    const spec = temporalFreeFacetSpec(smoke ? 10 : 100);
    workloads.push({
      id: `pipeline temporal free-facets ${smoke ? "10" : "100"}`,
      group: `temporal free facets ${smoke ? "10" : "100"}`,
      bench: `runPipeline temporal free facets ${smoke ? "10" : "100"}`,
      fn: () => runPipeline(spec, { ...opts, width: 1_200, height: 900 }),
    });
  }

  return workloads;
}
