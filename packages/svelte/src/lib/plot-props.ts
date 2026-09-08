/**
 * Internal props contract for <GGPlot> + the plot engine (#1040).
 * Not part of the public package surface — never export from the package root.
 *
 * Runtime helpers here own:
 * - capability defaults (`resolveCapabilities`)
 * - PublicKey → PropertyKey widening for engine controllers (`widenPlotProps`)
 */
import type { Snippet } from "svelte";

import type {
  A11yMode,
  AesInput,
  DataInput,
  LayerInput,
  PortableSpec,
  SpecInput,
} from "@ggts-sh/spec";
import type { CellValue, RenderModel } from "@ggts-sh/core";

import type { PlotDiagnostic } from "./diagnostics/deprecation.js";
import type {
  InspectInput,
  InteractionTool,
  LegendFocusEvent,
  LegendFocusInput,
  PlotInspection,
  PlotInteractionEvent,
  PlotInteractionScope,
  PlotSelection,
  SelectInput,
  ZoomEvent,
  ZoomInput,
} from "./interaction/interaction.js";
import type { PlotInteractionController } from "./interaction/controller.svelte.js";
import type { LegendFilterEvent, LegendFilterInput } from "./legend/filter.js";

type PublicKey<
  Row extends Record<string, CellValue>,
  Identity extends keyof Row | ((row: Row, index: number) => PropertyKey),
> = Identity extends keyof Row
  ? Extract<Row[Identity], PropertyKey>
  : Identity extends (row: Row, index: number) => infer Key
    ? Extract<Key, PropertyKey>
    : never;

/**
 * Props for `<GGPlot>`. Grammar pieces (theme, scales, coord, facet, labs,
 * guides, legend) are declaration-only children — not props (#704 / #659).
 * Removed from the prop surface in 0.13.0 (deprecated since 0.11.0).
 */
export interface GGPlotProps<
  Row extends Record<string, CellValue> = Record<string, CellValue>,
  Identity extends keyof Row | ((row: Row, index: number) => PropertyKey) = keyof Row,
> {
  /** A complete spec (bare-string channel shorthand allowed). Wins over the other props. */
  spec?: SpecInput;
  /** Data rows, columns, or a DataRef ({values}/{columns}/{name}). */
  data?: DataInput | readonly Row[];
  /** Plot-level aesthetic mapping (inherited by every layer). */
  aes?: AesInput;
  /** Layers (props-first canonical form). Wins over declaration-only children. */
  layers?: LayerInput[];
  /** Accessibility mode ("force-svg" keeps every layer as SVG marks). */
  a11y?: A11yMode;
  /** Plot width in px. Omitted is container-responsive. */
  width?: number | "container";
  /** Plot height in px (falls back to spec.height, then 400). */
  height?: number;
  /**
   * @deprecated since 0.21.0 — use `identity` on `<Inspect>`, object-form
   * `select={{ type, identity }}`, or `createPlotInteraction({ identity })`.
   * Still honoured (dual-read) until 0.22.0; emits DEPRECATED_PLOT_PROP.
   * Default when no surface sets identity: `id` column when present, else
   * row index. Ordinary charts should omit identity entirely.
   * Migration: https://ggts.sh/guide/upgrading#row-identity-on-interaction
   */
  key?: Identity;
  /** Opt into inspection, its semantic crosshair, tooltip, and pinning. */
  inspect?: InspectInput;
  /** Opt into point or interval selection. */
  select?: SelectInput;
  /** Opt into brush zoom. */
  zoom?: ZoomInput;
  /**
   * @deprecated since 0.19.0 — use `<GuideLegend channel="…" focus />` instead.
   * Still honoured (plot-wide enablement) until 0.20.0; emits DEPRECATED_PLOT_PROP.
   * Migration: https://ggts.sh/guide/upgrading#legend-focus-on-guidelegend
   */
  legendFocus?: LegendFocusInput;
  /**
   * @deprecated since 0.19.0 — use `<GuideLegend channel="…" filter />` instead.
   * Still honoured (plot-wide enablement) until 0.20.0; emits DEPRECATED_PLOT_PROP.
   * Migration: https://ggts.sh/guide/upgrading#legend-filter-on-guidelegend
   */
  legendFilter?: LegendFilterInput;
  /** Controlled initial/active tool. */
  tool?: InteractionTool;
  /** Optional durable semantic state shared with other plots and Svelte UI. */
  interaction?: PlotInteractionController<PublicKey<Row, Identity>>;
  /** Semantic identity for linked keys and positional domains. */
  interactionScope?: PlotInteractionScope;
  /** Accessible chart name; falls back to the plot title/generated label. */
  ariaLabel?: string;
  oninspect?: (event: PlotInspection<Row, PublicKey<Row, Identity>>) => void;
  onselect?: (event: PlotSelection<PublicKey<Row, Identity>>) => void;
  onzoom?: (event: ZoomEvent) => void;
  onlegendfocus?: (event: LegendFocusEvent<PublicKey<Row, Identity>>) => void;
  onlegendfilter?: (event: LegendFilterEvent) => void;
  oninteraction?: (event: PlotInteractionEvent<Row, PublicKey<Row, Identity>>) => void;
  ondiagnostic?: (diagnostic: PlotDiagnostic) => void;
  ontoolchange?: (tool: InteractionTool) => void;
  /** Called after each committed render with the model (warnings,
   *  advisories, scales) and the normalized PortableSpec. */
  onrender?: (model: RenderModel, spec: PortableSpec) => void;
  children?: Snippet;
}

/** Capability defaults after optional props resolve (engine-facing). */
export type ResolvedPlotCapabilities = {
  inspect: InspectInput;
  select: SelectInput;
  zoom: ZoomInput;
  legendFocus: LegendFocusInput;
  legendFilter: LegendFilterInput;
};

/**
 * Defaults the five interaction capability props to `false` when omitted.
 * Pure — does not clone object-form configs (identity preserved for epoch
 * and reference-equality consumers).
 *
 * Input is a plain bag (not `Pick<GGPlotProps, …>`) so dual-read of the
 * deprecated `legendFocus` / `legendFilter` props does not trip
 * `typescript/no-deprecated` at every resolveCapabilities call site during
 * the 0.19→0.20 window.
 */
export function resolveCapabilities(props: {
  readonly inspect?: InspectInput;
  readonly select?: SelectInput;
  readonly zoom?: ZoomInput;
  readonly legendFocus?: LegendFocusInput;
  readonly legendFilter?: LegendFilterInput;
}): ResolvedPlotCapabilities {
  return {
    inspect: props.inspect ?? false,
    select: props.select ?? false,
    zoom: props.zoom ?? false,
    legendFocus: props.legendFocus ?? false,
    legendFilter: props.legendFilter ?? false,
  };
}

/**
 * Read the deprecated plot-level `key` prop during the dual-read window.
 * Prefer Inspect / Select / createPlotInteraction `identity` instead.
 */
export function readLegacyPlotKey(
  props: EnginePlotProps | GGPlotProps,
): EnginePlotProps["key"] | undefined {
  // Dual-read until 0.22.0 — prefer interaction-surface identity.
  // oxlint-disable-next-line typescript/no-deprecated -- intentional dual-read
  return props.key;
}

/**
 * Read the deprecated plot-level `legendFocus` prop during the dual-read
 * window. Isolate the deprecation access so call sites stay clean.
 */
export function readLegacyPlotLegendFocus(
  props: EnginePlotProps | GGPlotProps,
): LegendFocusInput | undefined {
  // Dual-read until 0.20.0 — prefer <GuideLegend focus>.
  // oxlint-disable-next-line typescript/no-deprecated -- intentional dual-read
  return props.legendFocus;
}

/**
 * Read the deprecated plot-level `legendFilter` prop during the dual-read
 * window. Isolate the deprecation access so call sites stay clean.
 */
export function readLegacyPlotLegendFilter(
  props: EnginePlotProps | GGPlotProps,
): LegendFilterInput | undefined {
  // Dual-read until 0.20.0 — prefer <GuideLegend filter>.
  // oxlint-disable-next-line typescript/no-deprecated -- intentional dual-read
  return props.legendFilter;
}

/**
 * Engine-facing props: same surface as `GGPlotProps` with the six
 * PublicKey-generic fields widened to PropertyKey (controller deps).
 * Derived via `Omit` — not a hand-restated 30-field mirror (#1040).
 */
export type EnginePlotProps = Omit<
  GGPlotProps,
  "key" | "interaction" | "oninspect" | "onselect" | "onlegendfocus" | "oninteraction"
> & {
  key?: PropertyKey | ((row: Record<string, CellValue>, index: number) => PropertyKey);
  interaction?: PlotInteractionController;
  oninspect?: (event: PlotInspection<Record<string, CellValue>>) => void;
  onselect?: (event: PlotSelection) => void;
  onlegendfocus?: (event: LegendFocusEvent) => void;
  oninteraction?: (event: PlotInteractionEvent<Record<string, CellValue>>) => void;
};

/**
 * Stable lazy view of plot props for the engine. Non-widened fields forward
 * through the source proxy (per-field reactive deps). The six PublicKey
 * fields cast once here instead of at the GGPlot call site.
 */
export function widenPlotProps<
  Row extends Record<string, CellValue>,
  Identity extends keyof Row | ((row: Row, index: number) => PropertyKey),
>(props: GGPlotProps<Row, Identity>): EnginePlotProps {
  const handler: ProxyHandler<GGPlotProps<Row, Identity>> = {
    get(target, prop, receiver) {
      // Six precise casts — only these fields change assignability.
      if (prop === "key") {
        // Dual-read until 0.22.0 — prefer interaction-surface identity.
        // oxlint-disable-next-line typescript/no-deprecated -- intentional dual-read
        return target.key as EnginePlotProps["key"];
      }
      if (prop === "interaction") {
        return target.interaction as EnginePlotProps["interaction"];
      }
      if (prop === "oninspect") {
        return target.oninspect as EnginePlotProps["oninspect"];
      }
      if (prop === "onselect") {
        return target.onselect as EnginePlotProps["onselect"];
      }
      if (prop === "onlegendfocus") {
        return target.onlegendfocus as EnginePlotProps["onlegendfocus"];
      }
      if (prop === "oninteraction") {
        return target.oninteraction as EnginePlotProps["oninteraction"];
      }
      return Reflect.get(target, prop, receiver) as EnginePlotProps[keyof EnginePlotProps];
    },
  };
  // Proxy of GGPlotProps is the EnginePlotProps view; bridge via unknown once.
  return new Proxy(props, handler) as unknown as EnginePlotProps;
}
