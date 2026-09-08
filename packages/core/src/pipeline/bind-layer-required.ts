/**
 * Required-channel checks for bindLayer by geom/stat.
 *
 * Exhaustive over {@link NormalizedGeomName}: a geom with no arm is a compile
 * error, not a silent "require nothing" fall-through (#1042). Geoms that truly
 * need no x/y channels (function, abline, map, sf*, blank, qq*) have explicit
 * empty arms with comments — other channels are enforced elsewhere
 * (sample / map_id / label in bind-layer-extras, geometry in frame-stats-sf).
 */
import type { NormalizedGeomName, StatName } from "@ggts-sh/spec";

import { requireField } from "./bind-layer-check-field.js";
import type { RuleForm } from "./types.js";

type RequirementKind =
  | "xy"
  | "x"
  | "range"
  | "rect"
  | "ribbon"
  | "rule"
  | "segment"
  | "spoke"
  | "rug"
  | "none";

const GEOM_REQUIREMENT = {
  point: "xy",
  count: "xy",
  line: "xy",
  path: "xy",
  step: "xy",
  col: "xy",
  area: "xy",
  polygon: "xy",
  text: "xy",
  label: "xy",
  smooth: "xy",
  quantile: "xy",
  boxplot: "xy",
  violin: "xy",
  tile: "xy",
  raster: "xy",
  hex: "xy",
  density_2d: "xy",
  density_2d_filled: "xy",
  bin_2d: "xy",
  contour: "xy",
  bar: "x",
  density: "x",
  dotplot: "x",
  errorbar: "range",
  linerange: "range",
  pointrange: "range",
  crossbar: "range",
  rect: "rect",
  ribbon: "ribbon",
  rule: "rule",
  segment: "segment",
  curve: "segment",
  spoke: "spoke",
  rug: "rug",
  function: "none",
  abline: "none",
  map: "none",
  sf: "none",
  sf_text: "none",
  sf_label: "none",
  blank: "none",
  qq: "none",
  qq_line: "none",
} as const satisfies Record<NormalizedGeomName, RequirementKind>;

function requireRangeChannels(input: {
  geom: NormalizedGeomName;
  stat: StatName;
  index: number;
  xField: string | null;
  yField: string | null;
  yminField: string | null;
  ymaxField: string | null;
}): void {
  requireField(input.xField, "x", input.index, input.geom);
  if (input.stat === "summary" || input.stat === "summary_bin") {
    requireField(input.yField, "y", input.index, input.geom);
    return;
  }
  requireField(input.yminField, "ymin", input.index, input.geom);
  requireField(input.ymaxField, "ymax", input.index, input.geom);
  if (input.geom === "pointrange" || input.geom === "crossbar")
    requireField(input.yField, "y", input.index, input.geom);
}

function requireRibbonChannels(input: {
  geom: NormalizedGeomName;
  index: number;
  orientation: "x" | "y";
  xField: string | null;
  yField: string | null;
  yminField: string | null;
  ymaxField: string | null;
  xminField: string | null;
  xmaxField: string | null;
}): void {
  if (input.orientation === "x") {
    requireField(input.xField, "x", input.index, input.geom);
    requireField(input.yminField, "ymin", input.index, input.geom);
    requireField(input.ymaxField, "ymax", input.index, input.geom);
    return;
  }
  requireField(input.yField, "y", input.index, input.geom);
  requireField(input.xminField, "xmin", input.index, input.geom);
  requireField(input.xmaxField, "xmax", input.index, input.geom);
}

function requireSpokeChannels(input: {
  geom: NormalizedGeomName;
  index: number;
  xField: string | null;
  yField: string | null;
  angleField: string | null;
  radiusField: string | null;
  layerParams: unknown;
}): void {
  requireField(input.xField, "x", input.index, input.geom);
  requireField(input.yField, "y", input.index, input.geom);
  const params =
    typeof input.layerParams === "object" && input.layerParams !== null
      ? (input.layerParams as Record<string, unknown>)
      : {};
  if (input.angleField === null && params["angle"] === undefined)
    requireField(input.angleField, "angle", input.index, input.geom);
  if (input.radiusField === null && params["radius"] === undefined)
    requireField(input.radiusField, "radius", input.index, input.geom);
}

function requireXYChannels(input: {
  geom: NormalizedGeomName;
  index: number;
  xField: string | null;
  yField: string | null;
  yStatColumn: string | null;
}): void {
  requireField(input.xField, "x", input.index, input.geom);
  if (input.yStatColumn === null) requireField(input.yField, "y", input.index, input.geom);
}

function requireRuleChannels(
  geom: NormalizedGeomName,
  index: number,
  ruleForm: RuleForm | null,
  xField: string | null,
  yField: string | null,
): void {
  if (ruleForm === "vertical") requireField(xField, "x", index, geom);
  if (ruleForm === "horizontal") requireField(yField, "y", index, geom);
}

function requireRugChannels(
  geom: NormalizedGeomName,
  index: number,
  rugSides: string | undefined,
  xField: string | null,
  yField: string | null,
): void {
  const sides = rugSides !== undefined && rugSides.length > 0 ? rugSides : "bl";
  if (/[bt]/.test(sides)) requireField(xField, "x", index, geom);
  if (/[lr]/.test(sides)) requireField(yField, "y", index, geom);
}

export function assertRequiredChannels(input: {
  geom: NormalizedGeomName;
  stat: StatName;
  index: number;
  ruleForm: RuleForm | null;
  xField: string | null;
  yField: string | null;
  yStatColumn: string | null;
  yminField: string | null;
  ymaxField: string | null;
  xminField?: string | null;
  xmaxField?: string | null;
  xendField?: string | null;
  yendField?: string | null;
  angleField?: string | null;
  radiusField?: string | null;
  layerParams?: unknown;
  ribbonOrientation?: "x" | "y";
  /** Effective rug sides string (default bl) when geom is rug. */
  rugSides?: string;
}): void {
  const {
    geom,
    stat,
    index,
    ruleForm,
    xField,
    yField,
    yStatColumn,
    yminField,
    ymaxField,
    xminField = null,
    xmaxField = null,
    xendField = null,
    yendField = null,
    angleField = null,
    radiusField = null,
    layerParams,
    ribbonOrientation,
    rugSides,
  } = input;

  switch (GEOM_REQUIREMENT[geom]) {
    case "xy": {
      requireXYChannels({ geom, index, xField, yField, yStatColumn });
      break;
    }
    case "x": {
      requireField(xField, "x", index, geom);
      break;
    }
    case "range": {
      requireRangeChannels({ geom, stat, index, xField, yField, yminField, ymaxField });
      break;
    }
    case "rect": {
      requireField(xminField, "xmin", index, geom);
      requireField(xmaxField, "xmax", index, geom);
      requireField(yminField, "ymin", index, geom);
      requireField(ymaxField, "ymax", index, geom);
      break;
    }
    case "ribbon": {
      requireRibbonChannels({
        geom,
        index,
        orientation: ribbonOrientation ?? "x",
        xField,
        yField,
        yminField,
        ymaxField,
        xminField,
        xmaxField,
      });
      break;
    }
    case "rule": {
      requireRuleChannels(geom, index, ruleForm, xField, yField);
      break;
    }
    case "segment": {
      requireField(xField, "x", index, geom);
      requireField(yField, "y", index, geom);
      requireField(xendField, "xend", index, geom);
      requireField(yendField, "yend", index, geom);
      break;
    }
    case "spoke": {
      requireSpokeChannels({
        geom,
        index,
        xField,
        yField,
        angleField,
        radiusField,
        layerParams,
      });
      break;
    }
    case "rug": {
      requireRugChannels(geom, index, rugSides, xField, yField);
      break;
    }
    case "none":
      break;
    default: {
      const exhaustive: never = GEOM_REQUIREMENT[geom];
      throw new Error(`unhandled requirement in required channels: ${String(exhaustive)}`);
    }
  }
}
