/**
 * Plot chrome controller tests (S8 extraction).
 * Pure construction-time deriveds — no $state / handlers / effects.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import type { RenderModel } from "@ggts-sh/core";
import { aes, gg, type PortableSpec } from "@ggts-sh/spec";

import type {
  InteractionDiagnostic,
  InteractionTool,
  PlotInteractionInterval,
  ResolvedInteractionConfig,
} from "../../src/lib/interaction/interaction.js";
import { INTERACTION_DIAGNOSTIC_CATALOG } from "../../src/lib/interaction/interaction.js";
import type { ContinuousZoomDomains } from "../../src/lib/scene/geometry.js";
import { createPlotChromeState } from "../../src/lib/chrome/chrome-state.svelte.js";
import { withEffectRoot, withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { modelFor } from "../helpers/model.js";
import { reactiveBox } from "../helpers/reactive-box.svelte.js";

const continuousRows = [
  { id: "a", x: 1, y: 1 },
  { id: "b", x: 10, y: 20 },
];

type ZoomConfig = ResolvedInteractionConfig["zoom"];
type SelectConfig = ResolvedInteractionConfig["select"];

function continuousSpec(
  data: readonly { id: string; x: number; y: number }[] = continuousRows,
): PortableSpec {
  return gg([...data], aes({ x: "x", y: "y" }))
    .geomPoint()
    .spec();
}

function bandXSpec(): PortableSpec {
  return gg(
    [
      { id: "a", x: "north", y: 1 },
      { id: "b", x: "south", y: 20 },
    ],
    aes({ x: "x", y: "y" }),
  )
    .geomPoint()
    .spec();
}

const xyZoom = (): ZoomConfig => Object.freeze({ mode: "xy" as const, trigger: "brush" as const });

const pointSelect = (): SelectConfig =>
  Object.freeze({
    type: "point" as const,
    multiple: false,
    persistent: true,
    preset: "independent" as const,
  });

const intervalSelect = (): SelectConfig =>
  Object.freeze({
    type: "interval" as const,
    mode: "xy" as const,
    multiple: false,
    persistent: true,
    preset: "independent" as const,
  });

type ChromeHarness = {
  state: ReturnType<typeof createPlotChromeState>;
  destroy: () => void;
};

function mountChrome(
  options: {
    model?: () => RenderModel | null;
    zoomConfig?: () => ZoomConfig;
    selectConfig?: () => SelectConfig;
    configuredAvailableTools?: () => readonly InteractionTool[];
    interactionDiagnostics?: () => readonly InteractionDiagnostic[];
    interactive?: () => boolean;
    effectiveZoomDomains?: () => ContinuousZoomDomains | null;
    effectiveIntervals?: () => readonly PlotInteractionInterval<PropertyKey>[];
    effectiveSelectedKeys?: () => readonly PropertyKey[];
    effectiveEmphasisKeys?: () => readonly PropertyKey[];
    legendFocusEnabled?: () => boolean;
    hasCanvas?: () => boolean;
    width?: () => number | "container" | undefined;
    resolvedWidth?: () => number;
    resolvedHeight?: () => number;
  } = {},
): ChromeHarness {
  const defaultModel = modelFor(continuousSpec());
  const { value: state, destroy } = withFlushedEffectRoot(() =>
    createPlotChromeState({
      model: options.model ?? (() => defaultModel),
      zoomConfig: options.zoomConfig ?? (() => null),
      selectConfig: options.selectConfig ?? (() => null),
      configuredAvailableTools:
        options.configuredAvailableTools ?? (() => ["inspect", "zoom-area"] as const),
      interactionDiagnostics: options.interactionDiagnostics ?? (() => []),
      interactive: options.interactive ?? (() => true),
      effectiveZoomDomains: options.effectiveZoomDomains ?? (() => null),
      effectiveIntervals: options.effectiveIntervals ?? (() => []),
      effectiveSelectedKeys: options.effectiveSelectedKeys ?? (() => []),
      effectiveEmphasisKeys: options.effectiveEmphasisKeys ?? (() => []),
      legendFocusEnabled: options.legendFocusEnabled ?? (() => false),
      hasCanvas: options.hasCanvas ?? (() => false),
      width: options.width ?? (() => 400),
      resolvedWidth: options.resolvedWidth ?? (() => 400),
      resolvedHeight: options.resolvedHeight ?? (() => 300),
    }),
  );
  return { state, destroy };
}

describe("createPlotChromeState value smoke", () => {
  it("filters zoom tools under band-scale zoom and exposes status/labels", () => {
    const bandModel = modelFor(bandXSpec());
    const continuousModel = modelFor(continuousSpec());

    const band = mountChrome({
      model: () => bandModel,
      zoomConfig: xyZoom,
      configuredAvailableTools: () => ["inspect", "zoom-area", "point"],
      selectConfig: pointSelect,
      interactive: () => true,
    });

    // Band x under xy zoom → zoomHasSupportedChannel still true if y continuous.
    // Both-band would drop zoom; for band-x only, y is continuous so zoom stays.
    // Use a fully band model path: scale type band on the blocking channel.
    // zoomSupportsChannel(xy) is true when EITHER channel is non-band.
    // For a pure band-x continuous-y model, zoom tools remain.
    // zoomHasSupportedChannel is private — its effect is observable through
    // availableTools filtering.
    expect(band.state.availableTools).toContain("zoom-area");
    band.destroy();

    // Force unsupported: zoom mode "x" on band-x scale
    const bandXOnly = mountChrome({
      model: () => bandModel,
      zoomConfig: () => Object.freeze({ mode: "x" as const, trigger: "brush" as const }),
      configuredAvailableTools: () => ["inspect", "zoom-area", "point"],
      selectConfig: pointSelect,
    });
    expect(bandXOnly.state.availableTools).toEqual(["inspect", "point"]);
    expect(bandXOnly.state.availableTools).not.toContain("zoom-area");
    bandXOnly.destroy();

    // Continuous smoke: tools, axes, labels, styles
    const facetDiag = {
      ...INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_INTERVAL_FACET_UNSUPPORTED,
    };
    const selectedBox = reactiveBox<readonly PropertyKey[]>([]);
    const { state, destroy } = mountChrome({
      model: () => continuousModel,
      zoomConfig: xyZoom,
      selectConfig: pointSelect,
      configuredAvailableTools: () => ["inspect", "point", "zoom-area"],
      interactionDiagnostics: () => [facetDiag],
      interactive: () => true,
      effectiveSelectedKeys: () => selectedBox.value,
    });

    expect(state.canPublishPointSelection).toBe(true);
    expect(state.hasPointSelection).toBe(false);
    expect(state.hasIntervalSelection).toBe(false);
    expect(state.emptyPlot).toBe(false);
    expect(state.preciseZoomAxes).toEqual(["x", "y"]);
    expect(state.preciseIntervalAxes).toEqual([]);
    expect(state.capabilityStatus).toBe(`Area interaction unavailable: ${facetDiag.message}`);
    // themeStyle/hasZoomDomains are private — themeStyle feeds rootStyle.
    expect(state.rootStyle).toContain("--gg-theme-");
    expect(state.markLabel(0)).toMatch(/x|y|data point/i);
    expect(state.datumLabel(null)).toBe("No active datum");
    expect(state.datumLabel({ x: 1, y: 2 })).toMatch(/x|y|Active datum/i);

    // Reactive flip: selection → hasPointSelection → showToolRail
    // With multi tools, showToolRail is already true via availableToolCount > 1.
    // Gate recovery: single tool + point select + selection flips rail on.
    destroy();

    const singleTool = mountChrome({
      model: () => continuousModel,
      selectConfig: pointSelect,
      configuredAvailableTools: () => ["point"],
      interactive: () => true,
      effectiveSelectedKeys: () => selectedBox.value,
    });
    expect(singleTool.state.showToolRail).toBe(false);
    selectedBox.set(["a"]);
    flushSync();
    expect(singleTool.state.hasPointSelection).toBe(true);
    expect(singleTool.state.showToolRail).toBe(true);
    singleTool.destroy();
  });

  it("precise interval axes follow select mode; area diagnostics for band zoom", () => {
    const bandModel = modelFor(bandXSpec());
    const { state, destroy } = mountChrome({
      model: () => bandModel,
      zoomConfig: xyZoom,
      selectConfig: intervalSelect,
      configuredAvailableTools: () => ["inspect", "select-area", "zoom-area"],
    });

    expect(state.preciseIntervalAxes).toEqual(["x", "y"]);
    // Band x yields area scale diagnostic for zoom
    expect(state.areaScaleDiagnostics.length).toBeGreaterThan(0);
    expect(state.areaScaleDiagnostics[0]?.code).toBe("INTERACTION_INTERVAL_SCALE_UNSUPPORTED");
    destroy();
  });
});

describe("createPlotChromeState construction shape", () => {
  it("exposes accessor values for a known config without deferred deps", () => {
    const model = modelFor(continuousSpec());
    const { value: state, destroy } = withEffectRoot(() =>
      createPlotChromeState({
        model: () => model,
        zoomConfig: () => null,
        selectConfig: pointSelect,
        configuredAvailableTools: () => ["inspect", "point"],
        interactionDiagnostics: () => [],
        interactive: () => true,
        effectiveZoomDomains: () => null,
        effectiveIntervals: () => [],
        effectiveSelectedKeys: () => [],
        effectiveEmphasisKeys: () => [],
        legendFocusEnabled: () => false,
        hasCanvas: () => false,
        width: () => 360,
        resolvedWidth: () => 360,
        resolvedHeight: () => 260,
      }),
    );

    // Cheap smoke of construction-time accessors (all inputs earlier-declared).
    expect(state.availableTools).toEqual(["inspect", "point"]);
    expect(state.canPublishPointSelection).toBe(true);
    expect(state.hasPointSelection).toBe(false);
    expect(state.showToolRail).toBe(true); // 2 tools
    expect(state.emptyPlot).toBe(false);
    expect(state.capabilityStatus).toBeNull();
    expect(state.preciseIntervalAxes).toEqual([]);
    expect(state.preciseZoomAxes).toEqual([]);
    flushSync();
    expect(state.availableTools).toEqual(["inspect", "point"]);
    destroy();
  });
});
