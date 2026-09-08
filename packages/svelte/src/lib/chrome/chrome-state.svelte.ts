/**
 * Plot chrome controller extracted from GGPlot for S8.
 *
 * Owns the fifteen construction-time chrome deriveds (tool rail, capability
 * status, precise axes, theme/root style, etc.) plus `markLabel` as a
 * derived-FUNCTION accessor and `datumLabel` as a plain method.
 *
 * Pure deriveds only — no $state, no handlers, no effects. Every construction
 * input is earlier-declared at the host factory site (original line 581).
 */
import type { CellValue, RenderModel } from "@ggts-sh/core";

import {
  INTERACTION_DIAGNOSTIC_CATALOG,
  type InteractionDiagnostic,
  type InteractionTool,
  type PlotInteractionInterval,
  type ResolvedInteractionConfig,
} from "../interaction/interaction.js";
import {
  bandChannelsForZoom,
  canPublishPointSelection as canPublishPointSelectionFromSelect,
  capabilityStatusText,
  isEmptyPlotScene,
  legendFocusDiscreteOnlyDiagnostics,
  resolveFilteredAvailableTools,
  shouldShowToolRail,
  zoomScaleDiagnosticsFromChannels,
  zoomSupportsChannel,
} from "../interaction/capability.js";
import type { ContinuousZoomDomains } from "../scene/geometry.js";
import {
  datumLabel as datumLabelFor,
  labelFromFields,
  markLabel as markLabelFor,
  uniqueMappedFields,
} from "../assembly/labels.js";
import { isContainerWidthProp, plotRootInlineStyle } from "../assembly/layout.js";
import { themeTokensToCss } from "./theme-css.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PlotChromeStateDeps = {
  model: () => RenderModel | null;
  /** Narrow getter over `interactionConfig.zoom`. */
  zoomConfig: () => ResolvedInteractionConfig["zoom"];
  /** Narrow getter over `interactionConfig.select`. */
  selectConfig: () => ResolvedInteractionConfig["select"];
  /** Configured (unfiltered) available tools from normalizeInteractionConfig. */
  configuredAvailableTools: () => readonly InteractionTool[];
  /** Interaction config diagnostics (facet-unsupported, etc.). */
  interactionDiagnostics: () => readonly InteractionDiagnostic[];
  interactive: () => boolean;
  effectiveZoomDomains: () => ContinuousZoomDomains | null;
  effectiveIntervals: () => readonly PlotInteractionInterval<PropertyKey>[];
  /** Host alias over the selection controller. */
  effectiveSelectedKeys: () => readonly PropertyKey[];
  effectiveEmphasisKeys: () => readonly PropertyKey[];
  legendFocusEnabled: () => boolean;
  hasCanvas: () => boolean;
  /** Width prop (number | "container" | undefined). */
  width: () => number | "container" | undefined;
  resolvedWidth: () => number;
  resolvedHeight: () => number;
};

export type PlotChromeState = {
  readonly availableTools: readonly InteractionTool[];
  readonly canPublishPointSelection: boolean;
  readonly hasPointSelection: boolean;
  readonly hasIntervalSelection: boolean;
  readonly showToolRail: boolean;
  readonly emptyPlot: boolean;
  readonly preciseIntervalAxes: readonly ("x" | "y")[];
  readonly preciseZoomAxes: readonly ("x" | "y")[];
  readonly areaScaleDiagnostics: readonly InteractionDiagnostic[];
  readonly legendDiagnostics: readonly InteractionDiagnostic[];
  readonly capabilityStatus: string | null;
  readonly rootStyle: string | undefined;
  /**
   * Derived function accessor — callback identity changes only when `model`
   * changes (codex P2-8 / r2 P2-4).
   */
  readonly markLabel: (row: number) => string;
  /** Method reading the current model at call time. */
  datumLabel(values: Record<string, CellValue> | null): string;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the plot chrome controller. All deriveds are construction-time —
 * every dep is earlier-declared at the host factory position. No $state,
 * handlers, or effects.
 */
export function createPlotChromeState(deps: PlotChromeStateDeps): PlotChromeState {
  const zoomHasSupportedChannel = $derived.by(() => {
    const zoom = deps.zoomConfig();
    const model = deps.model();
    if (zoom === null || model === null) return true;
    return zoomSupportsChannel(zoom.mode, model.scales);
  });

  const availableTools = $derived(
    resolveFilteredAvailableTools(
      deps.configuredAvailableTools(),
      deps.zoomConfig(),
      deps.model()?.scales ?? null,
    ),
  );

  const canPublishPointSelection = $derived(
    canPublishPointSelectionFromSelect(deps.selectConfig()),
  );

  // Shared by tool-rail visibility and ToolRail recovery props (avoid dual calc).
  const hasPointSelection = $derived(
    canPublishPointSelection && deps.effectiveSelectedKeys().length > 0,
  );

  // R3: interval presence covers dormant panel intervals, not just the
  // committed one (effectiveIntervals), so recovery controls stay reachable.
  const hasIntervalSelection = $derived(deps.effectiveIntervals().length > 0);

  const hasZoomDomains = $derived(deps.effectiveZoomDomains() !== null);

  const showToolRail = $derived(
    shouldShowToolRail({
      interactive: deps.interactive(),
      availableToolCount: availableTools.length,
      canPublishPointSelection,
      selectedKeyCount: deps.effectiveSelectedKeys().length,
      hasIntervalSelection,
      hasZoomDomains,
    }),
  );

  const emptyPlot = $derived.by(() => {
    const model = deps.model();
    return model !== null && isEmptyPlotScene(model.scene.batches);
  });

  const preciseIntervalAxes = $derived.by((): readonly ("x" | "y")[] => {
    const selectOptions = deps.selectConfig();
    if (selectOptions === null || selectOptions.type !== "interval") return [];
    return (["x", "y"] as const).filter(
      (axis) => selectOptions.mode === "xy" || selectOptions.mode === axis,
    );
  });

  const preciseZoomAxes = $derived.by((): readonly ("x" | "y")[] => {
    const zoom = deps.zoomConfig();
    const model = deps.model();
    if (zoom === null || model === null) return [];
    return (["x", "y"] as const).filter(
      (axis) => (zoom.mode === "xy" || zoom.mode === axis) && model.scales[axis].type !== "band",
    );
  });

  const areaScaleDiagnostics = $derived.by(() => {
    const model = deps.model();
    const zoom = deps.zoomConfig();
    if (model === null || zoom === null) return [] as InteractionDiagnostic[];
    return zoomScaleDiagnosticsFromChannels(
      bandChannelsForZoom(zoom.mode, model.scales),
      INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_INTERVAL_SCALE_UNSUPPORTED,
    );
  });

  const legendDiagnostics = $derived.by(() => {
    const model = deps.model();
    if (model === null) return [] as InteractionDiagnostic[];
    return legendFocusDiscreteOnlyDiagnostics(deps.legendFocusEnabled(), model.scene.legends);
  });

  const capabilityStatus = $derived.by(() => {
    const unavailable = deps
      .interactionDiagnostics()
      .find((diagnostic) => diagnostic.code === "INTERACTION_INTERVAL_FACET_UNSUPPORTED");
    const model = deps.model();
    return capabilityStatusText({
      ...(unavailable !== undefined && {
        facetUnavailableMessage: unavailable.message,
      }),
      areaDiagnostics: areaScaleDiagnostics,
      zoomSupported: zoomHasSupportedChannel,
      interactive: deps.interactive(),
      emptyPlot,
      candidateCount: model === null ? null : model.candidates.size,
    });
  });

  const themeStyle = $derived.by(() => {
    const model = deps.model();
    return model === null ? "" : themeTokensToCss(model.scene.theme);
  });

  const rootStyle = $derived(
    plotRootInlineStyle({
      needsSizedBox:
        deps.hasCanvas() ||
        deps.interactive() ||
        deps.effectiveEmphasisKeys().length > 0 ||
        deps.effectiveSelectedKeys().length > 0,
      containerWidth: isContainerWidthProp(deps.width()),
      sceneWidth: deps.model()?.scene.width ?? deps.resolvedWidth(),
      sceneHeight: deps.model()?.scene.height ?? deps.resolvedHeight(),
      themeStyle,
    }),
  );

  // Stable SceneView callback identity when model is unchanged. Unique field
  // list is built once per model so per-mark labels do not re-flatten
  // layerFields (#1329).
  const markLabel = $derived.by(() => {
    const model = deps.model();
    if (model === null) return (row: number) => markLabelFor(null, row);
    const fields = uniqueMappedFields(model);
    return (row: number) => {
      const values = model.row(row);
      if (values === null) return `data point ${row + 1}`;
      return labelFromFields(fields, values, `data point ${row + 1}`);
    };
  });

  function datumLabel(values: Record<string, CellValue> | null): string {
    return datumLabelFor(deps.model(), values);
  }

  return {
    get availableTools() {
      return availableTools;
    },
    get canPublishPointSelection() {
      return canPublishPointSelection;
    },
    get hasPointSelection() {
      return hasPointSelection;
    },
    get hasIntervalSelection() {
      return hasIntervalSelection;
    },
    get showToolRail() {
      return showToolRail;
    },
    get emptyPlot() {
      return emptyPlot;
    },
    get preciseIntervalAxes() {
      return preciseIntervalAxes;
    },
    get preciseZoomAxes() {
      return preciseZoomAxes;
    },
    get areaScaleDiagnostics() {
      return areaScaleDiagnostics;
    },
    get legendDiagnostics() {
      return legendDiagnostics;
    },
    get capabilityStatus() {
      return capabilityStatus;
    },
    get rootStyle() {
      return rootStyle;
    },
    get markLabel() {
      return markLabel;
    },
    datumLabel,
  };
}
