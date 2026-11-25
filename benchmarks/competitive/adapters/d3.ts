/**
 * Raw D3 competitive mounts (SVG). Baseline for "hand-rolled" cost.
 *
 * Update scoreboard: mount keeps the svg root, axis groups, mark groups and
 * join selections in closure; update() re-runs the same render with new data
 * via the proper d3 data-join pattern (no transitions). Scales/axes are
 * recomputed per render since domains move with the data.
 */
import { extent, max, rollup } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { scaleBand, scaleLinear, scaleOrdinal } from "d3-scale";
import { select } from "d3-selection";
import { area as d3Area, line as d3Line, stack as d3Stack } from "d3-shape";

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

const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };

type UpdateColumns = ScatterColumns | SeriesColumns | BarsColumns;

type D3Handle = {
  destroy: () => void;
  update: (data: UpdateColumns) => void;
};

export type D3MountResult = { markHint: number; handle: D3Handle };

function chartRoot(root: HTMLElement) {
  root.replaceChildren();
  const iw = PLOT_WIDTH - MARGIN.left - MARGIN.right;
  const ih = PLOT_HEIGHT - MARGIN.top - MARGIN.bottom;
  const svg = select(root).append("svg").attr("width", PLOT_WIDTH).attr("height", PLOT_HEIGHT);
  const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
  return { g, iw, ih };
}

export function mountD3(
  scenario: ScenarioId,
  data: ScatterColumns | SeriesColumns | BarsColumns,
  root: HTMLElement,
): D3MountResult {
  switch (scenario) {
    case "scatter-color":
      return mountScatter(data as ScatterColumns, root);
    case "line-multiseries":
      return mountLine(data as SeriesColumns, root, false);
    case "area-multiseries":
      return mountLine(data as SeriesColumns, root, true);
    case "bars-stacked":
      return mountBars(data as BarsColumns, root);
  }
}

function makeHandle(root: HTMLElement, render: (d: UpdateColumns) => void): D3Handle {
  return {
    destroy: () => {
      root.replaceChildren();
    },
    update: render,
  };
}

function mountScatter(initial: ScatterColumns, root: HTMLElement): D3MountResult {
  const { g, iw, ih } = chartRoot(root);
  const color = scaleOrdinal<string, string>()
    .domain(["series-0", "series-1", "series-2", "series-3", "series-4"])
    .range([...COLORS]);
  const xAxisG = g.append("g").attr("transform", `translate(0,${ih})`);
  const yAxisG = g.append("g");
  const marksG = g.append("g");
  const render = (data: ScatterColumns): number => {
    const rows = data.x.map((x, i) => ({ x, y: data.y[i]!, cls: data.cls[i]! }));
    const x = scaleLinear()
      .domain(extent(rows, (d) => d.x) as [number, number])
      .nice()
      .range([0, iw]);
    const y = scaleLinear()
      .domain(extent(rows, (d) => d.y) as [number, number])
      .nice()
      .range([ih, 0]);
    xAxisG.call(axisBottom(x));
    yAxisG.call(axisLeft(y));
    marksG
      .selectAll("circle")
      .data(rows)
      .join("circle")
      .attr("cx", (d) => x(d.x))
      .attr("cy", (d) => y(d.y))
      .attr("r", 1.5)
      .attr("fill", (d) => color(d.cls))
      .attr("fill-opacity", 0.7);
    return rows.length;
  };
  const markHint = render(initial);
  return {
    markHint,
    handle: makeHandle(root, (d) => {
      render(d as ScatterColumns);
    }),
  };
}

function mountLine(initial: SeriesColumns, root: HTMLElement, filled: boolean): D3MountResult {
  const { g, iw, ih } = chartRoot(root);
  const xAxisG = g.append("g").attr("transform", `translate(0,${ih})`);
  const yAxisG = g.append("g");
  const areaG = g.append("g");
  const lineG = g.append("g");
  const render = (data: SeriesColumns): number => {
    const seriesNames = [...new Set(data.series)];
    const x = scaleLinear()
      .domain(extent(data.x) as [number, number])
      .range([0, iw]);
    const y = scaleLinear()
      .domain(extent(data.y) as [number, number])
      .nice()
      .range([ih, 0]);
    const color = scaleOrdinal<string, string>()
      .domain(seriesNames)
      .range([...COLORS]);
    xAxisG.call(axisBottom(x).ticks(6));
    yAxisG.call(axisLeft(y));
    const bySeries = rollup(
      data.x.map((xv, i) => ({ x: xv, y: data.y[i]!, series: data.series[i]! })),
      (v) => v,
      (d) => d.series,
    );
    const layers = [...bySeries.entries()].map(([name, pts]) => ({
      name,
      pts: pts.toSorted((a, b) => a.x - b.x),
    }));
    const lineGen = d3Line<{ x: number; y: number }>()
      .x((d) => x(d.x))
      .y((d) => y(d.y));
    const areaGen = d3Area<{ x: number; y: number }>()
      .x((d) => x(d.x))
      .y0(ih)
      .y1((d) => y(d.y));
    if (filled) {
      areaG
        .selectAll("path")
        .data(layers, (d) => (d as { name: string }).name)
        .join("path")
        .attr("d", (d) => areaGen(d.pts))
        .attr("fill", (d) => color(d.name))
        .attr("fill-opacity", 0.35)
        .attr("stroke", "none");
    }
    lineG
      .selectAll("path")
      .data(layers, (d) => (d as { name: string }).name)
      .join("path")
      .attr("d", (d) => lineGen(d.pts))
      .attr("fill", "none")
      .attr("stroke", (d) => color(d.name))
      .attr("stroke-width", 1.5);
    return seriesNames.length * (filled ? 2 : 1);
  };
  const markHint = render(initial);
  return {
    markHint,
    handle: makeHandle(root, (d) => {
      render(d as SeriesColumns);
    }),
  };
}

function mountBars(initial: BarsColumns, root: HTMLElement): D3MountResult {
  const { g, iw, ih } = chartRoot(root);
  const xAxisG = g.append("g").attr("transform", `translate(0,${ih})`);
  const yAxisG = g.append("g");
  const marksG = g.append("g");
  const render = (data: BarsColumns): number => {
    const { categories, stacks, wide } = pivotStackedBars(data);
    const stackGen = d3Stack<Record<string, string | number>>().keys(stacks);
    const series = stackGen(wide);
    const x = scaleBand().domain(categories).range([0, iw]).padding(0.15);
    const y = scaleLinear()
      .domain([0, max(series, (s) => max(s, (d) => d[1])) ?? 1])
      .nice()
      .range([ih, 0]);
    const color = scaleOrdinal<string, string>()
      .domain(stacks)
      .range([...COLORS]);
    xAxisG.call(axisBottom(x));
    yAxisG.call(axisLeft(y));
    const flat = series.flatMap((layer) => layer.map((d) => ({ key: layer.key, d })));
    marksG
      .selectAll("rect")
      .data(
        flat,
        (f) =>
          `${(f as { key: string }).key}:${String((f as { d: { data: Record<string, unknown> } }).d.data["category"])}`,
      )
      .join("rect")
      .attr("x", (f) => x(String(f.d.data["category"])) ?? 0)
      .attr("y", (f) => y(f.d[1]))
      .attr("height", (f) => Math.max(0, y(f.d[0]) - y(f.d[1])))
      .attr("width", x.bandwidth())
      .attr("fill", (f) => color(f.key));
    return data.category.length;
  };
  const markHint = render(initial);
  return {
    markHint,
    handle: makeHandle(root, (d) => {
      render(d as BarsColumns);
    }),
  };
}
