import { renderToSVGString, runPipeline } from "@ggts-sh/core";

import { facetedBarsSpec, lineSeriesSpec, stackedBarSpec } from "../workload-specs";
import { fmtK, opts, type Workload } from "./shared";

export function registerSeriesWorkloads(smoke: boolean): Workload[] {
  const workloads: Workload[] = [];

  {
    const spec = stackedBarSpec();
    workloads.push(
      {
        id: "pipeline stacked-bars 50x4",
        group: "stacked bars 50x4",
        bench: "runPipeline stacked bars 50x4",
        fn: () => runPipeline(spec, opts),
      },
      {
        id: "svg render stacked-bars 50x4",
        group: "stacked bars 50x4",
        bench: "renderToSVGString stacked bars 50x4",
        fn: () => renderToSVGString(spec, opts),
      },
    );
  }

  {
    const perSeries = smoke ? 1_000 : 10_000;
    const spec = lineSeriesSpec(perSeries);
    const label = `line series 10x${fmtK(perSeries)}`;
    workloads.push(
      {
        id: `pipeline line-series 10x${fmtK(perSeries)}`,
        group: label,
        bench: `runPipeline ${label}`,
        fn: () => runPipeline(spec, opts),
      },
      {
        id: `svg render line-series 10x${fmtK(perSeries)}`,
        group: label,
        bench: `renderToSVGString ${label}`,
        fn: () => renderToSVGString(spec, opts),
      },
    );
  }

  {
    const spec = facetedBarsSpec();
    workloads.push(
      {
        id: "pipeline faceted-bars 50 panels",
        group: "faceted bars 50 panels",
        bench: "runPipeline faceted bars 50 panels",
        fn: () => runPipeline(spec, opts),
      },
      {
        id: "svg render faceted-bars 50 panels",
        group: "faceted bars 50 panels",
        bench: "renderToSVGString faceted bars 50 panels",
        fn: () => renderToSVGString(spec, opts),
      },
    );
  }

  return workloads;
}
