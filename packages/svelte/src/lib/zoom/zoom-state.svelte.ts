/**
 * Zoom controller extracted from GGPlot for S4.
 *
 * Owns chart-local zoom domains, effective-domain / effective-spec deriveds,
 * and zoom commit/reset/brush/set handlers. Construction-time deriveds must
 * NOT read model/announce (later-declared / handler-only;
 * construction-order DAG). Those are handler-only deferred getters.
 */
import type { PortableSpec } from "@ggts-sh/spec";

import type { InteractionContext } from "../interaction/interaction-context.svelte.js";
import type { InteractionSource, ResolvedInteractionConfig } from "../interaction/interaction.js";
import { createScopedStore } from "../interaction/scoped-store.svelte.js";
import { frozenZoomDomains, type ContinuousZoomDomains } from "../scene/geometry.js";
import { zoomAnnouncement } from "../assembly/labels.js";
import {
  applyZoomToSpec,
  buildZoomEvent,
  continuousZoomDomainsFromScopes,
  filterScopeChannelsByZoomMode,
  filterZoomDomainsByMode,
  resolveBrushZoomFromModel,
  sanitizePartialZoomDomains,
  stableZoomDomains,
} from "./zoom.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Zoom-specific options beyond the shared InteractionContext. zoomConfig is
 * the narrow `interactionConfig.zoom` slice; assembled feeds effectiveSpec.
 */
export type PlotZoomStateOptions = {
  /** Narrow getter over `interactionConfig.zoom` (mode + null gate). */
  readonly zoomConfig: () => ResolvedInteractionConfig["zoom"];
  readonly assembled: () => PortableSpec | null;
};

export type PlotZoomState = {
  readonly effectiveZoomDomains: ContinuousZoomDomains | null;
  readonly effectiveSpec: PortableSpec | null;
  commitZoom(domains: ContinuousZoomDomains | null, source: InteractionSource): void;
  resetZoom(source?: InteractionSource): void;
  setZoomDomains(domains: Partial<ContinuousZoomDomains>): void;
  onDblClick(): void;
  applyBrushZoom(
    rect: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    },
    source: InteractionSource,
  ): void;
  /** Silent scale-reset path (runtime dep; no event / announcement). */
  resetForScales(): void;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the zoom controller. Construction registers only the
 * construction-time `effectiveZoomDomains` / `effectiveSpec` deriveds (over
 * earlier host bindings). Handlers may read later-declared bindings via
 * deferred getters (`model`, `announce`).
 */
export function createPlotZoomState(
  context: InteractionContext,
  options: PlotZoomStateOptions,
): PlotZoomState {
  // Memoize prior bag so selection/emphasis revisions do not retrain zoom.
  let previousEffectiveZoomDomains: ContinuousZoomDomains | null = null;

  const zoomDomains = createScopedStore<ContinuousZoomDomains | null>({
    initial: null,
    empty: null,
    controller: context.interaction,
    scope: context.resolvedInteractionScope,
    read: (controller, scope) =>
      // Gate shared domains by this plot's resolved zoom mode (null when
      // disabled / faceted-unsupported) so x-only plots ignore y domains.
      filterZoomDomainsByMode(controller.zoom(scope), options.zoomConfig()?.mode ?? null),
    write: (controller, next, scope, source) => {
      // Match filterZoomDomainsByMode: x-only plots must not mutate shared y.
      const mutationScope = filterScopeChannelsByZoomMode(
        scope,
        options.zoomConfig()?.mode ?? null,
      );
      if (next === null) {
        const transition = controller.resetZoom({ scope: mutationScope, source });
        return transition === null ? null : { value: null };
      }
      const transition = controller.setZoom(next, { scope: mutationScope, source });
      if (transition === null) return null;
      return {
        value: frozenZoomDomains(
          continuousZoomDomainsFromScopes(
            transition.snapshot.zoom,
            mutationScope.x,
            mutationScope.y,
          ),
        ),
      };
    },
    clearShared: (controller, scope, source) =>
      controller.resetZoom({
        scope: filterScopeChannelsByZoomMode(scope, options.zoomConfig()?.mode ?? null),
        source,
      }) !== null,
  });

  const effectiveZoomDomains: ContinuousZoomDomains | null = $derived.by(() => {
    const next = stableZoomDomains(previousEffectiveZoomDomains, zoomDomains.value);
    previousEffectiveZoomDomains = next;
    return next;
  });

  function resolveEffectiveSpec(): PortableSpec | null {
    const assembled = options.assembled();
    if (assembled === null || effectiveZoomDomains === null) return assembled;
    return applyZoomToSpec(assembled, effectiveZoomDomains);
  }
  const effectiveSpec: PortableSpec | null = $derived.by(resolveEffectiveSpec);

  function commitZoom(domains: ContinuousZoomDomains | null, source: InteractionSource): void {
    const committed = zoomDomains.set(domains, source);
    if (committed === null) return;
    const event = buildZoomEvent(committed.value, source);
    context.announce(zoomAnnouncement(committed.value));
    context.onzoom()?.(event);
    context.oninteraction()?.(event);
  }

  function resetZoom(source: InteractionSource = "programmatic"): void {
    if (effectiveZoomDomains === null) return;
    commitZoom(null, source);
  }

  function setZoomDomains(domains: Partial<ContinuousZoomDomains>): void {
    const next = sanitizePartialZoomDomains(domains, context.model()?.scales, effectiveZoomDomains);
    if (next === null) return;
    commitZoom(frozenZoomDomains(next), "programmatic");
  }

  function onDblClick(): void {
    if (options.zoomConfig() === null) return;
    resetZoom("pointer");
  }

  /**
   * Brush-to-zoom = an intentional respec: invert the brushed plot-px rect
   * through the trained scales into explicit continuous domains. Band axes
   * and faceted plots are skipped (documented M2 limitation) inside
   * `resolveBrushZoomFromModel`.
   */
  function applyBrushZoom(
    rect: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    },
    source: InteractionSource,
  ): void {
    // Pure owns null/multi-panel gate, invert, and freeze for commit.
    const next = resolveBrushZoomFromModel({
      model: context.model(),
      rect,
      mode: options.zoomConfig()?.mode ?? "xy",
      current: effectiveZoomDomains,
    });
    if (next === null) return;
    commitZoom(next, source);
  }

  function resetForScales(): void {
    // Silent path: no event / announcement. Prefer clear() so local and shared
    // storage stay interchangeable without an interaction fork at the call site.
    zoomDomains.clear("programmatic");
  }

  return {
    get effectiveZoomDomains() {
      return effectiveZoomDomains;
    },
    get effectiveSpec() {
      // Svelte 5.33 SSR does not invalidate construction-time deriveds after
      // declaration-only children register in the same server pass.
      return typeof window === "undefined" ? resolveEffectiveSpec() : effectiveSpec;
    },
    commitZoom,
    resetZoom,
    setZoomDomains,
    onDblClick,
    applyBrushZoom,
    resetForScales,
  };
}
