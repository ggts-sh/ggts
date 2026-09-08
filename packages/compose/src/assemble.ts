import type {
  A11yMode,
  AesInput,
  CoordSpec,
  DataInput,
  FacetInput,
  GuidesSpec,
  Labs,
  LayerInput,
  LegendSpec,
  PortableSpec,
  Scales,
  SpecInput,
  ThemeName,
  ThemeSpec,
} from "@ggts-sh/spec";
import { calendarDateFields, normalize, toAuthoringDataRef, toDataRef } from "@ggts-sh/spec";

import type { PlotInteractionScope, ZoomInput } from "./interaction-scope.js";
import { foldPlotLayer, type AssembleDraft } from "./fold.js";
import type { MarkLayerDescriptor, PlotLayerLike } from "./types.js";

/**
 * Structural mark-layer descriptor (live getters allowed). Alias of the shared
 * MarkLayerDescriptor so callers that already import from assemble keep working
 * without pulling in the `.svelte.ts` registry (#785).
 */
export type MarkLayerDescriptorLike = MarkLayerDescriptor;

/** True when an object is already a single-key DataRef container. */
function isWrappedDataRef(data: object): data is NonNullable<LayerInput["data"]> {
  const keys = Object.keys(data);
  if (keys.length !== 1) return false;
  const key = keys[0]!;
  if (key === "name") return typeof (data as { name: unknown }).name === "string";
  if (key === "values") return Array.isArray((data as { values: unknown }).values);
  if (key === "columns") {
    const columns = (data as { columns: unknown }).columns;
    return typeof columns === "object" && columns !== null && !Array.isArray(columns);
  }
  return false;
}

/** Wrap geom data props into a DataRef shape for LayerInput. */
function layerDataRef(
  data: DataInput | readonly Record<string, unknown>[],
): NonNullable<LayerInput["data"]> {
  if (Array.isArray(data)) return { values: data as never };
  if (typeof data === "object" && data !== null) {
    if (isWrappedDataRef(data)) return data;
    // Column-oriented bare object.
    return { columns: data as never };
  }
  return { values: [] };
}

/** Convert a registry descriptor into a LayerInput (reads live getters). */
export function toLayerInput(descriptor: MarkLayerDescriptorLike): LayerInput {
  return {
    geom: descriptor.geom,
    ...(descriptor.stat !== undefined && { stat: descriptor.stat }),
    ...(descriptor.position !== undefined && {
      position: descriptor.position,
    }),
    ...(descriptor.positionParams !== undefined && {
      positionParams: descriptor.positionParams,
    }),
    ...(descriptor.render !== undefined && { render: descriptor.render }),
    ...(descriptor.inspect === false && { inspect: false as const }),
    ...(descriptor.aes !== undefined && { aes: descriptor.aes }),
    ...(descriptor.data !== undefined && { data: layerDataRef(descriptor.data) }),
    ...(descriptor.params !== undefined && { params: descriptor.params }),
  } as LayerInput;
}

export type AssemblePortableSpecInput = {
  readonly spec?: SpecInput;
  readonly data?: DataInput | readonly Record<string, unknown>[];
  readonly aes?: AesInput;
  /** Already-resolved layers (caller maps registry descriptors if needed). */
  readonly layers: LayerInput[];
  /**
   * Non-mark registry layers (theme/scale/coord/facet/labs/guides/legend).
   * Folded after both gates and after props, in registration order — children
   * win over props so mid-migration files that keep the deprecated prop still
   * pick up the destination child form (D2 / #659).
   */
  readonly plotLayers?: readonly PlotLayerLike[];
  readonly facet?: FacetInput;
  readonly coord?: CoordSpec | "flip";
  readonly scales?: Scales;
  readonly guides?: GuidesSpec;
  readonly legend?: LegendSpec;
  readonly theme?: ThemeName | ThemeSpec;
  readonly labs?: Labs;
  readonly a11y?: A11yMode;
};

/**
 * Whether this plot instance should take the faceted interaction path
 * (disable brush zoom / interval select with a diagnostic).
 *
 * True when any of:
 * - a `kind: "facet"` registry plot layer is present (`<FacetWrap/>` / …),
 * - `assembled.facet` is set (covers portable-`spec` plots that embed facet).
 *
 * The raw GGPlot `facet` prop was removed in 0.13.0 (#704); facet intent is
 * children- or portable-spec-only.
 */
export function isFacetedPlotIntent(input: {
  readonly plotLayers?: readonly { readonly kind: string }[] | undefined;
  readonly assembled: PortableSpec | null;
}): boolean {
  return (
    input.plotLayers?.some((layer) => layer.kind === "facet") === true ||
    input.assembled?.facet !== undefined
  );
}

/**
 * Snapshot layer data so later mutation of caller-owned arrays cannot leak
 * into the assembled spec (same contract as builder.layer / layerFrom).
 */
function snapshotLayerInput(layer: LayerInput): LayerInput {
  // Same pattern as builder-core.layer: assign through DataInput for snapshot.
  if (layer.data === undefined) return layer;
  const data: DataInput = layer.data;
  return { ...layer, data: toAuthoringDataRef(data) } as LayerInput;
}

/**
 * Materialize authoring data (Date → ISO) then normalize — TypeBox validate
 * stays on builder.spec() / validate(), not the GGPlot assemble path.
 *
 * Layers are already snapshotted in `assemblePortableSpec` before fold; do not
 * re-snapshot here (#1327). `foldPlotLayer` never mutates mark layer data.
 */
function materializeAndNormalize(draft: AssembleDraft): PortableSpec {
  const layers = draft.layers;
  const authoringData =
    draft.data === undefined ? undefined : toAuthoringDataRef(draft.data as DataInput);
  const calendarFields = calendarDateFields({
    layers,
    ...(draft.aes !== undefined && { aes: draft.aes }),
    ...(draft.scales !== undefined && { scales: draft.scales }),
  });
  const portableLayers: LayerInput[] = layers.map((layer) => {
    if (layer.data === undefined) return layer;
    // assemblePortableSpec stores AuthoringDataRef; portable ISO conversion here.
    const data = toDataRef(layer.data, calendarFields);
    return { ...layer, data };
  });
  const coord = draft.coord === "flip" ? ({ type: "flip" } as const) : draft.coord;
  const input: SpecInput = {
    ...(authoringData !== undefined && {
      data: toDataRef(authoringData, calendarFields),
    }),
    ...(draft.aes !== undefined && { aes: draft.aes }),
    layers: portableLayers,
    ...(draft.facet !== undefined && { facet: draft.facet }),
    ...(coord !== undefined && { coord }),
    ...(draft.a11y !== undefined && { a11y: draft.a11y }),
    ...(draft.scales !== undefined && { scales: draft.scales }),
    ...(draft.guides !== undefined && { guides: draft.guides }),
    ...(draft.legend !== undefined && { legend: draft.legend }),
    ...(draft.labs !== undefined && { labs: draft.labs }),
    ...(draft.theme !== undefined && { theme: draft.theme }),
  };
  return normalize(input);
}

/**
 * Build the normalized PortableSpec for GGPlot.
 * Explicit `spec` wins over everything (including non-mark children).
 * Empty mark `layers` yields null even when non-mark plotLayers exist —
 * a theme-only plot must not paint an empty axis frame, and PortableSpec.layers
 * is minItems: 1.
 *
 * Does not call TypeBox validate / builder.spec() — pipeline structuralGate
 * + pipeline errors cover render-time diagnostics; agents use validate().
 */
export function assemblePortableSpec(input: AssemblePortableSpecInput): PortableSpec | null {
  if (input.spec !== undefined) return normalize(input.spec);
  if (input.layers.length === 0) return null;

  // Props first, then non-mark children (registration order) — children win (D2).
  // REPLACE families (theme/coord/facet): last write wins.
  // MERGE families (scales/guides/labs/legend): {...prev, ...next} puts child last.
  let draft: AssembleDraft = {
    ...(input.data !== undefined && { data: input.data }),
    ...(input.aes !== undefined && { aes: input.aes }),
    layers: input.layers.map(snapshotLayerInput),
    ...(input.facet !== undefined && { facet: input.facet }),
    ...(input.coord !== undefined && { coord: input.coord }),
    ...(input.a11y !== undefined && { a11y: input.a11y }),
    ...(input.scales !== undefined && { scales: input.scales }),
    ...(input.guides !== undefined && { guides: input.guides }),
    ...(input.legend !== undefined && { legend: input.legend }),
    ...(input.theme !== undefined && { theme: input.theme }),
    ...(input.labs !== undefined && { labs: input.labs }),
  };
  for (const plotLayer of input.plotLayers ?? []) {
    draft = foldPlotLayer(draft, plotLayer);
  }
  return materializeAndNormalize(draft);
}

/**
 * Field name for a positional channel from plot/layer aes, else the channel
 * itself (constants / missing mappings).
 */
export function mappedChannelField(assembled: PortableSpec | null, channel: "x" | "y"): string {
  const channelValue =
    assembled?.aes?.[channel] ??
    assembled?.layers.find(
      (layer) => layer.aes?.[channel] !== undefined && layer.aes[channel] !== null,
    )?.aes?.[channel];
  return channelValue !== undefined && channelValue !== null && "field" in channelValue
    ? channelValue.field
    : channel;
}

export type ResolveInteractionScopeInput = {
  /** Presence-only: any defined controller forces controlled scope rules. */
  readonly interaction: object | null | undefined;
  readonly interactionScope?: PlotInteractionScope;
  readonly zoom?: ZoomInput;
  /**
   * When true, zoom is unsupported (same as normalizeInteractionConfig) and
   * must not force domain scopes — faceted plots use a diagnostic/no-op path.
   */
  readonly faceted?: boolean;
  readonly datumKey?: string | number | symbol | ((...args: never[]) => PropertyKey);
  readonly assembled: PortableSpec | null;
};

/**
 * Resolve the semantic interaction scope for a plot instance.
 * Controlled plots never infer domain scopes; uncontrolled plots do.
 */
export function resolveInteractionScope(input: ResolveInteractionScopeInput): PlotInteractionScope {
  if (input.interaction !== undefined) {
    if (input.interactionScope === undefined)
      throw new TypeError(
        "GGPlot requires interactionScope when interaction is supplied so unrelated charts cannot share semantic keys or domains accidentally.",
      );
    // Mirror normalizeInteractionConfig: faceted zoom is disabled with a
    // diagnostic, so missing x/y scopes must not hard-fail render.
    const zoomMode =
      input.faceted === true
        ? null
        : input.zoom === true
          ? "xy"
          : typeof input.zoom === "object"
            ? input.zoom.mode
            : null;
    if (zoomMode !== null) {
      if (zoomMode !== "y" && input.interactionScope.x === undefined)
        throw new TypeError(
          "Controlled x zoom requires interactionScope.x; controlled plots never infer domain scopes.",
        );
      if (zoomMode !== "x" && input.interactionScope.y === undefined)
        throw new TypeError(
          "Controlled y zoom requires interactionScope.y; controlled plots never infer domain scopes.",
        );
    }
    return Object.freeze({
      keys: input.interactionScope.keys,
      ...(input.interactionScope.x !== undefined && {
        x: input.interactionScope.x,
      }),
      ...(input.interactionScope.y !== undefined && {
        y: input.interactionScope.y,
      }),
      ...(input.interactionScope.intervals !== undefined && {
        intervals: input.interactionScope.intervals,
      }),
    });
  }
  return Object.freeze({
    keys: typeof input.datumKey === "string" ? input.datumKey : "default",
    x: mappedChannelField(input.assembled, "x"),
    y: mappedChannelField(input.assembled, "y"),
  });
}
