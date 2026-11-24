/**
 * Scene assembly from panel placements, axes, and legends.
 */
import type { PanelCoordProjector } from "../coord-projector.js";
import type { TextMeasurer } from "../layout/measure.js";
import type { GeometryBatch, Scene, SceneLegend, SceneTick } from "../scene.js";
import type { ThemeTokens } from "../theme.js";
import type { PositionScale } from "../scales/train.js";

import type { FacetPanelDef } from "./facets.js";
import type { AxisGuideAppearance } from "./guide-config.js";
import type { PanelPlacement } from "./panel-layout.js";
import { placeSceneLegends } from "./assemble-scene-legends.js";
import { LEGEND_EDGE_PAD, xTickChromePx } from "./layout-helpers.js";
import { assembleScenePanels } from "./assemble-scene-panels.js";

export interface AssembleSceneInput {
  width: number;
  height: number;
  placements: readonly PanelPlacement[];
  facetPanels: readonly FacetPanelDef[];
  strip: import("./facets-types.js").FacetStripConfig;
  stripBand: number;
  displayScales: (p: number) => { h: PositionScale; v: PositionScale };
  hTitle: string;
  vTitle: string;
  hGuide: AxisGuideAppearance;
  vGuide: AxisGuideAppearance;
  coordProjectors: readonly PanelCoordProjector[];
  measureText?: TextMeasurer | undefined;
  axisTextSize: number;
  hMinorBreaks?: readonly number[] | undefined;
  vMinorBreaks?: readonly number[] | undefined;
  batches: GeometryBatch[];
  legendBlock: { legends: SceneLegend[]; width: number; bottomHeight: number };
  topBand: number;
  bottomBand: number;
  degraded: boolean;
  theme: ThemeTokens;
  title: string;
  subtitle: string;
  caption: string;
}

function presentTicks(ticks: SceneTick[], guide: AssembleSceneInput["hGuide"]): SceneTick[] {
  return ticks.map((tick) => {
    const presented = { ...tick };
    if (guide.collision === "preserve") {
      presented.label = tick.fullLabel;
      delete presented.lines;
      delete presented.angle;
    }
    return {
      ...presented,
      showTick: guide.showTicks,
      showLabel: guide.showLabels,
      ...(guide.theme?.labelSize !== undefined && { labelSize: guide.theme.labelSize }),
    };
  });
}

function applyPanelGuide(
  panel: Scene["panels"][number],
  axis: "x" | "y",
  guide: AssembleSceneInput["hGuide"],
): void {
  const key = axis === "x" ? "axisX" : "axisY";
  const ticks = panel[key];
  if (!guide.visible) panel[key] = null;
  else if (ticks !== null) panel[key] = presentTicks(ticks, guide);
}

function applyPanelGuides(
  panels: Scene["panels"],
  hGuide: AssembleSceneInput["hGuide"],
  vGuide: AssembleSceneInput["vGuide"],
): void {
  for (const panel of panels) {
    applyPanelGuide(panel, "x", hGuide);
    applyPanelGuide(panel, "y", vGuide);
  }
}

function applyAxisGuides(
  xAxis: Scene["axes"]["x"],
  yAxis: Scene["axes"]["y"],
  hGuide: AssembleSceneInput["hGuide"],
  vGuide: AssembleSceneInput["vGuide"],
): void {
  if (hGuide.theme?.titleSize !== undefined) xAxis.titleSize = hGuide.theme.titleSize;
  if (vGuide.theme?.titleSize !== undefined) yAxis.titleSize = vGuide.theme.titleSize;
  xAxis.ticks = hGuide.visible ? presentTicks(xAxis.ticks, hGuide) : [];
  yAxis.ticks = vGuide.visible ? presentTicks(yAxis.ticks, vGuide) : [];
}

function sceneBounds(
  panels: Scene["panels"],
  topBand: number,
): { panelX: number; panelY: number; minimumLegendY: number } {
  return {
    panelX: panels.length === 0 ? 0 : Math.min(...panels.map((panel) => panel.x)),
    panelY: panels.length === 0 ? topBand : Math.min(...panels.map((panel) => panel.y)),
    minimumLegendY:
      panels.length === 0
        ? topBand
        : Math.min(...panels.map((panel) => panel.allocation?.y ?? panel.y)),
  };
}

export function assembleScene(input: AssembleSceneInput): Scene {
  const {
    width,
    height,
    placements,
    facetPanels,
    strip,
    stripBand,
    displayScales,
    hTitle,
    vTitle,
    hGuide,
    vGuide,
    coordProjectors,
    measureText,
    axisTextSize,
    hMinorBreaks,
    vMinorBreaks,
    batches,
    legendBlock,
    topBand,
    bottomBand,
    degraded,
    theme,
    title,
    subtitle,
    caption,
  } = input;

  // Tick chrome between gridBottom and the first x-label line, matching the SVG
  // renderer's own offset so a custom (longer/hidden) tick theme keeps the
  // band-label axis title clear of the labels. Same idea for y (left of gridLeft).
  const tickChromePx = xTickChromePx(theme.tickLength, theme.ticksX && hGuide.showTicks);
  const yTickChromePx = xTickChromePx(theme.tickLength, theme.ticksY && vGuide.showTicks);
  const { scenePanels, xAxis, yAxis } = assembleScenePanels({
    placements,
    facetPanels,
    strip,
    stripBand,
    displayScales,
    hTitle,
    vTitle,
    coordProjectors,
    ...(measureText !== undefined && { measureText }),
    axisTextSize,
    stripSize: theme.stripSize,
    hAxisTextSize: hGuide.theme?.labelSize ?? axisTextSize,
    vAxisTextSize: vGuide.theme?.labelSize ?? axisTextSize,
    tickChromePx,
    yTickChromePx,
    yLabelsVisible: vGuide.showLabels,
    degraded,
    ...(hMinorBreaks !== undefined && { hMinorBreaks }),
    ...(vMinorBreaks !== undefined && { vMinorBreaks }),
  });

  applyPanelGuides(scenePanels, hGuide, vGuide);
  applyAxisGuides(xAxis, yAxis, hGuide, vGuide);
  const { panelX, panelY, minimumLegendY } = sceneBounds(scenePanels, topBand);
  const legends = placeSceneLegends({
    legends: legendBlock.legends,
    legendWidth: legendBlock.width,
    sceneWidth: width,
    panelX,
    panelY,
    minimumY: minimumLegendY,
    sceneHeight: height,
    rightBottomInset: bottomBand + LEGEND_EDGE_PAD,
    bottomLegendY: height - bottomBand - LEGEND_EDGE_PAD - legendBlock.bottomHeight,
  });

  return {
    width,
    height,
    panels: scenePanels,
    ...(degraded && { layout: "degraded" as const }),
    batches,
    axes: { x: xAxis, y: yAxis },
    grid: {
      x: scenePanels[0]?.grid.x ?? [],
      y: scenePanels[0]?.grid.y ?? [],
    },
    legends,
    theme,
    title,
    subtitle,
    caption,
  };
}
