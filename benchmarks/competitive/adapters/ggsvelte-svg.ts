/**
 * Lean SVG-only ggsvelte mounts (keeps @ggts-sh/core/dom and planStrata out of the graph).
 */
import { countMarks, renderToSVGString, runScene } from "@ggts-sh/core/headless";
import { mountSceneSvg } from "@ggts-sh/core/svg-live";
import type { SpecInput } from "@ggts-sh/spec/portable";

import {
  COLORS,
  PLOT_HEIGHT,
  PLOT_WIDTH,
  type BarsColumns,
  type ScatterColumns,
  type ScenarioId,
  type SeriesColumns,
} from "../scenarios";

type UpdateColumns = ScatterColumns | SeriesColumns | BarsColumns;

type MountHandle = {
  destroy: () => void;
  update: (data: UpdateColumns) => void;
};

export type MountResult = { markHint: number; handle: MountHandle };

// Specs use a named data ref ({ name: "main" }) built ONCE per scenario;
// mount/update feed columns via RunOptions.data so normalization never
// snapshots 30k cells through toPortable on an update (same posture as the
// canvas adapter). Inline columns remain for the bundle-* string entries.
const DATA_NAME = "main";

function scatterSpec(): SpecInput {
  return {
    data: { name: DATA_NAME },
    aes: { x: "x", y: "y", color: "cls" },
    layers: [{ geom: "point", render: "svg", params: { size: 1.5, alpha: 0.7 } }],
    scales: {
      color: {
        type: "ordinal",
        domain: ["series-0", "series-1", "series-2", "series-3", "series-4"],
        range: COLORS.slice(0, 5),
      },
    },
  };
}

function lineSpec(): SpecInput {
  return {
    data: { name: DATA_NAME },
    aes: { x: "x", y: "y", color: "series", group: "series" },
    layers: [{ geom: "line", render: "svg" }],
  };
}

function areaSpec(): SpecInput {
  // Identity (not stack): competitors overlay series; default geomArea is stack.
  return {
    data: { name: DATA_NAME },
    aes: { x: "x", y: "y", fill: "series", group: "series" },
    layers: [{ geom: "area", render: "svg", position: "identity" }],
  };
}

function barsSpec(): SpecInput {
  return {
    data: { name: DATA_NAME },
    aes: { x: "category", y: "value", fill: "stack" },
    layers: [{ geom: "col", render: "svg" }],
    scales: {
      fill: {
        type: "ordinal",
        domain: ["stack-0", "stack-1", "stack-2", "stack-3"],
        range: COLORS.slice(0, 4),
      },
    },
  };
}

export function scenarioSpec(scenario: ScenarioId): SpecInput {
  switch (scenario) {
    case "scatter-color":
      return scatterSpec();
    case "line-multiseries":
      return lineSpec();
    case "area-multiseries":
      return areaSpec();
    case "bars-stacked":
      return barsSpec();
  }
}

export function mountGgsvelteSvg(
  scenario: ScenarioId,
  data: ScatterColumns | SeriesColumns | BarsColumns,
  root: HTMLElement,
): MountResult {
  const portable = scenarioSpec(scenario);
  const run = (d: UpdateColumns) =>
    runScene(portable, { width: PLOT_WIDTH, height: PLOT_HEIGHT, data: { [DATA_NAME]: d } });
  // Live update path (#1471): mount once, then patch positionally on update.
  // The patcher falls back to a full remount whenever the scene skeleton
  // changes, so correctness matches the previous string-render + DOM swap.
  const initial = run(data);
  const live = mountSceneSvg(root, initial);
  return {
    markHint: countMarks(initial),
    handle: {
      update: (d) => {
        live.update(run(d));
      },
      destroy: () => {
        live.destroy();
      },
    },
  };
}

/** Inline-column variants for the bundle-measure string entries. */
function scatterSpecInline(data: ScatterColumns): SpecInput {
  return { ...scatterSpec(), data: { columns: data } };
}

function lineSpecInline(data: SeriesColumns): SpecInput {
  return { ...lineSpec(), data: { columns: data } };
}

function areaSpecInline(data: SeriesColumns): SpecInput {
  return { ...areaSpec(), data: { columns: data } };
}

function barsSpecInline(data: BarsColumns): SpecInput {
  return { ...barsSpec(), data: { columns: data } };
}

export function bundleScatterSvg(data: ScatterColumns): string {
  return renderToSVGString(scatterSpecInline(data), { width: PLOT_WIDTH, height: PLOT_HEIGHT });
}

export function bundleLineSvg(data: SeriesColumns): string {
  return renderToSVGString(lineSpecInline(data), { width: PLOT_WIDTH, height: PLOT_HEIGHT });
}

export function bundleAreaSvg(data: SeriesColumns): string {
  return renderToSVGString(areaSpecInline(data), { width: PLOT_WIDTH, height: PLOT_HEIGHT });
}

export function bundleBarsSvg(data: BarsColumns): string {
  return renderToSVGString(barsSpecInline(data), { width: PLOT_WIDTH, height: PLOT_HEIGHT });
}
