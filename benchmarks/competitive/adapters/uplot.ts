/**
 * uPlot competitive mounts (Canvas). Primary external speed bar for multi-series lines.
 */
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

import {
  COLORS,
  PLOT_HEIGHT,
  PLOT_WIDTH,
  type ScatterColumns,
  type ScenarioId,
  type SeriesColumns,
} from "../scenarios";

type UpdateColumns = ScatterColumns | SeriesColumns;

export type UPlotHandle = {
  destroy: () => void;
  /** uPlot's actual in-place update API: setData with same-shape aligned data. */
  update: (data: UpdateColumns) => void;
};

function seriesFromLong(data: SeriesColumns): {
  xs: number[];
  ys: number[][];
  names: string[];
} {
  const names = [...new Set(data.series)];
  const points = data.x.length / names.length;
  // Require shared x grid (makeMultiSeries guarantees this).
  const xs = data.x.slice(0, points);
  const ys = names.map((name) => {
    const out = Array.from<number>({ length: points });
    let j = 0;
    for (let i = 0; i < data.series.length; i++) {
      if (data.series[i] === name) out[j++] = data.y[i]!;
    }
    return out;
  });
  return { xs, ys, names };
}

export function createScatterAligner() {
  let cached: { x: number[]; order: number[] } | undefined;
  return ({ x, y }: Pick<ScatterColumns, "x" | "y">): uPlot.AlignedData => {
    if (
      cached === undefined ||
      cached.x.length !== x.length ||
      !cached.x.every((value, index) => Object.is(value, x[index]))
    ) {
      // Snapshot x so a later in-place edit invalidates the order.
      cached = {
        x: [...x],
        order: Array.from({ length: x.length }, (_, i) => i).toSorted((a, b) => x[a]! - x[b]!),
      };
    }
    return [cached.order.map((i) => x[i]!), cached.order.map((i) => y[i]!)];
  };
}

export function mountUplot(
  scenario: ScenarioId,
  data: ScatterColumns | SeriesColumns,
  root: HTMLElement,
): { markHint: number; handle: UPlotHandle } {
  root.replaceChildren();
  if (scenario === "scatter-color") {
    // uPlot reads the x domain from the first and last samples.
    const aligned = createScatterAligner();
    const scatter = data as ScatterColumns;
    // uPlot is not a scatter specialist; plot as points with one series of x/y.
    // Fairness: still a cold canvas chart with N markers.
    const opts: uPlot.Options = {
      width: PLOT_WIDTH,
      height: PLOT_HEIGHT,
      series: [
        {},
        {
          label: "y",
          stroke: COLORS[0],
          paths: () => null,
          points: { show: true, size: 3, fill: COLORS[0] },
        },
      ],
      scales: { x: { time: false }, y: {} },
      axes: [{}, {}],
      legend: { show: false },
    };
    const u = new uPlot(opts, aligned(scatter), root);
    return {
      markHint: scatter.x.length,
      handle: {
        destroy: () => u.destroy(),
        update: (d) => {
          u.setData(aligned(d as ScatterColumns));
        },
      },
    };
  }

  const seriesData = data as SeriesColumns;
  const { xs, ys, names } = seriesFromLong(seriesData);
  const filled = scenario === "area-multiseries";
  const series: uPlot.Series[] = [
    {},
    ...names.map((name, i) => ({
      label: name,
      stroke: COLORS[i % COLORS.length],
      fill: filled ? COLORS[i % COLORS.length] : undefined,
      width: 1.5,
      points: { show: false },
    })),
  ];
  // uPlot fill needs alpha via fill-opacity CSS or rgba — use stroke-only for line,
  // and a light fill when area.
  if (filled) {
    for (let i = 1; i < series.length; i++) {
      const c = COLORS[(i - 1) % COLORS.length]!;
      series[i] = {
        ...series[i],
        fill: c,
        // uPlot accepts fill as color; opacity via fillTo
        paths: uPlot.paths.linear!(),
      };
    }
  }
  const opts: uPlot.Options = {
    width: PLOT_WIDTH,
    height: PLOT_HEIGHT,
    series,
    scales: { x: { time: false }, y: {} },
    axes: [{}, {}],
    legend: { show: false },
  };
  const aligned: uPlot.AlignedData = [xs, ...ys];
  const u = new uPlot(opts, aligned, root);
  return {
    markHint: names.length * xs.length,
    handle: {
      destroy: () => u.destroy(),
      update: (d) => {
        const next = seriesFromLong(d as SeriesColumns);
        u.setData([next.xs, ...next.ys]);
      },
    },
  };
}
