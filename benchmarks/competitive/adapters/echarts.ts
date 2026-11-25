/**
 * Apache ECharts competitive mounts (Canvas).
 */
import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

import {
  COLORS,
  PLOT_HEIGHT,
  PLOT_WIDTH,
  type BarsColumns,
  type ScatterColumns,
  type ScenarioId,
  type SeriesColumns,
} from "../scenarios";

echarts.use([
  ScatterChart,
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

type UpdateColumns = ScatterColumns | SeriesColumns | BarsColumns;

export type EChartsHandle = {
  destroy: () => void;
  /** ECharts in-place update: setOption with the new series data (merge mode). */
  update: (data: UpdateColumns) => void;
};

function hostIn(root: HTMLElement): HTMLDivElement {
  root.replaceChildren();
  const el = document.createElement("div");
  el.style.width = `${PLOT_WIDTH}px`;
  el.style.height = `${PLOT_HEIGHT}px`;
  root.appendChild(el);
  return el;
}

function seriesFromLong(data: SeriesColumns) {
  const groups = new Map<string, [number, number][]>();
  for (let i = 0; i < data.series.length; i++) {
    const name = data.series[i]!;
    const point: [number, number] = [data.x[i]!, data.y[i]!];
    const points = groups.get(name);
    if (points === undefined) groups.set(name, [point]);
    else points.push(point);
  }
  return Array.from(groups, ([name, pts]) => ({ name, pts }));
}

export function scatterPointsByClass(scatter: ScatterColumns): Map<string, [number, number][]> {
  const groups = new Map<string, [number, number][]>();
  // The full class column sets series order, including classes with no points.
  for (const name of new Set(scatter.cls)) groups.set(name, []);
  for (let i = 0; i < scatter.x.length; i++) {
    if (!(i in scatter.x)) continue;
    groups.get(scatter.cls[i]!)?.push([scatter.x[i]!, scatter.y[i]!]);
  }
  return groups;
}

export function mountEcharts(
  scenario: ScenarioId,
  data: ScatterColumns | SeriesColumns | BarsColumns,
  root: HTMLElement,
): { markHint: number; handle: EChartsHandle } {
  const el = hostIn(root);
  const chart = echarts.init(el, undefined, {
    width: PLOT_WIDTH,
    height: PLOT_HEIGHT,
    renderer: "canvas",
  });

  if (scenario === "scatter-color") {
    const optionFor = (scatter: ScatterColumns) => {
      return {
        animation: false,
        grid: { left: 50, right: 20, top: 20, bottom: 40 },
        xAxis: { type: "value" },
        yAxis: { type: "value" },
        series: Array.from(scatterPointsByClass(scatter), ([name, data], i) => ({
          type: "scatter",
          name,
          symbolSize: 3,
          itemStyle: { color: COLORS[i % COLORS.length], opacity: 0.7 },
          data,
        })),
      };
    };
    const scatter = data as ScatterColumns;
    chart.setOption(optionFor(scatter));
    return {
      markHint: scatter.x.length,
      handle: {
        destroy: () => {
          chart.dispose();
        },
        update: (d) => {
          // Replace the complete series array so rotated categorical labels
          // cannot leave stale ECharts series behind.
          chart.setOption(optionFor(d as ScatterColumns), { replaceMerge: ["series"] });
        },
      },
    };
  }

  if (scenario === "bars-stacked") {
    const optionFor = (bars: BarsColumns) => {
      const categories = [...new Set(bars.category)];
      const stacks = [...new Set(bars.stack)];
      return {
        animation: false,
        grid: { left: 50, right: 20, top: 20, bottom: 40 },
        xAxis: { type: "category", data: categories },
        yAxis: { type: "value" },
        series: stacks.map((stack, i) => ({
          type: "bar",
          name: stack,
          stack: "total",
          itemStyle: { color: COLORS[i % COLORS.length] },
          data: categories.map((cat) => {
            for (let j = 0; j < bars.category.length; j++) {
              if (bars.category[j] === cat && bars.stack[j] === stack) return bars.value[j]!;
            }
            return 0;
          }),
        })),
      };
    };
    const bars = data as BarsColumns;
    chart.setOption(optionFor(bars));
    return {
      markHint: bars.category.length,
      handle: {
        destroy: () => {
          chart.dispose();
        },
        update: (d) => {
          chart.setOption(optionFor(d as BarsColumns), { replaceMerge: ["series"] });
        },
      },
    };
  }

  const seriesData = data as SeriesColumns;
  const filled = scenario === "area-multiseries";
  const optionFor = (d: SeriesColumns) => {
    const datasets = seriesFromLong(d);
    return {
      animation: false,
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      xAxis: { type: "value" },
      yAxis: { type: "value" },
      series: datasets.map((ds, i) => ({
        type: "line",
        name: ds.name,
        showSymbol: false,
        itemStyle: { color: COLORS[i % COLORS.length] },
        areaStyle: filled ? { opacity: 0.25 } : undefined,
        data: ds.pts,
      })),
    };
  };
  chart.setOption(optionFor(seriesData));
  return {
    markHint: seriesData.x.length,
    handle: {
      destroy: () => {
        chart.dispose();
      },
      update: (d) => {
        chart.setOption(optionFor(d as SeriesColumns), { replaceMerge: ["series"] });
      },
    },
  };
}
