import { encodeKey, type CandidateFacts } from "@ggts-sh/core";
import {
  semanticAxisFromBounds,
  recomputePanelIntervalProjection,
  type PreciseBoundsApplyEvent,
  type PlotInteractionInterval,
  type IntervalSelection,
} from "@ggts-sh/core/interaction";
import { boundsEditorInputForScale, type BoundsEditorInput } from "@ggts-sh/core/interaction";
import { useMemo, useCallback, useSyncExternalStore } from "react";
import type { ForwardedRef } from "react";
import { isFacetedPlotIntent, resolveInteractionScope } from "@ggts-sh/compose";
import { sceneLabel } from "@ggts-sh/core";
import type { RenderModel, PlotRect } from "@ggts-sh/core";
import {
  normalizeInteractionConfig,
  applyZoomToSpec,
  filterZoomDomainsByMode,
} from "@ggts-sh/core/interaction";
import type { ReadonlyIntervalDomains, ZoomDomains } from "@ggts-sh/core/interaction";
import { assembleFromProps } from "./plot-assemble.js";
import { hostDatumKey } from "./plot-host-identity.js";
import type { usePlotInteractions } from "./plot-interactions.js";
import type { GGPlotProps, GGPlotHandle } from "./plot-props.js";
import type { InspectOptions } from "./interaction.js";
import type { LayerRegistry } from "./registry.js";

const selection = (axis: ReadonlyIntervalDomains["x"]) =>
  axis === undefined
    ? undefined
    : axis.kind === "band"
      ? { kind: "band" as const, keys: axis.values }
      : { kind: "continuous" as const, domain: axis.domain };

export function intervalPixels(
  model: RenderModel,
  panelId: string,
  domains: ReadonlyIntervalDomains,
): PlotRect | null {
  const panel = model.viewport.panel(panelId);
  if (panel === null) return null;
  const x = selection(domains.x);
  const y = selection(domains.y);
  return panel.project({ ...(x !== undefined && { x }), ...(y !== undefined && { y }) });
}

export function plotLabel(props: GGPlotProps, model: RenderModel | null): string {
  return props.ariaLabel ?? (model === null ? "Chart" : sceneLabel(model.scene));
}

export function inspectionKeys(
  config: ReturnType<typeof usePlotInputs>["config"],
  interactions: ReturnType<typeof usePlotInteractions>,
): readonly PropertyKey[] {
  return config.inspect?.muteSiblings === true
    ? (interactions.inspection?.focus.sourceKeys ?? [])
    : [];
}

export type SurfaceProps = Omit<GGPlotProps, "key" | "children"> & {
  registry: LayerRegistry;
  plotRef: ForwardedRef<GGPlotHandle>;
};
export function usePlotInputs(
  props: SurfaceProps,
  revision: number,
  containerWidth: number,
  localZoom: ZoomDomains | null,
) {
  const { registry } = props;
  const width =
    typeof props.width === "number" ? props.width : containerWidth > 0 ? containerWidth : 832;
  const height = props.height ?? 400;
  const assembled = useMemo(
    () => assembleFromProps(props, registry),
    [props.spec, props.data, props.aes, props.layers, props.a11y, registry, revision],
  );
  const inspectChildren = useMemo(() => registry.capabilities("inspect"), [registry, revision]);
  const inspect =
    inspectChildren.length > 0 ? (inspectChildren.at(-1) as InspectOptions) : props.inspect;
  const config = useMemo(
    () =>
      normalizeInteractionConfig(
        {
          ...(inspect !== undefined && { inspect }),
          ...(props.select !== undefined && { select: props.select }),
          ...(props.zoom !== undefined && { zoom: props.zoom }),
          ...(props.tool !== undefined && { tool: props.tool }),
          ...(props.legendFocus !== undefined && { legendFocus: props.legendFocus }),
        },
        { faceted: isFacetedPlotIntent({ assembled }) },
      ),
    [inspect, props.select, props.zoom, props.tool, props.legendFocus, assembled],
  );
  const datumKey = useMemo(
    () => hostDatumKey(props, registry, undefined, assembled?.data),
    [
      props.identity,
      props.inspect,
      props.select,
      props.interaction,
      props.data,
      assembled?.data,
      registry,
      revision,
    ],
  );
  const scope = useMemo(
    () =>
      resolveInteractionScope({
        interaction: props.interaction,
        ...(props.interactionScope !== undefined && { interactionScope: props.interactionScope }),
        zoom: props.zoom ?? false,
        faceted: isFacetedPlotIntent({ assembled }),
        assembled,
        datumKey,
      }),
    [props.interaction, props.interactionScope, props.zoom, assembled, datumKey],
  );
  const controlledZoom = props.interaction?.zoom(scope);
  const zoomX = controlledZoom?.x;
  const zoomY = controlledZoom?.y;
  const zoom = useMemo(
    () =>
      filterZoomDomainsByMode(
        props.interaction === undefined
          ? localZoom
          : {
              ...(zoomX !== undefined && { x: zoomX }),
              ...(zoomY !== undefined && { y: zoomY }),
            },
        config.zoom?.mode ?? null,
      ),
    [localZoom, props.interaction, zoomX, zoomY, config.zoom?.mode],
  );
  const effectiveSpec = useMemo(
    () => (assembled === null ? null : applyZoomToSpec(assembled, zoom)),
    [assembled, zoom],
  );
  return {
    width,
    height,
    assembled,
    inspectChildren,
    config,
    datumKey,
    scope,
    zoom,
    effectiveSpec,
  };
}

export function plotBoundsInputs(
  model: RenderModel | null,
  config: ReturnType<typeof usePlotInputs>["config"],
) {
  if (model === null) return [];
  const result: { panelId: string; input: BoundsEditorInput }[] = [];
  for (const panel of model.viewport.panels) {
    for (const action of ["select", "zoom"] as const) {
      const mode =
        action === "select"
          ? config.select?.type === "interval"
            ? config.select.mode
            : null
          : (config.zoom?.mode ?? null);
      if (mode === null) continue;
      for (const axis of ["x", "y"] as const) {
        if (mode !== "xy" && mode !== axis) continue;
        const scale = panel.axisEditModel(axis);
        if (action === "zoom" && scale.kind === "band") continue;
        const input = boundsEditorInputForScale({ axis, action, scale });
        if (input !== null) result.push({ panelId: panel.id, input });
      }
    }
  }
  return result;
}

export function preciseInterval(
  model: RenderModel,
  panelId: string,
  event: PreciseBoundsApplyEvent,
  intervals: readonly PlotInteractionInterval<PropertyKey>[],
  candidates: readonly (CandidateFacts & { keys: readonly PropertyKey[] })[],
  mode: "x" | "y" | "xy" | undefined,
): { event: IntervalSelection; domains: ReadonlyIntervalDomains } | null {
  const panel = model.viewport.panel(panelId);
  if (panel === null) return null;
  const scale = panel.axisEditModel(event.axis);
  const values = scale.kind === "band" ? scale.slice(event.bounds) : undefined;
  if (scale.kind === "band" && values === undefined) return null;
  const axis =
    scale.kind === "band"
      ? { kind: "band" as const, values: values!.map((value) => encodeKey(value)) }
      : semanticAxisFromBounds(scale.type, scale.transform, event.bounds);
  const previous = intervals.find((record) => record.panelId === panelId);
  const domains = { ...previous?.domains, [event.axis]: axis };
  const pixels = intervalPixels(model, panelId, domains);
  if (pixels === null) return null;
  const projection = recomputePanelIntervalProjection({ panelId, domains, candidates });
  return {
    domains,
    event: {
      type: "select",
      phase: "end",
      mode: mode ?? event.axis,
      panelId,
      domain: panel.invert(pixels),
      pixels,
      keys: projection.keys,
      lineageCount: projection.lineageCount,
      source: event.inputSource,
    },
  };
}

export function useInteractionRevision(interaction: GGPlotProps["interaction"]): void {
  useSyncExternalStore(
    useCallback(
      (listener: () => void) => interaction?.subscribe(listener) ?? (() => {}),
      [interaction],
    ),
    () => interaction?.revision ?? 0,
    () => interaction?.revision ?? 0,
  );
}
