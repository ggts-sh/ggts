/**
 * Build ScenePanel[] and shared axis ticks from placements.
 */
import type { PanelCoordProjector } from "../coord-projector.js";
import { FONT_METRICS } from "../layout/font-metrics.js";
import { MetricsTableMeasurer, type TextMeasurer } from "../layout/measure.js";
import type { SceneAxis, ScenePanel, SceneTick } from "../scene.js";
import type { PositionScale } from "../scales/train.js";

import type { FacetPanelDef } from "./facets.js";
import { capSideStripLabel, isSideStrip } from "./facets-strip.js";
import { axisTicks, xAxisBandTitleOffset } from "./layout-helpers.js";
import type { PanelPlacement } from "./panel-layout.js";

const PROJECTED_LABEL_GAP_PX = 4;

function suppressProjectedLabelOverlap(
  ticks: readonly SceneTick[],
  orientation: "horizontal" | "vertical",
  measurer: TextMeasurer,
  fontSize: number,
): SceneTick[] {
  const output = ticks.map((tick) => ({ ...tick }));
  const labeled = output
    .filter((tick) => tick.label !== "")
    .toSorted((a, b) => (orientation === "horizontal" ? b.pos - a.pos : a.pos - b.pos));
  let boundary = orientation === "horizontal" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  for (const tick of labeled) {
    // Planner-managed band ticks (rotated / wrapped) were already fitted by the
    // band planner; measuring them here as centered single-line strings would
    // wrongly blank named bars under an active coord projector. Keep them intact.
    if (tick.angle !== undefined || (tick.lines !== undefined && tick.lines.length > 1)) {
      continue;
    }
    const half =
      orientation === "horizontal"
        ? measurer.measureWidth(tick.label, fontSize) / 2
        : measurer.measureHeight(fontSize) / 2;
    const fits =
      orientation === "horizontal"
        ? tick.pos + half <= boundary - PROJECTED_LABEL_GAP_PX
        : tick.pos - half >= boundary + PROJECTED_LABEL_GAP_PX;
    if (!fits) {
      tick.label = "";
      continue;
    }
    boundary = orientation === "horizontal" ? tick.pos - half : tick.pos + half;
  }
  return output;
}

function numericMinorTicks(
  scale: PositionScale,
  values: readonly number[] | undefined,
  major: readonly SceneTick[],
  extent: number,
  fromEnd: boolean,
): SceneTick[] {
  if (values === undefined || scale.type !== "linear") return [];
  // Callers pass major-only axes from axisTicks; collect values without a kind filter.
  const majorValues = new Set(major.map((tick) => tick.value));
  const unique = [
    ...new Set(
      values.filter((value) => {
        const normalized = scale.normalize(value);
        return (
          Number.isFinite(value) &&
          Number.isFinite(normalized) &&
          normalized >= 0 &&
          normalized <= 1 &&
          !majorValues.has(value)
        );
      }),
    ),
  ];
  return axisTicks(
    scale,
    unique.map((value) => ({ value, label: "", kind: "minor" as const, labeled: false })),
    extent,
    fromEnd,
  );
}

/** Single pass over ticks → major/minor grid positions (avoids 2× filter+map). */
function gridPositionsByKind(ticks: readonly SceneTick[]): {
  major: number[];
  minor: number[];
} {
  const major: number[] = [];
  const minor: number[] = [];
  for (const tick of ticks) {
    if (tick.kind === "major") major.push(tick.pos);
    else if (tick.kind === "minor") minor.push(tick.pos);
  }
  return { major, minor };
}

function buildScenePanel(
  input: {
    placements: readonly PanelPlacement[];
    facetPanels: readonly FacetPanelDef[];
    displayScales: (p: number) => { h: PositionScale; v: PositionScale };
    coordProjectors: readonly PanelCoordProjector[];
    axisTextSize: number;
    strip?: import("./facets-types.js").FacetStripConfig;
    stripBand?: number;
    measureText?: TextMeasurer | undefined;
    stripSize?: number;
    hAxisTextSize?: number;
    vAxisTextSize?: number;
    tickChromePx?: number;
    yTickChromePx?: number;
    yLabelsVisible?: boolean;
    hMinorBreaks?: readonly number[] | undefined;
    vMinorBreaks?: readonly number[] | undefined;
    degraded?: boolean;
  },
  p: number,
  measurer: TextMeasurer,
  stripSize: number,
): ScenePanel {
  const placement = input.placements[p]!;
  const { h, v } = input.displayScales(p);
  const majorBottom = axisTicks(h, placement.ticksH, placement.width, false);
  const majorLeft = axisTicks(v, placement.ticksV, placement.height, true);
  const projector = input.coordProjectors[p];
  const projectBottom = (tick: SceneTick): SceneTick => ({
    ...tick,
    pos:
      projector === undefined
        ? tick.pos
        : projector.x.projectFraction(tick.pos / placement.width) * placement.width,
  });
  const projectLeft = (tick: SceneTick): SceneTick => ({
    ...tick,
    pos:
      projector === undefined
        ? tick.pos
        : (1 - projector.y.projectFraction(1 - tick.pos / placement.height)) * placement.height,
  });
  const projectedBottom = [
    ...majorBottom,
    ...numericMinorTicks(h, input.hMinorBreaks, majorBottom, placement.width, false),
  ]
    .map((tick) => projectBottom(tick))
    .filter((tick) => Number.isFinite(tick.pos) && tick.pos >= 0 && tick.pos <= placement.width);
  const projectedLeft = [
    ...majorLeft,
    ...numericMinorTicks(v, input.vMinorBreaks, majorLeft, placement.height, true),
  ]
    .map((tick) => projectLeft(tick))
    .filter((tick) => Number.isFinite(tick.pos) && tick.pos >= 0 && tick.pos <= placement.height);
  const bottom =
    projector?.x.active === true
      ? suppressProjectedLabelOverlap(
          projectedBottom,
          "horizontal",
          measurer,
          input.hAxisTextSize ?? input.axisTextSize,
        )
      : projectedBottom;
  const left =
    projector?.y.active === true
      ? suppressProjectedLabelOverlap(
          projectedLeft,
          "vertical",
          measurer,
          input.vAxisTextSize ?? input.axisTextSize,
        )
      : projectedLeft;
  const xGrid = gridPositionsByKind(bottom);
  const yGrid = gridPositionsByKind(left);
  const label = input.facetPanels[p]!.label;
  const hasStrip = label !== "";
  const strip = input.strip!;
  const stripLabel =
    hasStrip && strip.show && isSideStrip(strip.position)
      ? capSideStripLabel(label, placement.height, measurer, stripSize)
      : label;
  return {
    identity: input.facetPanels[p]!.identity,
    id: input.facetPanels[p]!.id,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    strip: stripLabel,
    ...(hasStrip && {
      stripPosition: strip.position,
      showStrip: strip.show,
      stripBand: strip.show ? input.stripBand : 0,
    }),
    ...(placement.allocation !== undefined && { allocation: { ...placement.allocation } }),
    clip: projector?.clip ?? true,
    axisX: placement.showAxisX ? bottom : null,
    axisY: placement.showAxisY ? left : null,
    grid: {
      x: xGrid.major,
      y: yGrid.major,
      minorX: input.degraded === true ? [] : xGrid.minor,
      minorY: input.degraded === true ? [] : yGrid.minor,
    },
  };
}

function assembleSceneAxes(input: {
  scenePanels: readonly ScenePanel[];
  placements: readonly PanelPlacement[];
  hTitle: string;
  vTitle: string;
  measurer: TextMeasurer;
  tickChromePx: number;
  yTickChromePx: number;
  axisTextSize: number;
  vAxisTextSize?: number;
  yLabelsVisible?: boolean;
}): { xAxis: SceneAxis; yAxis: SceneAxis } {
  const firstX = input.scenePanels.find((p) => p.axisX !== null);
  const firstY = input.scenePanels.find((p) => p.axisY !== null);
  const gap = 10;
  const bandTitleOffset = xAxisBandTitleOffset(input.placements, input.tickChromePx);
  const yLabelsVisible = input.yLabelsVisible !== false;
  let yLabelBandPx = 0;
  if (input.vTitle !== "" && yLabelsVisible) {
    const fontSize = input.vAxisTextSize ?? input.axisTextSize;
    for (const tick of input.scenePanels.flatMap((panel) => panel.axisY ?? [])) {
      if (tick.label === "" || tick.showLabel === false) continue;
      const size = tick.labelSize ?? fontSize;
      const fragments =
        tick.lines !== undefined && tick.lines.length > 0 ? tick.lines : [tick.label];
      for (const fragment of fragments) {
        yLabelBandPx = Math.max(yLabelBandPx, input.measurer.measureWidth(fragment, size));
      }
    }
  }
  const yTitleClearance = yLabelBandPx > 0 ? input.yTickChromePx + yLabelBandPx + gap : 0;
  return {
    xAxis: {
      ticks: firstX?.axisX ?? [],
      title: input.hTitle,
      ...(bandTitleOffset > 0 && { titleOffset: bandTitleOffset }),
    },
    yAxis: {
      ticks: firstY?.axisY ?? [],
      title: input.vTitle,
      ...(yTitleClearance > 32 && { titleOffset: yTitleClearance }),
    },
  };
}

export function assembleScenePanels(input: {
  placements: readonly PanelPlacement[];
  facetPanels: readonly FacetPanelDef[];
  strip: import("./facets-types.js").FacetStripConfig;
  stripBand: number;
  displayScales: (p: number) => { h: PositionScale; v: PositionScale };
  hTitle: string;
  vTitle: string;
  coordProjectors: readonly PanelCoordProjector[];
  measureText?: TextMeasurer | undefined;
  axisTextSize: number;
  /** Theme strip font size used to cap rotated side-strip labels (#611). */
  stripSize?: number;
  /** Resolved per-axis guide font sizes used for projected-label collision checks. */
  hAxisTextSize?: number;
  vAxisTextSize?: number;
  /** Tick chrome (theme tickLength + label gap) below gridBottom; renderer-matched. */
  tickChromePx?: number;
  /** Tick chrome left of the y axis (theme tickLength + label gap); renderer-matched. */
  yTickChromePx?: number;
  /**
   * Whether y tick labels will be drawn (guide + theme). When false, skip y
   * titleOffset from label widths so hidden strings cannot inflate the offset.
   */
  yLabelsVisible?: boolean;
  hMinorBreaks?: readonly number[] | undefined;
  vMinorBreaks?: readonly number[] | undefined;
  degraded?: boolean;
}): {
  scenePanels: ScenePanel[];
  xAxis: SceneAxis;
  yAxis: SceneAxis;
} {
  const { placements, hTitle, vTitle } = input;
  const measurer = input.measureText ?? new MetricsTableMeasurer(FONT_METRICS);
  const stripSize = input.stripSize ?? 12;

  const scenePanels: ScenePanel[] = placements.map((_, p) =>
    buildScenePanel(input, p, measurer, stripSize),
  );

  const tickChromePx = input.tickChromePx ?? 9; // tickLength(6) + gap(3) defaults
  const yTickChromePx = input.yTickChromePx ?? tickChromePx;
  const { xAxis, yAxis } = assembleSceneAxes({
    scenePanels,
    placements,
    hTitle,
    vTitle,
    measurer,
    tickChromePx,
    yTickChromePx,
    axisTextSize: input.axisTextSize,
    ...(input.vAxisTextSize !== undefined && { vAxisTextSize: input.vAxisTextSize }),
    ...(input.yLabelsVisible !== undefined && { yLabelsVisible: input.yLabelsVisible }),
  });
  return { scenePanels, xAxis, yAxis };
}
