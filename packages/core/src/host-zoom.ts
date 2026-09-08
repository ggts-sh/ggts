import type { RenderModel, SemanticViewportPanel } from "./index.js";
import type { CoordTransformAxisSpec, PortableSpec, Scales } from "@ggsvelte/spec";

import type { InteractionSource, PlotInteractionScope, ZoomEvent } from "./interaction-types.js";
import { frozenZoomDomains, type ContinuousZoomDomains, type PlotRect } from "./host-geometry.js";

export type ZoomMode = "x" | "y" | "xy";

/** One controller/shared zoom channel entry keyed by interaction scope. */
export type ScopedZoomChannel = {
  readonly scope: string;
  readonly domain: readonly [number, number];
};

/**
 * Project controller zoom channel lists into a continuous domain bag for this
 * plot's interaction scopes. Clones matching domain tuples. Omits missing
 * channels. Undefined scopes never match (same as PlotInteractionScope.x/y).
 * May return `{}` when neither scope matches (host freezes via
 * `frozenZoomDomains`, matching commitZoom after a successful setZoom).
 */
export function continuousZoomDomainsFromScopes(
  channels: {
    readonly x: readonly ScopedZoomChannel[];
    readonly y: readonly ScopedZoomChannel[];
  },
  scopeX: string | undefined,
  scopeY: string | undefined,
): ContinuousZoomDomains {
  const x =
    scopeX === undefined ? undefined : channels.x.find((domain) => domain.scope === scopeX)?.domain;
  const y =
    scopeY === undefined ? undefined : channels.y.find((domain) => domain.scope === scopeY)?.domain;
  return {
    ...(x !== undefined && { x: [x[0], x[1]] as [number, number] }),
    ...(y !== undefined && { y: [y[0], y[1]] as [number, number] }),
  };
}

const zoomScale = (
  config: Scales["x"] | undefined,
  domain: [number, number],
): NonNullable<Scales["x"]> => ({
  ...config,
  domain: [domain[0], domain[1]],
  nice: false,
  // Zoom writes the already-inverted display domain back as source limits.
  // Disable the new continuous default expansion or each re-render would add
  // another 5% and identical brushes would creep outward.
  expand: { mult: 0, add: 0 },
});

function withoutCoordLimits(
  axis: CoordTransformAxisSpec | undefined,
): CoordTransformAxisSpec | undefined {
  if (axis?.limits === undefined) return axis;
  const { limits: _limits, ...rest } = axis;
  return rest;
}

function coordForZoom(spec: PortableSpec, domains: ContinuousZoomDomains): PortableSpec["coord"] {
  const coord = spec.coord;
  if (coord?.type !== "transform") return coord;
  const x = domains.x === undefined ? coord.x : withoutCoordLimits(coord.x);
  const y = domains.y === undefined ? coord.y : withoutCoordLimits(coord.y);
  if (x === coord.x && y === coord.y) return coord;
  return {
    ...coord,
    ...(x === undefined ? {} : { x }),
    ...(y === undefined ? {} : { y }),
  };
}

/**
 * Restrict controller/shared zoom domains to channels this plot opted into.
 *
 * - `mode === null`: plot has no local zoom tool; still apply every controller
 *   domain present (linked display without publishing zoom tools).
 * - `mode === "x" | "y" | "xy"`: drop channels the plot did not opt into so an
 *   x-only plot cannot be rescaled by a shared y domain.
 *
 * Returns null when nothing remains to apply.
 */
export function filterZoomDomainsByMode(
  domains:
    | ContinuousZoomDomains
    | null
    | Readonly<{
        x?: readonly [number, number];
        y?: readonly [number, number];
      }>,
  mode: ZoomMode | null,
): ContinuousZoomDomains | null {
  if (domains === null) return null;
  const takeX = mode === null || mode !== "y";
  const takeY = mode === null || mode !== "x";
  const next: ContinuousZoomDomains = {
    ...(takeX &&
      domains.x !== undefined && {
        x: [domains.x[0], domains.x[1]] as [number, number],
      }),
    ...(takeY &&
      domains.y !== undefined && {
        y: [domains.y[0], domains.y[1]] as [number, number],
      }),
  };
  if (next.x === undefined && next.y === undefined) return null;
  return next;
}

/**
 * Restrict controller mutation scopes to zoom channels this plot opted into.
 *
 * Linked plots often share `{ keys, x, y }` while an individual chart uses
 * `zoom={{ mode: "x" }}`. Reading already filters domains by mode; resets and
 * writes must too, or Reset on an x-only plot would clear the shared y domain.
 *
 * - `mode === null | "xy"`: keep every defined channel on `scope`
 * - `mode === "x" | "y"`: drop the other positional channel
 */
export function filterScopeChannelsByZoomMode(
  scope: PlotInteractionScope,
  mode: ZoomMode | null,
): PlotInteractionScope {
  const takeX = mode === null || mode !== "y";
  const takeY = mode === null || mode !== "x";
  return Object.freeze({
    keys: scope.keys,
    ...(takeX && scope.x !== undefined && { x: scope.x }),
    ...(takeY && scope.y !== undefined && { y: scope.y }),
  });
}

function sameZoomChannel(
  a: readonly [number, number] | undefined,
  b: readonly [number, number] | undefined,
): boolean {
  return (
    a === b ||
    (a !== undefined && b !== undefined && Object.is(a[0], b[0]) && Object.is(a[1], b[1]))
  );
}

/** Value equality for continuous zoom domain bags (Object.is per endpoint). */
export function sameZoomDomains(
  left: ContinuousZoomDomains | null | undefined,
  right: ContinuousZoomDomains | null | undefined,
): boolean {
  if (left === right) return true;
  if (left === null || left === undefined || right === null || right === undefined) {
    return (left === null || left === undefined) && (right === null || right === undefined);
  }
  return sameZoomChannel(left.x, right.x) && sameZoomChannel(left.y, right.y);
}

/**
 * Prefer the previous domain bag when values match so `$derived` identity stays
 * stable across controller revisions that only change selection/emphasis.
 */
export function stableZoomDomains(
  previous: ContinuousZoomDomains | null,
  next: ContinuousZoomDomains | null,
): ContinuousZoomDomains | null {
  return sameZoomDomains(previous, next) ? previous : next;
}

/**
 * Merge continuous zoom domains into a portable spec's scales.
 * Returns `spec` by reference when domains are null/empty so callers can
 * keep `$derived` identity stable and avoid pipeline re-runs.
 */
export function applyZoomToSpec(
  spec: PortableSpec,
  domains: ContinuousZoomDomains | null,
): PortableSpec {
  if (domains === null || (domains.x === undefined && domains.y === undefined)) return spec;
  const coord = coordForZoom(spec, domains);
  return {
    ...spec,
    ...(coord !== spec.coord && coord !== undefined && { coord }),
    scales: {
      ...spec.scales,
      ...(domains.x !== undefined && {
        x: zoomScale(spec.scales?.x, domains.x),
      }),
      ...(domains.y !== undefined && {
        y: zoomScale(spec.scales?.y, domains.y),
      }),
    },
  };
}

/**
 * Apply a partial programmatic zoom update, dropping band/non-finite channels.
 * Returns null when no valid domain remains (callers emit no zoom event).
 */
export function sanitizePartialZoomDomains(
  partial: Partial<ContinuousZoomDomains>,
  scales: Pick<RenderModel["scales"], "x" | "y"> | undefined,
  current: ContinuousZoomDomains | null,
): ContinuousZoomDomains | null {
  const next: ContinuousZoomDomains = { ...current };
  for (const channel of ["x", "y"] as const) {
    const domain = partial[channel];
    if (domain === undefined) continue;
    const scale = scales?.[channel];
    if (
      scale?.type === "band" ||
      domain.length !== 2 ||
      !domain.every((value) => Number.isFinite(value))
    )
      continue;
    next[channel] = [domain[0], domain[1]];
  }
  if (next.x === undefined && next.y === undefined) return null;
  return next;
}

/**
 * Build a frozen zoom event payload.
 * Phase is "clear" when domains is null. Non-null domains are re-frozen via
 * `frozenZoomDomains` so nested tuples are cloned (not merely wrapper-frozen).
 */
export function buildZoomEvent(
  domains: ContinuousZoomDomains | null,
  source: InteractionSource,
): ZoomEvent {
  return Object.freeze({
    type: "zoom",
    phase: domains === null ? "clear" : "end",
    source,
    domains: domains === null ? null : frozenZoomDomains(domains),
  });
}

/**
 * Invert a brush rect into continuous zoom domains for the given mode.
 * Degeneracy uses *raw* (pre-flip) normalized pixel spans and rejects only
 * when both spans are non-positive — single-axis-thin brushes still produce
 * a domain on the remaining axis (existing M2 behavior).
 */
export function resolveBrushZoomDomains(
  rect: PlotRect,
  panel: SemanticViewportPanel,
  mode: ZoomMode,
  current: ContinuousZoomDomains | null,
): ContinuousZoomDomains | null {
  const span = panel.normalizedSpan(rect);
  // Guard uses raw screen fractions, not flip-remapped domains.
  if (span.x <= 0 && span.y <= 0) return null;
  const inverted = panel.invert(rect);
  const next: ContinuousZoomDomains = { ...current };
  if (
    mode !== "y" &&
    inverted.x !== undefined &&
    inverted.x.every((value) => typeof value === "number" && Number.isFinite(value))
  )
    next.x = [inverted.x[0] as number, inverted.x[1] as number];
  if (
    mode !== "x" &&
    inverted.y !== undefined &&
    inverted.y.every((value) => typeof value === "number" && Number.isFinite(value))
  )
    next.y = [inverted.y[0] as number, inverted.y[1] as number];
  if (next.x === undefined && next.y === undefined) return null;
  return next;
}

/**
 * Minimal model surface for brush-to-zoom commit (M2 single-panel only).
 * Accepts full `RenderModel` structurally.
 */
export type BrushZoomModel = {
  readonly viewport: RenderModel["viewport"];
};

/**
 * Commit-ready domains for brush-to-zoom from a live model.
 *
 * Owns the M2 single-panel gate (`panels.length === 1`), domain invert via
 * `resolveBrushZoomDomains`, and deep freeze for host `commitZoom`.
 * Returns null when model is missing, multi-panel/faceted, or domains cannot
 * be inverted. Mode is caller-supplied (`interactionConfig.zoom?.mode ?? "xy"`).
 */
export function resolveBrushZoomFromModel(input: {
  readonly model: BrushZoomModel | null;
  readonly rect: PlotRect;
  readonly mode: ZoomMode;
  readonly current: ContinuousZoomDomains | null;
}): ContinuousZoomDomains | null {
  if (input.model === null) return null;
  if (input.model.viewport.panels.length !== 1) return null;
  const panel = input.model.viewport.panels[0]!;
  const next = resolveBrushZoomDomains(input.rect, panel, input.mode, input.current);
  if (next === null) return null;
  return frozenZoomDomains(next);
}
