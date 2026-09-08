/**
 * Plot-engine diagnostic orchestration — config delivery plus the once-only
 * advisory effects (wiring, multi-Inspect, dropped identity, deprecations,
 * composition, inspect-geom, high-cardinality) and the chrome re-delivery
 * effects.
 *
 * Extraction contract (S5): inputs are lazy getters / stable service refs over
 * the engine's live deriveds — never snapshots. `deliverDiagnostic` is one
 * stable closure per engine (shared dedup Set included), so late
 * registrations (chrome re-delivery, semantic-keys) deliver through the same
 * sink.
 *
 * Call `createPlotEngineDiagnostics` synchronously while `createPlotEngine`
 * runs during component init: every `$effect` here must land in the component
 * effect tree. Runtime-gated advisories (inspect-geom, high-cardinality) and
 * the chrome re-delivery effects register later via the register* functions —
 * still during init, at the engine's original registration positions.
 */
import type { PortableSpec } from "@ggts-sh/spec";

import {
  collectCompositionDiagnostics,
  compositionAdvisoryDedupKey,
  type CompositionDiagnostic,
} from "./composition.js";
import { deprecatedPropDiagnostic, type PlotDiagnostic } from "./deprecation.js";
import type { LayerRegistry } from "../geoms/registry.svelte.js";
import {
  discreteColorFillDomainSizes,
  inspectAxisOnBarColDiagnostics,
  inspectAxisOnDistributionDiagnostics,
  inspectHighCardinalityDiagnostics,
  layerGeomsFromSpecLayers,
  type InteractionDiagnostic,
  type ResolvedInteractionConfig,
} from "../interaction/interaction.js";
import type { CapabilityResolution } from "../interaction/capability-resolution.svelte.js";
import {
  droppedInspectIdentityDiagnostics,
  duplicateInspectCapabilityDiagnostics,
} from "../interaction/resolve-inspect-capability.js";
import { collectWiringDiagnostics } from "../interaction/wiring-advisories.js";
import {
  readLegacyPlotKey,
  readLegacyPlotLegendFilter,
  readLegacyPlotLegendFocus,
  type EnginePlotProps,
} from "../plot-props.js";
import type { PlotChromeState } from "../chrome/chrome-state.svelte.js";
import type { PlotRuntime } from "../runtime/runtime.svelte.js";

/**
 * Inputs: live props proxy + registry (reactive reads) and the engine's
 * capability-resolution / interaction-config accessors.
 */
export type PlotEngineDiagnosticsInput = {
  readonly props: EnginePlotProps;
  readonly registry: LayerRegistry;
  readonly interactionConfig: () => ResolvedInteractionConfig;
  readonly capabilityResolution: CapabilityResolution;
};

export function createPlotEngineDiagnostics(input: PlotEngineDiagnosticsInput): {
  deliverDiagnostic: (diagnostic: PlotDiagnostic) => void;
  registerChromeDiagnostics: (chrome: PlotChromeState) => void;
  registerInspectDiagnostics: (opts: {
    assembled: () => PortableSpec | null;
    model: () => PlotRuntime["model"];
  }) => void;
} {
  const capabilityResolution = input.capabilityResolution;

  function deliverDiagnostic(diagnostic: PlotDiagnostic): void {
    const ondiagnostic = input.props.ondiagnostic;
    ondiagnostic?.(diagnostic);
    const nodeEnvironment = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process
      ?.env?.NODE_ENV;
    if (nodeEnvironment !== "production" && ondiagnostic === undefined)
      console.warn(`[ggts:${diagnostic.code}] ${diagnostic.message}`);
  }

  $effect(() => {
    for (const diagnostic of input.interactionConfig().diagnostics) deliverDiagnostic(diagnostic);
  });

  // Wiring advisories (ADR 0013 audit): prop combinations that silently do
  // nothing. Unlike config diagnostics (re-delivered per recompute), these
  // fire once per prop per plot instance — a later capability toggle must
  // not re-advise. Pure collect lives in wiring-advisories.ts; snapshot is
  // taken inside this derived so late-bound handlers still recompute.
  // capabilities.inspect is resolved (prop + <Inspect> children), not raw prop.
  const wiringDiagnostics = $derived.by((): InteractionDiagnostic[] => {
    const capabilities = capabilityResolution.caps();
    // legendFocus "requested" is the GuideLegend/child (or deprecated prop)
    // opt-in — not the post-key-check resolved config — so keyless focus does
    // not double-advise HANDLER_WITHOUT_CAPABILITY + LEGEND_REQUIRES_KEY.
    return collectWiringDiagnostics({
      interactionScope: input.props.interactionScope,
      interaction: input.props.interaction,
      handlers: {
        oninspect: input.props.oninspect,
        onselect: input.props.onselect,
        onzoom: input.props.onzoom,
        onlegendfocus: input.props.onlegendfocus,
        onlegendfilter: input.props.onlegendfilter,
      },
      capabilities: {
        inspect: capabilities.inspect,
        select: capabilities.select,
        zoom: capabilities.zoom,
        legendFocus: capabilityResolution.legendFocus().requested,
        // legendFilter "requested" is GuideLegend/child (or deprecated prop)
        // opt-in — not resolveCapabilities(plot prop alone).
        legendFilter: capabilityResolution.legendFilter().requested,
      },
    });
  });
  // Shared once-per-dedup-key Set for wiring + multi-Inspect + deprecations +
  // composition + inspect-geom. Each deliverAdvisoriesOnce call registers ONE
  // $effect; call order below is the registration (and first-flush delivery)
  // order. Re-delivering effects (config diagnostics above, chrome
  // re-delivery via registerChromeDiagnostics) stay outside this helper by
  // design.
  const deliveredAdvisories = new Set<string>();
  function deliverAdvisoriesOnce<T extends PlotDiagnostic>(
    get: () => readonly T[],
    dedupKeyOf: (diagnostic: T) => string = (diagnostic) =>
      `${diagnostic.code}:${(diagnostic as { prop?: string }).prop}`,
  ): void {
    $effect(() => {
      for (const diagnostic of get()) {
        const dedupKey = dedupKeyOf(diagnostic);
        if (deliveredAdvisories.has(dedupKey)) continue;
        deliveredAdvisories.add(dedupKey);
        deliverDiagnostic(diagnostic);
      }
    });
  }

  deliverAdvisoriesOnce(() => wiringDiagnostics);

  // Multiple <Inspect> children: last wins; advisory once per mount.
  const multiInspectDiagnostics = $derived.by((): InteractionDiagnostic[] =>
    duplicateInspectCapabilityDiagnostics(capabilityResolution.inspect().multiChild),
  );
  deliverAdvisoriesOnce(() => multiInspectDiagnostics);

  // <Inspect> replaced an inspect prop that named `identity`: rows silently
  // fell back to id column / row index before #1305's follow-up.
  const droppedIdentityDiagnostics = $derived.by((): InteractionDiagnostic[] =>
    droppedInspectIdentityDiagnostics(capabilityResolution.inspect().droppedPropIdentity),
  );
  deliverAdvisoriesOnce(() => droppedIdentityDiagnostics);

  // Deprecated plot-level key → Inspect / Select / controller identity.
  const deprecatedKeyDiagnostics = $derived.by((): PlotDiagnostic[] => {
    const plotProp = readLegacyPlotKey(input.props);
    if (plotProp === undefined) return [];
    return [
      deprecatedPropDiagnostic({
        prop: "key",
        since: "0.21.0",
        removeIn: "0.22.0",
        suggestions: [
          'Use <Inspect identity="year" /> (or inspect={{ identity: "year" }})',
          'Use select={{ type: "point", identity: "year" }} when selection owns the key',
          'Use createPlotInteraction({ identity: "year" }) for linked controllers',
        ],
        anchor: "row-identity-on-interaction",
      }),
    ];
  });
  deliverAdvisoriesOnce(() => deprecatedKeyDiagnostics);

  // Deprecated plot-level legendFocus → GuideLegend.focus (one minor window).
  const deprecatedLegendFocusDiagnostics = $derived.by((): PlotDiagnostic[] => {
    const plotProp = readLegacyPlotLegendFocus(input.props);
    if (plotProp === undefined || plotProp === false) return [];
    return [
      deprecatedPropDiagnostic({
        prop: "legendFocus",
        since: "0.19.0",
        removeIn: "0.20.0",
        suggestions: [
          'Use <GuideLegend channel="color" focus /> (or the aesthetic that owns the discrete legend)',
          "focus={{ preview: false }} on GuideLegend replaces legendFocus={{ preview: false }}",
        ],
        anchor: "legend-focus-on-guidelegend",
      }),
    ];
  });
  deliverAdvisoriesOnce(() => deprecatedLegendFocusDiagnostics);

  // Deprecated plot-level legendFilter → GuideLegend.filter (one minor window).
  const deprecatedLegendFilterDiagnostics = $derived.by((): PlotDiagnostic[] => {
    const plotProp = readLegacyPlotLegendFilter(input.props);
    if (plotProp === undefined || plotProp === false) return [];
    return [
      deprecatedPropDiagnostic({
        prop: "legendFilter",
        since: "0.19.0",
        removeIn: "0.20.0",
        suggestions: [
          'Use <GuideLegend channel="color" filter /> (or the aesthetic that owns the discrete legend)',
          'filter={{ mode: "include", multiple: false }} on GuideLegend replaces legendFilter={{ … }}',
        ],
        anchor: "legend-filter-on-guidelegend",
      }),
    ];
  });
  deliverAdvisoriesOnce(() => deprecatedLegendFilterDiagnostics);

  // Composition advisories (#659 slices 3+5+6): pure collect over
  // registry.layers. Last child still wins (shallow merge / last write);
  // delivery is once-per-dedup-key via compositionAdvisoryDedupKey.
  const compositionDiagnostics = $derived.by((): CompositionDiagnostic[] =>
    collectCompositionDiagnostics(input.registry.layers),
  );
  deliverAdvisoriesOnce(() => compositionDiagnostics, compositionAdvisoryDedupKey);

  // Chrome area-scale / legend diagnostics re-deliver per recompute (outside
  // the once-only helper by design). Register after chromeState exists.
  function registerChromeDiagnostics(chrome: PlotChromeState): void {
    $effect(() => {
      for (const diagnostic of chrome.areaScaleDiagnostics) deliverDiagnostic(diagnostic);
    });
    $effect(() => {
      for (const diagnostic of chrome.legendDiagnostics) deliverDiagnostic(diagnostic);
    });
  }

  // Runtime-gated inspect advisories — register after the plot runtime exists
  // (trained scales gate both). Still during init, at the engine's original
  // registration position.
  function registerInspectDiagnostics(opts: {
    assembled: () => PortableSpec | null;
    model: () => PlotRuntime["model"];
  }): void {
    // Inspect axis guides that fight bar/col geometry (or bisect on-bar labels)
    // and freescrolling guides through distribution/interval band geoms (#1528).
    // After runtime so trained scales gate interval-geom advisories (continuous
    // shared-x line+errorbar with mode="x" stays silent). Mode x/xy still fire
    // under coord_flip (#1409): the band-axis guide remains.
    const inspectGeomDiagnostics = $derived.by((): InteractionDiagnostic[] => {
      const mode = input.interactionConfig().inspect?.mode;
      if (mode === undefined) return [];
      const geoms = layerGeomsFromSpecLayers(opts.assembled()?.layers);
      const scales = opts.model()?.scales;
      const discreteBandAxis =
        scales !== undefined && (scales.x.type === "band" || scales.y.type === "band");
      return [
        ...inspectAxisOnBarColDiagnostics(mode, geoms),
        ...inspectAxisOnDistributionDiagnostics(mode, geoms, { discreteBandAxis }),
      ];
    });
    deliverAdvisoriesOnce(() => inspectGeomDiagnostics);

    // High-cardinality discrete color/fill + inspect: default tooltip policy
    // advisory (#1274). Needs trained scales (runtime.model); once-per-channel.
    const inspectHighCardinality = $derived.by((): InteractionDiagnostic[] => {
      // Resolved inspect is null when off (never undefined) — see normalizeInteractionConfig.
      if (input.interactionConfig().inspect === null) return [];
      const model = opts.model();
      if (model === null) return [];
      return inspectHighCardinalityDiagnostics({
        inspectEnabled: true,
        domainSizes: discreteColorFillDomainSizes(model.scales),
      });
    });
    deliverAdvisoriesOnce(() => inspectHighCardinality);
  }

  return { deliverDiagnostic, registerChromeDiagnostics, registerInspectDiagnostics };
}
