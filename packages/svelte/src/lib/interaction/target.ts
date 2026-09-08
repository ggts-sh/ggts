/**
 * Resolved target ownership (#1080).
 *
 * One module owns panel-scoped nearest (#787), the per-intent distance policy,
 * and the candidate match that hover / tap / point-select all need. Callers
 * stop each carrying their own `panelAtOrOnly().nearest()` and maxDistance.
 *
 * Does not own hit geometry (core) or the inspect pin lifecycle. Semantic
 * keys stay on the host (`candidateSemanticKeys`). Reducer inspect payloads
 * are built from CandidateMatch / CandidateFacts in inspection/frame.ts.
 */

import type {
  CandidateInspectMode,
  CandidateMatch,
  RenderModel,
  ResolvedCandidateInspectMode,
} from "@ggts-sh/core";

import { panelBoundsFrom, type PanelBounds } from "../scene/geometry.js";
import type { PlotPoint } from "../surface/area-brush.js";

/**
 * Why we are resolving. Selects the distance policy so callers stop each
 * carrying their own maxDistance.
 */
export type TargetIntent = "hover" | "tap" | "point-select";

/**
 * Inspect fields that feed hover/tap distance policy.
 * Host: resolved `interactionConfig.inspect` (mode + maxDistance), or the
 * pure-table snapshot already taken for the gesture.
 */
export type TargetInspectPolicy = {
  readonly mode: CandidateInspectMode;
  readonly maxDistance: number;
} | null;

/**
 * Nearest-candidate radius (plot px) for point-tool click.
 * Deliberate constant — distinct from inspect.maxDistance (default also 24,
 * but hover/tap read config; point-select does not).
 */
export const POINT_SELECT_NEAREST_MAX_DISTANCE_PX = 24;

/** Resolved nearest-search params for one intent. */
export type TargetSearch = {
  readonly mode: CandidateInspectMode;
  readonly maxDistance: number;
};

/**
 * Intent → nearest search params.
 *
 * | intent       | mode              | maxDistance                          |
 * |--------------|-------------------|--------------------------------------|
 * | hover        | inspect.mode      | inspect.maxDistance                  |
 * | tap          | inspect.mode      | inspect.maxDistance                  |
 * | point-select | always `"xy"`     | `POINT_SELECT_NEAREST_MAX_DISTANCE_PX` |
 *
 * Returns null when hover/tap has no inspect snapshot (nothing to resolve).
 */
export function targetSearch(
  intent: TargetIntent,
  inspect: TargetInspectPolicy,
): TargetSearch | null {
  if (intent === "point-select") {
    return {
      mode: "xy",
      maxDistance: POINT_SELECT_NEAREST_MAX_DISTANCE_PX,
    };
  }
  if (inspect === null) return null;
  return {
    mode: inspect.mode,
    maxDistance: inspect.maxDistance,
  };
}

/**
 * The one representation of "the thing under the pointer" at resolve time.
 * `match` is the full CandidateMatch so setInspection / semantic-keys keep
 * working without a second store lookup. Panel bounds come from the same
 * viewport panel that scoped the nearest call.
 */
export type ResolvedTarget = {
  readonly epoch: number;
  readonly candidateId: number;
  readonly panelId: string;
  readonly point: PlotPoint;
  readonly mode: ResolvedCandidateInspectMode;
  readonly distance: number;
  readonly match: CandidateMatch;
  readonly panel: PanelBounds & { readonly id: string };
};

export type ResolveTargetInput = {
  readonly model: RenderModel;
  readonly point: PlotPoint;
  readonly intent: TargetIntent;
  /**
   * Inspect policy for hover/tap. Ignored for point-select (uses the table).
   * Pass the pure-table snapshot when the gesture already captured mode /
   * maxDistance so callers do not re-read live config.
   */
  readonly inspect: TargetInspectPolicy;
  /**
   * Optional explicit search override. When set, skips `targetSearch` and
   * uses these params — for callers that already snapshotted mode/maxDistance
   * onto a pure action payload.
   */
  readonly search?: TargetSearch;
};

/**
 * Panel-scoped nearest for one intent. Sole call site of
 * `panelAtOrOnly().nearest()` for hover / tap / point-select.
 */
export function resolveTarget(input: ResolveTargetInput): ResolvedTarget | null {
  const search = input.search ?? targetSearch(input.intent, input.inspect);
  if (search === null) return null;
  const panel = input.model.viewport.panelAtOrOnly(input.point);
  if (panel === null) return null;
  const match = panel.nearest(input.point, search);
  if (match === null) return null;
  return {
    epoch: match.epoch,
    candidateId: match.id,
    panelId: match.panelId,
    point: { x: match.x, y: match.y },
    mode: match.mode,
    distance: match.distance,
    match,
    panel: { id: panel.id, ...panelBoundsFrom(panel.bounds) },
  };
}
