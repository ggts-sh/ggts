/**
 * Plot-engine pure derivations — accessors only, no $state, no effects,
 * no controller construction.
 *
 * Two factories, called synchronously while `createPlotEngine` runs during
 * component init so every `$derived` lands in the component graph at the
 * engine's original construction position:
 *
 * - `createPlotEngineDeriveds` — early host derivations (assembled spec,
 *   faceted intent, row-identity datum key, interaction scope, interaction
 *   config, capability enablement). All inputs exist before the interaction
 *   assembly; nothing here reads the runtime.
 * - `createPlotEngineHostDeriveds` — late host derivations that need the
 *   runtime + assembled controllers (legend entry lists, hover glyph
 *   extents, crosshair gap obstacles). Registered at the engine's original
 *   position, after the interaction assembly and chrome state.
 *
 * All inputs are lazy getters over live engine references — never snapshots.
 */
import type { PortableSpec } from "@ggts-sh/spec";

import {
  assemblePortableSpec,
  isFacetedPlotIntent,
  resolveInteractionScope,
  toLayerInput,
} from "./assembly/assemble.js";
import type { LayerRegistry } from "./geoms/registry.svelte.js";
import {
  normalizeInteractionConfig,
  type PlotInteractionScope,
  type ResolvedInteractionConfig,
} from "./interaction/interaction.js";
import {
  ssrSafeDerived,
  type CapabilityResolution,
} from "./interaction/capability-resolution.svelte.js";
import type { InspectionState } from "./inspection/inspection-state.svelte.js";
import type { LegendFilterState, FilterableLegendEntry } from "./legend/filter-state.svelte.js";
import type { InteractiveLegendEntry, LegendEntryIdentity } from "./legend/focus.js";
import type { LegendFocusState } from "./legend/focus-state.svelte.js";
import type { ResolvedLegendFilterCapability } from "./legend/resolve-legend-filter.js";
import type { ResolvedLegendFocusCapability } from "./legend/resolve-legend-focus.js";
import { filterFilterableLegendEntries } from "./legend/resolve-legend-filter.js";
import { filterInteractiveLegendEntries } from "./legend/resolve-legend-focus.js";
import { isHostPlotLayer } from "./layers/types.js";
import { readLegacyPlotKey, type EnginePlotProps } from "./plot-props.js";
import type { PlotRuntime } from "./runtime/runtime.svelte.js";
import type { DatumKey } from "./runtime/resolve-datum-key.js";
import {
  identityFromSelectInput,
  pickExplicitDatumKey,
  resolveDatumKey,
} from "./runtime/resolve-datum-key.js";
import {
  crosshairGlyphObstacles,
  glyphExtentsFromBatch,
  type CrosshairGapBox,
} from "./scene/geometry.js";

/** Structural host slice — the registry + live props proxy. */
export type PlotEngineDerivedsHost = {
  registry: LayerRegistry;
  props: EnginePlotProps;
};

/** Early host derivations, returned as live accessors (never snapshots). */
export type PlotEngineDeriveds = {
  assembled: () => PortableSpec | null;
  resolvedDatumKey: () => DatumKey;
  resolvedInteractionScope: () => PlotInteractionScope;
  interactionConfig: () => ResolvedInteractionConfig;
  interactive: () => boolean;
  surfaceInteractive: () => boolean;
  inspectEnabled: () => boolean;
  legendFocusEnabled: () => boolean;
  coordFlipped: () => boolean;
};

export function createPlotEngineDeriveds(
  host: PlotEngineDerivedsHost,
  capabilityResolution: CapabilityResolution,
): PlotEngineDeriveds {
  const inspectResolved = capabilityResolution.inspect;
  const legendFocusResolved = capabilityResolution.legendFocus;

  // Reading descriptors through toLayerInput goes through live getters, so
  // geom prop changes flow into this $derived without re-registration.
  // Explicit `spec` short-circuits before registry/children so ignored props
  // do not become reactive dependencies of the assembled plot.
  function assembleCurrentSpec(): PortableSpec | null {
    const spec = host.props.spec;
    if (spec !== undefined) return assemblePortableSpec({ spec, layers: [] });
    const data = host.props.data;
    const mapping = host.props.aes;
    const layers = host.props.layers;
    const a11y = host.props.a11y;
    return assemblePortableSpec({
      ...(data !== undefined && { data }),
      ...(mapping !== undefined && { aes: mapping }),
      // Mark layers only: a `layers={[…]}` prop suppresses registry marks, not
      // non-mark plot layers (theme/scale/coord/facet/labs/guides/legend).
      layers: layers ?? host.registry.markLayers.map(toLayerInput),
      // Grammar only — host-only kinds (legendFocus) never fold into PortableSpec.
      plotLayers: host.registry.layers.filter(
        (layer) => layer.kind !== "mark" && !isHostPlotLayer(layer),
      ),
      ...(a11y !== undefined && { a11y }),
    });
  }

  // SSR one-pass recompute rationale lives on ssrSafeDerived (#982).
  const assembled: () => PortableSpec | null = ssrSafeDerived(assembleCurrentSpec);

  // Facet intent: registry facet plot layer (<FacetWrap/> / <FacetGrid/> / <Facet/>),
  // OR assembled.facet (portable-spec embeds). Grammar props removed in 0.13.0 (#704).
  const facetedPlot = $derived(
    isFacetedPlotIntent({
      plotLayers: host.registry.layers,
      assembled: assembled(),
    }),
  );

  /**
   * Durable row identity: Inspect / Select / controller `identity` first,
   * then deprecated GGPlot `key`, else auto `id` column, else row index.
   * Always defined — ordinary charts need no custom identity.
   */
  function resolvedDatumKeyNow(): DatumKey {
    const data = host.props.data;
    const embedded = assembled()?.data;
    // The capability seam resolves this — do not re-read it off `input`, which
    // cannot tell a dropped prop identity from one that was never set.
    const inspectIdentity = inspectResolved().identity;
    const selectIdentity = identityFromSelectInput(host.props.select);
    const controllerIdentity = host.props.interaction?.identity;
    const legacyKey = readLegacyPlotKey(host.props);
    // exactOptionalPropertyTypes: omit keys rather than pass `undefined`.
    const explicit = pickExplicitDatumKey({
      ...(inspectIdentity !== undefined && { inspect: inspectIdentity }),
      ...(selectIdentity !== undefined && { select: selectIdentity }),
      ...(controllerIdentity !== undefined && { controller: controllerIdentity }),
      ...(legacyKey !== undefined && { legacy: legacyKey }),
    });
    return resolveDatumKey({
      ...(explicit !== undefined && { explicit }),
      data: data ?? embedded,
    });
  }
  const resolvedDatumKey: () => DatumKey = ssrSafeDerived(resolvedDatumKeyNow);

  const resolvedInteractionScope: PlotInteractionScope = $derived(
    (() => {
      const interaction = host.props.interaction;
      const interactionScope = host.props.interactionScope;
      const datumKey = resolvedDatumKey();
      return resolveInteractionScope({
        interaction,
        ...(interactionScope !== undefined && { interactionScope }),
        // Single-field default — do not call caps() (would subscribe all five).
        zoom: host.props.zoom ?? false,
        faceted: facetedPlot,
        datumKey,
        assembled: assembled(),
      });
    })(),
  );

  // interactionConfig: inspect from prop + <Inspect> children; legendFocus from
  // GuideLegend (host registry). SSR hatch matches assembled / inspectResolved.
  function interactionConfigCurrent(): ResolvedInteractionConfig {
    const tool = host.props.tool;
    // Four fields only — legendFilter is not part of normalizeInteractionConfig.
    // Reading it via caps() re-delivered config diagnostics on every filter toggle.
    return normalizeInteractionConfig(
      {
        inspect: inspectResolved().input,
        select: host.props.select ?? false,
        zoom: host.props.zoom ?? false,
        legendFocus: legendFocusResolved().configInput,
        ...(tool !== undefined && { tool }),
      },
      {
        faceted: facetedPlot,
        // Defaults always resolve a datum key (id column or row index).
        hasKey: true,
      },
    );
  }
  const interactionConfig: () => ResolvedInteractionConfig =
    ssrSafeDerived(interactionConfigCurrent);

  // ------------------------------------------------- interaction deriveds
  // Shared enablement predicates (avoid re-typing the same config gates).
  const interactive = $derived(interactionConfig().interactive);
  const surfaceInteractive = $derived(interactionConfig().availableTools.length > 0);
  const inspectEnabled = $derived(interactionConfig().inspect !== null);
  const legendFocusEnabled = $derived(interactionConfig().legendFocus !== null);
  const coordFlipped = $derived(assembled()?.coord?.type === "flip");

  return {
    assembled,
    resolvedDatumKey,
    resolvedInteractionScope: () => resolvedInteractionScope,
    interactionConfig,
    interactive: () => interactive,
    surfaceInteractive: () => surfaceInteractive,
    inspectEnabled: () => inspectEnabled,
    legendFocusEnabled: () => legendFocusEnabled,
    coordFlipped: () => coordFlipped,
  };
}

/** Lazy inputs for the late host derivations (runtime + controllers exist). */
export type PlotEngineHostDerivedsInput = {
  runtime: PlotRuntime;
  inspection: InspectionState;
  legendFocusState: LegendFocusState;
  legendFilterState: LegendFilterState;
  legendFocusEnabled: () => boolean;
  legendFocusChannels: () => ResolvedLegendFocusCapability["channels"];
  legendFilterChannels: () => ResolvedLegendFilterCapability["channels"];
};

/** Late host derivations, returned as live accessors (never snapshots). */
export type PlotEngineHostDeriveds = {
  interactiveLegendEntries: () => InteractiveLegendEntry[];
  effectiveLegendPressed: () => LegendEntryIdentity | null;
  legendClearActive: () => boolean;
  filterableLegendEntries: () => FilterableLegendEntry[];
  hoverGlyphExtents: () => {
    readonly width: number;
    readonly height: number;
    readonly textAnchor: "start" | "middle" | "end";
  } | null;
  crosshairGapObstacles: () => readonly CrosshairGapBox[];
};

export function createPlotEngineHostDeriveds(
  input: PlotEngineHostDerivedsInput,
): PlotEngineHostDeriveds {
  // Host-side deriveds kept outside the engine factory (construction-time free of
  // the model read). Channel filter: only aesthetics with GuideLegend focus
  // (merged legends match via aesthetics[], not primary scale alone).
  const interactiveLegendEntries = $derived(
    filterInteractiveLegendEntries(
      input.legendFocusState.computeInteractiveEntries(input.runtime.model),
      input.legendFocusChannels(),
    ),
  );

  const effectiveLegendPressed: LegendEntryIdentity | null = $derived(
    input.legendFocusState.computeLegendPressed(input.runtime.model),
  );

  // Signal that the legend clear control is visible (right of the scene).
  // No longer couples to a bottom-row layout margin.
  const legendClearActive = $derived(input.legendFocusEnabled() && effectiveLegendPressed !== null);

  // Host-side derived for catalog reconcile (closes over runtime.model).
  // Channel filter: only aesthetics with GuideLegend filter (merged legends
  // match via aesthetics[], not primary scale alone).
  const filterableLegendEntries = $derived(
    filterFilterableLegendEntries(
      input.legendFilterState.computeEntries(input.runtime.model),
      input.legendFilterChannels(),
    ),
  );

  function hoverGlyphExtents(): {
    readonly width: number;
    readonly height: number;
    readonly textAnchor: "start" | "middle" | "end";
  } | null {
    const seed = input.inspection.inspectionSeed;
    const model = input.runtime.model;
    if (seed === null || model === null || seed.kind !== "glyphs") return null;
    const batch = model.scene.batches[seed.batchIndex];
    if (batch === undefined || batch.kind !== "glyphs") return null;
    return glyphExtentsFromBatch(batch, seed.primitiveIndex);
  }

  // Scene walk (not candidate store): uninspectable label layers still paint
  // and still need guide gaps (#1065 / #1207). Depends on (scene, panelId)
  // only — not the focus anchor — so this is a real $derived, not a per-read
  // getter like hoverGlyphExtents.
  const EMPTY_CROSSHAIR_GAP_OBSTACLES: readonly CrosshairGapBox[] = Object.freeze([]);
  const crosshairGapObstacles = $derived.by((): readonly CrosshairGapBox[] => {
    const model = input.runtime.model;
    const panel = input.inspection.inspectionPanel;
    if (model === null || panel === null) return EMPTY_CROSSHAIR_GAP_OBSTACLES;
    return crosshairGlyphObstacles(model.scene.batches, model.scene.panels, panel.id);
  });

  return {
    interactiveLegendEntries: () => interactiveLegendEntries,
    effectiveLegendPressed: () => effectiveLegendPressed,
    legendClearActive: () => legendClearActive,
    filterableLegendEntries: () => filterableLegendEntries,
    hoverGlyphExtents,
    crosshairGapObstacles: () => crosshairGapObstacles,
  };
}
