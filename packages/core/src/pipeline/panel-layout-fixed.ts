import type { CoordFixedSpec, CoordSfSpec, Scales } from "@ggts-sh/spec";

import type { Tick } from "../layout/layout-types.js";
import type { AxisGuidePlan } from "../layout/temporal-guide.js";
import type { PositionScale } from "../scales/train.js";

import type { PanelPlacement } from "./panel-layout-types.js";
import { PipelineError, type PipelineWarning } from "./types.js";

const MIN_READABLE_FIXED_PANEL_PX = 64;

function scaleSpaceSpan(scale: PositionScale): number {
  if (scale.type === "band") return Math.max(1, scale.rawDomain.length);
  const span = Math.abs(scale.transformedDomain[1] - scale.transformedDomain[0]);
  return Number.isFinite(span) && span > 0 ? span : 1;
}

function fitAutomaticTicks<T>(ticks: readonly T[], fraction: number, degraded: boolean): T[] {
  const target = Math.max(
    Math.min(2, ticks.length),
    Math.min(ticks.length, degraded ? 3 : Math.floor(ticks.length * fraction)),
  );
  if (target >= ticks.length) return [...ticks];
  return Array.from({ length: target }, (_, index) => {
    const sourceIndex = Math.round((index * (ticks.length - 1)) / Math.max(1, target - 1));
    return ticks[sourceIndex]!;
  });
}

/** Keep guide-plan disclosure aligned with placement ticks after fixed-aspect thinning. */
function thinGuidePlan(
  plan: AxisGuidePlan | undefined,
  fraction: number,
  degraded: boolean,
): AxisGuidePlan | undefined {
  if (plan === undefined) return undefined;
  const ticks = fitAutomaticTicks(plan.ticks, fraction, degraded);
  if (ticks.length === plan.ticks.length) return plan;
  return Object.freeze({
    ...plan,
    ticks: Object.freeze(ticks.map((tick) => Object.freeze({ ...tick }))),
  });
}

function thinAutomaticAxis(
  ticks: readonly Tick[],
  plan: AxisGuidePlan | undefined,
  fraction: number,
  degraded: boolean,
): { ticks: Tick[]; guidePlan?: AxisGuidePlan } {
  const thinnedTicks = fitAutomaticTicks(ticks, fraction, degraded);
  const guidePlan = thinGuidePlan(plan, fraction, degraded);
  return {
    ticks: thinnedTicks,
    ...(guidePlan !== undefined && { guidePlan }),
  };
}

export interface FixedAspectLayoutResult {
  placements: PanelPlacement[];
  degraded: boolean;
}

/**
 * Fit equal fixed-aspect data rectangles inside already-reserved panel allocations.
 * Chart chrome is therefore authoritative; this pass can only add paper gutters.
 */
/** Fixed-aspect coord forms that share the same layout pass (`fixed` + `sf`). */
/**
 * Fixed-aspect layout inputs: fixed, sf, or radial.
 * For radial, `aspect` is panel pixel height/width (ggplot2 polar bbox aspect:
 * full circle → 1; partial arcs → diff(bbox.y)/diff(bbox.x)).
 */
export type FixedAspectCoordSpec =
  | CoordFixedSpec
  | CoordSfSpec
  | { type: "radial"; aspect?: number };

function assertFixedFacetScales(input: { freeX: boolean; freeY: boolean }, name: string): void {
  if (!input.freeX && !input.freeY) return;
  const cause =
    "Fixed-aspect coordinates cannot assign one truthful physical data-unit ratio across free positional facet scales.";
  throw new PipelineError("coord-fixed-free-scales", "/facet/scales", cause, {
    code: "coord-fixed-free-scales",
    severity: "error",
    path: "/facet/scales",
    problem: `${name} is incompatible with free positional facet scales.`,
    cause,
    fixes: [
      { description: 'Use facet.scales = "fixed".' },
      { description: `Remove the ${name} coordinate.` },
    ],
    documentationUrl: "/guide/coordinate-systems#fixed-aspect",
  });
}

function invalidAspect(
  problem: string,
  cause: string,
  name: string,
  path: string,
  fixes: readonly { description: string }[],
): never {
  throw new PipelineError("coord-fixed-invalid-aspect", path, cause, {
    code: "coord-fixed-invalid-aspect",
    severity: "error",
    path,
    problem: `${name} ${problem}`,
    cause,
    fixes,
    documentationUrl: "/guide/coordinate-systems#fixed-aspect",
  });
}

function assertPositiveAspect(aspect: number, name: string): void {
  if (Number.isFinite(aspect) && aspect > 0) return;
  invalidAspect(
    "computed a non-finite or non-positive target aspect.",
    "Fixed-aspect coordinates require a finite positive physical data-unit ratio after trained scale spans are applied.",
    name,
    "/coord/ratio",
    [
      { description: "Use a moderate finite ratio (for example between 0.1 and 10)." },
      { description: "Ensure positional domains are non-degenerate after training." },
    ],
  );
}

function assertPositiveAllocation(width: number, height: number, name: string): void {
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return;
  invalidAspect(
    "has no positive panel allocation to fit a data rectangle into.",
    "Fixed-aspect coordinates need a positive finite panel allocation after chart chrome is reserved.",
    name,
    "/coord",
    [
      { description: "Increase the plot width/height." },
      { description: "Reduce chrome that consumes the entire allocation." },
    ],
  );
}

function assertPositiveFit(width: number, height: number, name: string): void {
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return;
  invalidAspect(
    "cannot fit a positive finite data rectangle at the requested ratio.",
    "Fixed-aspect fitting produced a non-finite or non-positive data rectangle; the ratio or allocation is too extreme to size honestly.",
    name,
    "/coord/ratio",
    [{ description: "Use a less extreme ratio." }, { description: "Enlarge the plot allocation." }],
  );
}

export function applyFixedAspectLayout(input: {
  placements: readonly PanelPlacement[];
  panelScales: readonly { x: PositionScale; y: PositionScale }[];
  coord: FixedAspectCoordSpec;
  faceted: boolean;
  freeX: boolean;
  freeY: boolean;
  scalesConfig: Scales;
  warnings: PipelineWarning[];
}): FixedAspectLayoutResult {
  // Fixed-aspect family (fixed / sf / radial) share this pass; diagnostics must
  // name the coordinate the user actually wrote.
  const name =
    input.coord.type === "sf"
      ? "coord_sf"
      : input.coord.type === "radial"
        ? "coord_radial"
        : "coord_fixed";
  assertFixedFacetScales(input, name);
  if (input.placements.length === 0) return { placements: [], degraded: false };

  const firstScales = input.panelScales[0];
  if (firstScales === undefined) return { placements: [...input.placements], degraded: false };
  // Radial: ggplot2 aspect = diff(polar_bbox.y) / diff(polar_bbox.x) so partial
  // arcs stay circular under polarProject's independent axis rescales. Full
  // circle → 1. Fixed/sf: physical data-unit ratio × trained scale spans.
  const targetAspect =
    input.coord.type === "radial"
      ? (input.coord.aspect ?? 1)
      : (input.coord.ratio ?? 1) * (scaleSpaceSpan(firstScales.y) / scaleSpaceSpan(firstScales.x));
  assertPositiveAspect(targetAspect, name);

  // Fixed-scale facets promise equal data rectangles. Use the common largest
  // rectangle that fits every already-computed panel allocation.
  const availableWidth = input.faceted
    ? Math.min(...input.placements.map((placement) => placement.width))
    : input.placements[0]!.width;
  const availableHeight = input.faceted
    ? Math.min(...input.placements.map((placement) => placement.height))
    : input.placements[0]!.height;
  assertPositiveAllocation(availableWidth, availableHeight, name);
  const availableAspect = availableHeight / availableWidth;
  const fittedWidth =
    availableAspect > targetAspect ? availableWidth : availableHeight / targetAspect;
  const fittedHeight =
    availableAspect > targetAspect ? availableWidth * targetAspect : availableHeight;
  assertPositiveFit(fittedWidth, fittedHeight, name);
  const degraded =
    fittedWidth < MIN_READABLE_FIXED_PANEL_PX || fittedHeight < MIN_READABLE_FIXED_PANEL_PX;

  const placements = input.placements.map((placement) => {
    const allocation = {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    };
    const thinX =
      input.scalesConfig.x?.breaks === undefined && input.scalesConfig.x?.dateBreaks === undefined;
    const thinY =
      input.scalesConfig.y?.breaks === undefined && input.scalesConfig.y?.dateBreaks === undefined;
    const horizontal = thinX
      ? thinAutomaticAxis(
          placement.ticksH,
          placement.hGuidePlan,
          fittedWidth / allocation.width,
          degraded,
        )
      : undefined;
    const vertical = thinY
      ? thinAutomaticAxis(
          placement.ticksV,
          placement.vGuidePlan,
          fittedHeight / allocation.height,
          degraded,
        )
      : undefined;
    return {
      ...placement,
      x: allocation.x + (allocation.width - fittedWidth) / 2,
      y: allocation.y + (allocation.height - fittedHeight) / 2,
      width: fittedWidth,
      height: fittedHeight,
      allocation,
      ...(horizontal !== undefined && {
        ticksH: horizontal.ticks,
        hGuidePlan: horizontal.guidePlan,
      }),
      ...(vertical !== undefined && {
        ticksV: vertical.ticks,
        vGuidePlan: vertical.guidePlan,
      }),
    };
  });

  if (degraded) {
    const factor = MIN_READABLE_FIXED_PANEL_PX / Math.min(fittedWidth, fittedHeight);
    input.warnings.push({
      code: "coord-fixed-degraded",
      message:
        `The fixed-aspect data rectangle is ${fittedWidth.toFixed(1)}×${fittedHeight.toFixed(1)} px, below the ${MIN_READABLE_FIXED_PANEL_PX} px readable minimum. ` +
        `The ratio is preserved and minor furniture is removed; an allocation of about ${Math.ceil(availableWidth * factor)}×${Math.ceil(availableHeight * factor)} px would satisfy the minimum.`,
    });
  }
  return { placements, degraded };
}
