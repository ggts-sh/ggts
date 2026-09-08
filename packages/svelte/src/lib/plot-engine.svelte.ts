/**
 * Plot engine — controller wiring + host-level deriveds for <GGPlot>.
 *
 * Ownership: GGPlot owns root, captureSurface, a11yTableOpen, plotId (component
 * runes / bind:this / $props.id / markup-only state); context
 * (`provideRegistry`) and `$props()` stay in the component. The engine owns
 * tooltipHovered, all controller construction, and phased effect registration.
 * Pure host derivations (assembled spec, datum key, interaction config,
 * capability enablement, legend entry lists, hover/crosshair geometry) live in
 * plot-engine-deriveds.svelte.ts; diagnostic orchestration (config delivery +
 * once-only advisories) lives in diagnostics/plot-engine-diagnostics.svelte.ts
 * — both invoked from this factory so every `$derived`/`$effect` lands in the
 * component effect tree at the original construction position.
 *
 * Construction / effect-order contract: the five interaction controllers
 * (zoom / selection / interval / surface / inspection) are built by the
 * two-phase interaction assembly (interaction/interaction-states.svelte.ts) —
 * phase 1 builds zoom before the legend-filter / runtime chain; phase 2
 * (`complete`) builds the model-reading controllers after the runtime +
 * semantic-key service, because SSR evaluates $derived eagerly at
 * construction. The assembly owns sibling ports; shared deps flow through one
 * InteractionContext (interaction/interaction-context.svelte.ts). Leaf modules
 * register their own effects at construction; the engine only wires
 * host-held deriveds into catalog reconcile where data is not available at
 * leaf construction time.
 *
 * Residual late bindings (definite-assignment / late hooks only where the
 * cycle is real): `semanticCandidateProjection!` — interval
 * consumptionCandidates close over the projection, which reads the assembled
 * states; `legendFocusState.installHostDerivedEffects()` — host $derived
 * entry lists require this factory's compute* methods (#627). Surface tool
 * enablement (`availableTools`, point-select) is host-derived before the
 * assembly so chrome is not a surface construction-time dep (#1082).
 *
 * Call `createPlotEngine` once during component init so every `$effect`
 * registers in the component effect tree. No `$props`, `$props.id()`, or
 * context calls live here.
 */
import type { BatchInteractionMask } from "@ggts-sh/core";
import type { PortableSpec } from "@ggts-sh/spec";

import {
  canPublishPointSelection,
  resolveFilteredAvailableTools,
} from "./interaction/capability.js";
import { createCapabilityResolution } from "./interaction/capability-resolution.svelte.js";
import { resolveInteractionContext } from "./interaction/interaction-context.svelte.js";
import { createInteractionAssembly } from "./interaction/interaction-states.svelte.js";
import type { ResolvedInteractionConfig } from "./interaction/interaction.js";
import type { InspectionState } from "./inspection/inspection-state.svelte.js";
import type { IntervalState } from "./interval/interval-state.svelte.js";
import { createLegendEntryKeyIndex } from "./legend/entry-key-index.svelte.js";
import { createLegendFilterState, type LegendFilterState } from "./legend/filter-state.svelte.js";
import type { FilterableLegendEntry } from "./legend/filter-state.svelte.js";
import type { InteractiveLegendEntry, LegendEntryIdentity } from "./legend/focus.js";
import { createLegendFocusState, type LegendFocusState } from "./legend/focus-state.svelte.js";
import { createPlotChromeState, type PlotChromeState } from "./chrome/chrome-state.svelte.js";
import type { LayerRegistry } from "./geoms/registry.svelte.js";
import type { EnginePlotProps } from "./plot-props.js";
import { createPlotAnnouncer, type PlotAnnouncer } from "./runtime/announcer.svelte.js";
import { createPlotRuntime, type PlotRuntime } from "./runtime/runtime.svelte.js";
import { createSemanticCandidateProjection } from "./runtime/semantic-candidate-projection.svelte.js";
import {
  buildDataIdentityEpochInput,
  dataIdentityEpochToken,
} from "./runtime/semantic-data-identity.js";
import { createSourceIdentityTracker } from "./runtime/semantic-source-identity.js";
import { createSemanticKeyService } from "./runtime/semantic-keys.svelte.js";
import type { SelectionState } from "./selection/selection-state.svelte.js";
import {
  hoverChromeForKind,
  type PresentationAnchor,
  type PresentationChrome,
} from "./selection/selection.js";
import type { CrosshairGapBox } from "./scene/geometry.js";
import type { SurfaceState } from "./surface/surface-state.svelte.js";
import type { PlotZoomState } from "./zoom/zoom-state.svelte.js";
import { createPlotEngineDiagnostics } from "./diagnostics/plot-engine-diagnostics.svelte.js";
import {
  createPlotEngineDeriveds,
  createPlotEngineHostDeriveds,
} from "./plot-engine-deriveds.svelte.js";

// ---------------------------------------------------------------------------
// Host / return type
// ---------------------------------------------------------------------------

/**
 * Host binding for the plot engine (#1040). Props are a single lazy
 * `EnginePlotProps` surface (GGPlotProps with PublicKey fields widened) —
 * not a per-field thunk bag. Capability defaults live in `resolveCapabilities`.
 */
export type PlotEngineHost = {
  /** Value — created by `provideRegistry()` in GGPlot (context stays there). */
  registry: LayerRegistry;
  /** Plain string from `$props.id()` in GGPlot. */
  plotId: string;
  root: () => HTMLDivElement | null;
  captureSurface: () => HTMLDivElement | null;
  /** Live props proxy (or widenPlotProps view). Grammar is children-only (#704). */
  props: EnginePlotProps;
};

/**
 * Non-generic return surface. Controllers are stable object refs; deriveds
 * that markup reads are `get` accessors. Internal wiring (deliverDiagnostic,
 * inspectEnabled, facetedPlot, …) is not exposed. Defined once next to the
 * factory that builds it — not hand-mirrored from a second module (#982).
 */
export type PlotEngine = {
  // Controllers (stable object references)
  readonly zoomState: PlotZoomState;
  readonly legendFilterState: LegendFilterState;
  readonly runtime: PlotRuntime;
  readonly inspectionState: InspectionState;
  readonly surfaceState: SurfaceState;
  readonly selectionState: SelectionState;
  readonly legendFocusState: LegendFocusState;
  readonly intervalState: IntervalState;
  readonly chromeState: PlotChromeState;
  readonly announcer: PlotAnnouncer;

  // Engine getter accessors — deriveds markup consumes
  readonly assembled: PortableSpec | null;
  readonly interactionConfig: ResolvedInteractionConfig;
  readonly interactive: boolean;
  readonly surfaceInteractive: boolean;
  readonly coordFlipped: boolean;
  readonly legendFocusEnabled: boolean;
  readonly selectedAnchors: PresentationAnchor[];
  readonly emphasizedAnchors: PresentationAnchor[];
  readonly hoverChrome: PresentationChrome;
  /** Measured glyph box when hoverChrome is `"box"`. */
  readonly hoverBoxWidth: number | undefined;
  readonly hoverBoxHeight: number | undefined;
  readonly hoverBoxAnchor: "start" | "middle" | "end" | undefined;
  /**
   * Sibling GeomText AABBs in the focus panel for crosshair hard-gaps (#1207).
   * Derived from scene batches (not candidate store) so uninspectable labels
   * still clear the guide.
   */
  readonly crosshairGapObstacles: readonly CrosshairGapBox[];
  readonly interactionMasks: readonly (BatchInteractionMask | null)[];
  readonly interactiveLegendEntries: InteractiveLegendEntry[];
  readonly effectiveLegendPressed: LegendEntryIdentity | null;
  readonly legendClearActive: boolean;
  readonly filterableLegendEntries: FilterableLegendEntry[];

  // get/set tooltipHovered (owned here; markup handlers write via engine)
  tooltipHovered: boolean;
};

// ---------------------------------------------------------------------------
// Factory

export function createPlotEngine(host: PlotEngineHost): PlotEngine {
  // Capability resolution seam (inspect / legendFocus / legendFilter / caps):
  // three independent SSR-safe deriveds behind one factory — see
  // capability-resolution.svelte.ts for the capabilityVersion-vs-version
  // isolation contract and the SSR one-pass recompute rationale.
  const capabilityResolution = createCapabilityResolution(host);

  // Early host derivations (assembled spec, datum key, interaction config,
  // capability enablement) — pure accessors, construction order preserved.
  const {
    assembled,
    interactionConfig,
    resolvedDatumKey,
    resolvedInteractionScope,
    interactive,
    surfaceInteractive,
    inspectEnabled,
    legendFocusEnabled,
    coordFlipped,
  } = createPlotEngineDeriveds(host, capabilityResolution);

  // Diagnostic orchestration: config delivery + once-only advisory effects,
  // registered here (during init) at the engine's original positions.
  const { deliverDiagnostic, registerChromeDiagnostics, registerInspectDiagnostics } =
    createPlotEngineDiagnostics({
      props: host.props,
      registry: host.registry,
      interactionConfig,
      capabilityResolution,
    });

  // PublicKey → PropertyKey widening lives in widenPlotProps (plot-props.ts);
  // controllers read host.props handlers directly (already widened). The sink
  // is handler-only — announcer is declared later, never read at construction.
  const announceSink = (message: string): void => {
    announcer.announce(message);
  };

  // Leaf effects register at construction (#627); the assembly owns order.

  let tooltipHovered = $state(false);

  // ------------------------------------------------- interaction context
  // One shared bag replaces the ~60 hand-wired dep fields the five controller
  // factories used to declare individually. Model / semantic-key getters are
  // handler-only deferred closures — never read at construction.
  const interactionContext = resolveInteractionContext({
    model: () => runtime.model,
    root: host.root,
    captureSurface: host.captureSurface,
    interaction: () => host.props.interaction,
    resolvedInteractionScope,
    selectConfig: () => interactionConfig().select,
    inspectConfig: () => interactionConfig().inspect,
    tooltipHovered: () => tooltipHovered,
    announce: announceSink,
    oninteraction: () => host.props.oninteraction,
    oninspect: () => host.props.oninspect,
    onselect: () => host.props.onselect,
    onzoom: () => host.props.onzoom,
    ontoolchange: () => host.props.ontoolchange,
    keyAt: (index) => semanticKeys.keyAt(index),
    semanticKey: (row, index) => semanticKeys.semanticKey(row, index),
    candidateSemanticKeys: (candidate) => semanticKeys.candidateSemanticKeys(candidate),
  });

  // ------------------------------------------------- interaction assembly (phase 1)
  // Zoom is the only controller the legend-filter / runtime chain reads. SSR
  // evaluates $derived eagerly at construction, so the model-reading
  // controllers wait for the runtime — phase 2 runs after semanticKeys below.
  const interactionAssembly = createInteractionAssembly(interactionContext, {
    zoom: {
      zoomConfig: () => interactionConfig().zoom,
      assembled,
    },
  });

  // Source identity/order epoch: O(R) row-ref order over data/spec *props*
  // (not assembled shells) — tracker owned for the component lifetime; pure
  // fingerprint assembly lives in buildDataIdentityEpochInput (#852).
  const identityTracker = createSourceIdentityTracker();
  const dataIdentityEpoch = $derived.by(() =>
    dataIdentityEpochToken(
      buildDataIdentityEpochInput({
        data: host.props.data,
        spec: host.props.spec,
        layers: host.props.layers,
        // Declaration children: markLayers only (not registry.layers) — #609.
        registryMarkLayers: host.registry.markLayers,
        sourceIdentity: (value: unknown) => identityTracker.sourceIdentity(value),
      }),
    ),
  );

  // Live-region announcer (owned early so legend-reset effects can call it).
  const announcer = createPlotAnnouncer();

  // ------------------------------------------------- legend filter
  // Construction-time deriveds read legendFilter/effectiveSpec only — model /
  // catalogEntries close over later bindings (effect-only, never construction).
  const legendFilterState = createLegendFilterState({
    effectiveSpec: () => interactionAssembly.zoom.effectiveSpec,
    // GuideLegend children (or deprecated plot prop) — not plot prop alone.
    legendFilterProp: () => capabilityResolution.legendFilter().configInput,
    onlegendfilter: () => host.props.onlegendfilter,
    oninteraction: () => host.props.oninteraction,
    announce: announceSink,
    model: () => runtime.model,
    catalogEntries: () => hostDeriveds.filterableLegendEntries(),
  });

  // ------------------------------------------------- plot runtime (after the
  // interaction assembly + legend-filter, so construction-time deps are set).
  const runtime = createPlotRuntime({
    widthProp: () => host.props.width,
    heightProp: () => host.props.height,
    assembled,
    effectiveSpec: () => interactionAssembly.zoom.effectiveSpec,
    effectiveZoomDomains: () => interactionAssembly.zoom.effectiveZoomDomains,
    effectiveLegendFilters: () => legendFilterState.filters,
    root: host.root,
    resetZoom: () => {
      interactionAssembly.zoom.resetForScales();
    },
    onrender: () => host.props.onrender,
  });
  // Semantic resolution as soon as the runtime model exists — early
  // construction keeps interval projection safe with shared controllers (#165).
  const semanticKeys = createSemanticKeyService({
    model: () => runtime.model,
    assembled,
    datumKey: () => resolvedDatumKey(),
    data: () => host.props.data,
    spec: () => host.props.spec,
    sourceIdentity: (value: unknown) => identityTracker.sourceIdentity(value),
    deliverDiagnostic,
  });

  // Legend entry → key index (lifted from semantic-keys in S16) — after
  // semanticKeys, before inspection, so the construction DAG is unchanged.
  const legendEntryKeys = createLegendEntryKeyIndex({
    model: () => runtime.model,
    keyAt: (i) => semanticKeys.keyAt(i),
  });

  // source rows/spec -> pipeline/scene + CandidateStore -> semantic resolver
  // -> tooltip/crosshair/tools/callbacks.

  // Surface tool enablement is host-derived (#1082) — same formulas as chrome.
  const surfaceAvailableTools = $derived(
    resolveFilteredAvailableTools(
      interactionConfig().availableTools,
      interactionConfig().zoom,
      runtime.model?.scales ?? null,
    ),
  );
  const surfacePointSelectEnabled = $derived(canPublishPointSelection(interactionConfig().select));

  // ------------------------------------------------- interaction assembly (phase 2)
  // selection → interval → surface → inspection; sibling ports wired inside
  // the assembly. The projection is the one remaining late binding (#165).
  let semanticCandidateProjection!: ReturnType<typeof createSemanticCandidateProjection>;
  const states = interactionAssembly.complete({
    interval: {
      consumptionCandidates: () => semanticCandidateProjection.intervalConsumptionCandidates,
    },
    surface: {
      toolProp: () => host.props.tool,
      initialTool: () => interactionConfig().initialTool,
      availableTools: () => surfaceAvailableTools,
      pointSelectEnabled: () => surfacePointSelectEnabled,
      surfaceInteractive,
    },
    inspection: {
      inspectEnabled,
      dataIdentityEpoch: () => dataIdentityEpoch,
      plotId: () => host.plotId,
      clearTooltipHovered: () => {
        tooltipHovered = false;
      },
      clearAnnouncement: () => {
        announcer.clear();
      },
    },
  });

  // ------------------------------------------------- legend focus
  // Host-held entry lists install via installHostDerivedEffects — irreducible
  // late data, not a sibling-controller cycle (#627).
  const legendFocusState = createLegendFocusState({
    interaction: () => host.props.interaction,
    resolvedInteractionScope,
    legendFocusEnabled,
    legendFocusPreviewEnabled: () => interactionConfig().legendFocus?.preview === true,
    root: host.root,
    entryKeys: () => legendEntryKeys,
    entries: () => hostDeriveds.interactiveLegendEntries(),
    pressed: () => hostDeriveds.effectiveLegendPressed(),
    onlegendfocus: () => host.props.onlegendfocus,
    oninteraction: () => host.props.oninteraction,
    announce: announceSink,
  });
  semanticCandidateProjection = createSemanticCandidateProjection({
    model: () => runtime.model,
    candidateSemanticKeys: (candidate) => semanticKeys.candidateSemanticKeys(candidate),
    selectedKeys: () => states.selection.effectiveSelectedKeys,
    intervalKeys: () => states.interval.effectiveIntervalKeys,
    intervals: () => states.interval.effectiveIntervals,
    emphasisKeys: () => legendFocusState.effectiveEmphasisKeys,
    muteSiblingsOnInspect: () => interactionConfig().inspect?.muteSiblings === true,
    // Inspection owns the projection (#1080); wiring no longer re-assembles it.
    inspectionFocus: () => states.inspection.presentationFocus,
  });
  // ------------------------------------------------- plot chrome
  // All host bindings earlier-declared; pure construction-time deriveds. Tools
  // stay chrome-owned for UI (#1082), same helpers as surfaceAvailableTools.
  const chromeState = createPlotChromeState({
    model: () => runtime.model,
    zoomConfig: () => interactionConfig().zoom,
    selectConfig: () => interactionConfig().select,
    configuredAvailableTools: () => interactionConfig().availableTools,
    interactionDiagnostics: () => interactionConfig().diagnostics,
    interactive,
    effectiveZoomDomains: () => states.zoom.effectiveZoomDomains,
    effectiveIntervals: () => states.interval.effectiveIntervals,
    effectiveSelectedKeys: () => states.selection.effectiveSelectedKeys,
    effectiveEmphasisKeys: () => legendFocusState.effectiveEmphasisKeys,
    legendFocusEnabled,
    hasCanvas: () => runtime.hasCanvas,
    width: () => host.props.width,
    resolvedWidth: () => runtime.resolvedWidth,
    resolvedHeight: () => runtime.resolvedHeight,
  });

  // Chrome area-scale / legend diagnostics re-deliver per recompute.
  registerChromeDiagnostics(chromeState);

  // Runtime-gated inspect advisories — original position, after the runtime.
  registerInspectDiagnostics({
    assembled,
    model: () => runtime.model,
  });

  // Late host derivations — original position, after the controllers they read.
  const hostDeriveds = createPlotEngineHostDeriveds({
    runtime,
    inspection: states.inspection,
    legendFocusState,
    legendFilterState,
    legendFocusEnabled,
    legendFocusChannels: () => capabilityResolution.legendFocus().channels,
    legendFilterChannels: () => capabilityResolution.legendFilter().channels,
  });

  // After host entry deriveds exist (irreducible late data for legend focus).
  legendFocusState.installHostDerivedEffects();

  return {
    zoomState: states.zoom,
    legendFilterState,
    runtime,
    inspectionState: states.inspection,
    surfaceState: states.surface,
    selectionState: states.selection,
    legendFocusState,
    intervalState: states.interval,
    chromeState,
    announcer,

    get assembled() {
      return assembled();
    },
    get interactionConfig() {
      return interactionConfig();
    },
    get interactive() {
      return interactive();
    },
    get surfaceInteractive() {
      return surfaceInteractive();
    },
    get coordFlipped() {
      return coordFlipped();
    },
    get legendFocusEnabled() {
      return legendFocusEnabled();
    },
    get selectedAnchors() {
      return semanticCandidateProjection.selectedAnchors;
    },
    get emphasizedAnchors() {
      return semanticCandidateProjection.emphasizedAnchors;
    },
    get hoverChrome() {
      // Hover chrome is separate from selection/emphasis anchor rings: open
      // path strokes still gap the crosshair; rects and closed path fills
      // (areas) mute (#1270). Null inspection → default ring.
      const focus = states.inspection.presentationFocus;
      if (focus === null) return "ring";
      const seed = states.inspection.inspectionSeed;
      const batch = seed === null ? undefined : runtime.model?.scene.batches[seed.batchIndex];
      const closedPath = batch?.kind === "paths" && batch.closed === true;
      return hoverChromeForKind(focus.kind, closedPath);
    },
    get hoverBoxWidth() {
      return hostDeriveds.hoverGlyphExtents()?.width;
    },
    get hoverBoxHeight() {
      return hostDeriveds.hoverGlyphExtents()?.height;
    },
    get hoverBoxAnchor() {
      return hostDeriveds.hoverGlyphExtents()?.textAnchor;
    },
    get crosshairGapObstacles() {
      return hostDeriveds.crosshairGapObstacles();
    },
    get interactionMasks() {
      return semanticCandidateProjection.interactionMasks;
    },
    get interactiveLegendEntries() {
      return hostDeriveds.interactiveLegendEntries();
    },
    get effectiveLegendPressed() {
      return hostDeriveds.effectiveLegendPressed();
    },
    get legendClearActive() {
      return hostDeriveds.legendClearActive();
    },
    get filterableLegendEntries() {
      return hostDeriveds.filterableLegendEntries();
    },
    get tooltipHovered() {
      return tooltipHovered;
    },
    set tooltipHovered(value: boolean) {
      tooltipHovered = value;
    },
  };
}
