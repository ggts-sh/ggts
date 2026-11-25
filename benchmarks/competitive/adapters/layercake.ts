/**
 * LayerCake competitive mounts (Svelte 5 components, SVG marks) plus the
 * Canvas-layout fast path (mountLayerCakeCanvas).
 *
 * Update scoreboard: mount passes a $state proxy (fixtures/props.svelte.ts)
 * as the props object; update() assigns props.rows + flushSync() so Svelte 5
 * reactive props propagate through <LayerCake> into the mark components —
 * no remount. Canvas marks additionally re-draw via a $effect on $data (see
 * components/layercake/*Canvas.svelte).
 */
import { stack as d3Stack } from "d3-shape";
import { flushSync, mount, unmount } from "svelte";

import AreaChart from "../components/layercake/AreaChart.svelte";
import BarsChart from "../components/layercake/BarsChart.svelte";
import LineCanvasChart from "../components/layercake/LineCanvasChart.svelte";
import LineChart from "../components/layercake/LineChart.svelte";
import ScatterCanvasChart from "../components/layercake/ScatterCanvasChart.svelte";
import ScatterChart from "../components/layercake/ScatterChart.svelte";
import {
  COLORS,
  PLOT_HEIGHT,
  PLOT_WIDTH,
  type BarsColumns,
  type ScatterColumns,
  type ScenarioId,
  type SeriesColumns,
} from "../scenarios";
import { pivotStackedBars } from "./bar-columns";

type UpdateColumns = ScatterColumns | SeriesColumns | BarsColumns;

export type LayerCakeHandle = {
  destroy: () => void;
  update: (data: UpdateColumns) => void;
};

type ScatterRow = { x: number; y: number; cls: string };
type SeriesRow = { x: number; y: number; series: string; color: string };
type BarRow = { category: string; y0: number; y1: number; stack: string; color: string };

function buildScatterRows(scatter: ScatterColumns): ScatterRow[] {
  return scatter.x.map((x, i) => ({
    x,
    y: scatter.y[i]!,
    cls: scatter.cls[i]!,
  }));
}

function buildSeriesRows(seriesData: SeriesColumns): SeriesRow[] {
  const seriesIndex = new Map<string, number>();
  for (const name of seriesData.series) {
    if (!seriesIndex.has(name)) seriesIndex.set(name, seriesIndex.size);
  }
  return seriesData.x.map((x, i) => {
    const series = seriesData.series[i]!;
    const sIndex = seriesIndex.get(series)!;
    return {
      x,
      y: seriesData.y[i]!,
      series,
      color: COLORS[sIndex % COLORS.length]!,
    };
  });
}

/**
 * Genuinely stacked bars: mirror the raw d3 adapter — pivot to wide format,
 * run d3-shape stack(), then flatten to long rows carrying the stacked
 * offsets (y0/y1) and a precomputed color per stack (same posture as the
 * line path's color Map).
 */
function buildBarRows(bars: BarsColumns): BarRow[] {
  const { categories, stacks, wide } = pivotStackedBars(bars);
  const layers = d3Stack<Record<string, string | number>>().keys(stacks)(wide);
  return layers.flatMap((layer, s) =>
    layer.map((d, i) => ({
      category: categories[i]!,
      y0: d[0],
      y1: d[1],
      stack: layer.key,
      color: COLORS[s % COLORS.length]!,
    })),
  );
}

function makeHandle(comp: unknown, update: (d: UpdateColumns) => void): LayerCakeHandle {
  return {
    destroy: () => {
      try {
        void unmount(comp as Parameters<typeof unmount>[0]);
      } catch {
        // already unmounted
      }
    },
    update,
  };
}

export function mountLayerCake(
  scenario: ScenarioId,
  data: ScatterColumns | SeriesColumns | BarsColumns,
  root: HTMLElement,
): { markHint: number; handle: LayerCakeHandle } {
  root.replaceChildren();
  let comp;
  let update: (d: UpdateColumns) => void;
  if (scenario === "scatter-color") {
    const props = {
      rows: buildScatterRows(data as ScatterColumns),
      width: PLOT_WIDTH,
      height: PLOT_HEIGHT,
    };
    comp = mount(ScatterChart, { target: root, props });
    update = (d) => {
      comp.setRows(buildScatterRows(d as ScatterColumns));
      flushSync();
    };
  } else if (scenario === "line-multiseries") {
    const props = {
      rows: buildSeriesRows(data as SeriesColumns),
      width: PLOT_WIDTH,
      height: PLOT_HEIGHT,
    };
    comp = mount(LineChart, { target: root, props });
    update = (d) => {
      comp.setRows(buildSeriesRows(d as SeriesColumns));
      flushSync();
    };
  } else if (scenario === "area-multiseries") {
    const props = {
      rows: buildSeriesRows(data as SeriesColumns),
      width: PLOT_WIDTH,
      height: PLOT_HEIGHT,
    };
    comp = mount(AreaChart, { target: root, props });
    update = (d) => {
      comp.setRows(buildSeriesRows(d as SeriesColumns));
      flushSync();
    };
  } else if (scenario === "bars-stacked") {
    const props = {
      rows: buildBarRows(data as BarsColumns),
      width: PLOT_WIDTH,
      height: PLOT_HEIGHT,
    };
    comp = mount(BarsChart, { target: root, props });
    update = (d) => {
      comp.setRows(buildBarRows(d as BarsColumns));
      flushSync();
    };
  } else {
    throw new Error(`layercake does not implement ${scenario}`);
  }
  flushSync();
  return {
    markHint: root.querySelectorAll("circle, path, rect").length,
    handle: makeHandle(comp, update),
  };
}

/**
 * Canvas-layout fast path (LayerCake's own <Canvas> layout): one 2D-context
 * draw pass, no per-mark DOM. markHint is the row count — canvas marks leave
 * no DOM to count, matching how the uplot/echarts canvas adapters report n.
 */
export function mountLayerCakeCanvas(
  scenario: ScenarioId,
  data: ScatterColumns | SeriesColumns | BarsColumns,
  root: HTMLElement,
): { markHint: number; handle: LayerCakeHandle } {
  root.replaceChildren();
  let comp;
  let n: number;
  let update: (d: UpdateColumns) => void;
  if (scenario === "scatter-color") {
    const props = {
      rows: buildScatterRows(data as ScatterColumns),
      width: PLOT_WIDTH,
      height: PLOT_HEIGHT,
    };
    n = props.rows.length;
    comp = mount(ScatterCanvasChart, { target: root, props });
    update = (d) => {
      comp.setRows(buildScatterRows(d as ScatterColumns));
      flushSync();
    };
  } else if (scenario === "line-multiseries") {
    const props = {
      rows: buildSeriesRows(data as SeriesColumns),
      width: PLOT_WIDTH,
      height: PLOT_HEIGHT,
    };
    n = props.rows.length;
    comp = mount(LineCanvasChart, { target: root, props });
    update = (d) => {
      comp.setRows(buildSeriesRows(d as SeriesColumns));
      flushSync();
    };
  } else {
    throw new Error(`layercake-canvas does not implement ${scenario}`);
  }
  flushSync();
  return {
    markHint: n,
    handle: makeHandle(comp, update),
  };
}
