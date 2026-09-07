import type { CellValue, PositionTransformName } from "@ggsvelte/core";
import type { Snippet } from "svelte";

import type { LegendFilterEvent } from "../legend/filter.js";
import type { InteractionDiagnostic } from "./interaction-diagnostics.js";

// Diagnostic catalog (codes + frozen messages) lives in interaction-diagnostics.ts.
export { INTERACTION_DIAGNOSTIC_CATALOG } from "./interaction-diagnostics.js";
export type {
  InteractionDiagnostic,
  InteractionDiagnosticCode,
} from "./interaction-diagnostics.js";
export {
  discreteColorFillDomainSizes,
  HIGH_CARDINALITY_DISCRETE_THRESHOLD,
  inspectAxisOnBarColDiagnostics,
  inspectAxisOnDistributionDiagnostics,
  inspectHighCardinalityDiagnostics,
  layerGeomsFromSpecLayers,
} from "./inspect-geom-advisories.js";

export type InteractionSource = "pointer" | "keyboard" | "touch" | "programmatic";
export type InspectMode = "auto" | "exact" | "x" | "y" | "xy";
export type TooltipTotal = "auto" | "off" | "top" | "bottom";

export type ResolvedInspectMode = Exclude<InspectMode, "auto">;
export type AreaMode = "x" | "y" | "xy";
export type InteractionTool = "inspect" | "point" | "select-area" | "zoom-area";

/** Brush tools that need crosshair cursor and touch-action: none on capture. */
export type AreaInteractionTool = "select-area" | "zoom-area";

export function isAreaTool(tool: InteractionTool): tool is AreaInteractionTool {
  return tool === "select-area" || tool === "zoom-area";
}

export interface TooltipField {
  readonly channel: string;
  readonly field: string;
  readonly value: CellValue;
}

export interface PlotDatum<Row, Key> {
  readonly key: Key | null;
  readonly row: Row | null;
  readonly sourceKeys: ReadonlyArray<Key>;
  readonly lineageCount: number;
  readonly layerIndex: number;
  readonly panelId: string | null;
  readonly fields: ReadonlyArray<TooltipField>;
  readonly anchor: Readonly<{ x: number; y: number }>;
}

export type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

interface PlotInspectionBase<Row, Key> {
  readonly type: "inspect";
  readonly phase: "change";
  readonly state: "transient" | "pinned";
  readonly source: InteractionSource;
  readonly panelId: string | null;
  /**
   * Sum of unique series contributions in the composition group (stack/fill),
   * independent of inspect `mode`. `null` when the group is not additive
   * (identity/dodge) or has no finite numeric contribution. Exact/xy keep a
   * single listed member; the total still covers the whole stack.
   */
  readonly groupTotal?: number | null;

  readonly focus: PlotDatum<Row, Key>;
  readonly members: NonEmptyReadonlyArray<PlotDatum<Row, Key>>;
}

export type PlotInspectionChange<Row, Key> =
  | (PlotInspectionBase<Row, Key> & { readonly mode: "exact" | "xy" })
  | (PlotInspectionBase<Row, Key> & {
      readonly mode: "x" | "y";
      readonly axisValue: CellValue;
      readonly axisLabel: string;
      /**
       * Sum of numeric contributions on the value axis for unique series in
       * the full axis group (y when mode is x, x when mode is y). Used by
       * the default tooltip Total row; independent of the hover member cap
       * (#1274 / #1389). Only populated when the group includes a stack/fill
       * layer — parallel multi-series (identity/dodge lines and points) leave
       * this `null` so the tooltip does not invent a sum. Multi-layer paints
       * of the same source series (line+point, col+text) contribute once;
       * distinct series on other layers (e.g. a trend over a stack) are
       * included. Also `null` when no member has a finite numeric contribution.
       */
      readonly groupTotal: number | null;
      /**
       * Unique series-contribution count in the full axis group (all layers,
       * deduped). Drives the default tooltip "+N more" line when hover rows
       * were truncated (#1274 / #1389).
       */
      readonly groupMemberCount: number;
    });

export interface PlotInspectionClear {
  readonly type: "inspect";
  readonly phase: "clear";
  readonly source: InteractionSource;
}

export type PlotInspection<Row, Key = PropertyKey> =
  | PlotInspectionChange<Row, Key>
  | PlotInspectionClear;

export interface IntervalSelection<Key = PropertyKey> {
  readonly type: "select";
  readonly phase: "start" | "change" | "end" | "clear";
  readonly mode: AreaMode;
  readonly panelId: string | null;
  readonly domain: Readonly<{
    x?: readonly [CellValue, CellValue];
    y?: readonly [CellValue, CellValue];
  }>;
  readonly pixels: Readonly<{ x0: number; y0: number; x1: number; y1: number }>;
  readonly keys: ReadonlyArray<Key>;
  readonly lineageCount: number;
  readonly source: InteractionSource;
}

export interface PointSelection<Key = PropertyKey> {
  readonly type: "select";
  readonly phase: "end" | "clear";
  readonly mode: "point";
  readonly keys: ReadonlyArray<Key>;
  readonly source: InteractionSource;
}

export type PlotSelection<Key = PropertyKey> = IntervalSelection<Key> | PointSelection<Key>;

export interface ZoomEvent {
  readonly type: "zoom";
  readonly phase: "end" | "clear";
  readonly source: InteractionSource;
  readonly domains: ReadonlyZoomDomains | null;
}

export interface LegendFocusChange<Key = PropertyKey> {
  readonly type: "legend-focus";
  readonly phase: "change";
  readonly state: "transient" | "committed";
  readonly source: InteractionSource;
  readonly scale: "color" | "fill" | "size" | "linewidth" | "alpha" | "shape" | "linetype";
  /** Raw encoded domain value. This is deliberately distinct from row keys. */
  readonly value: CellValue;
  readonly label: string;
  readonly keys: ReadonlyArray<Key>;
}

export interface LegendFocusClear {
  readonly type: "legend-focus";
  readonly phase: "clear";
  readonly source: InteractionSource;
}

export type LegendFocusEvent<Key = PropertyKey> = LegendFocusChange<Key> | LegendFocusClear;

export type PlotInteractionEvent<Row, Key = PropertyKey> =
  | PlotInspection<Row, Key>
  | PlotSelection<Key>
  | ZoomEvent
  | LegendFocusEvent<Key>
  | LegendFilterEvent;

export interface InspectOptions<Row = Record<string, CellValue>, Key = PropertyKey> {
  readonly mode?: InspectMode;
  readonly pin?: boolean;
  readonly maxDistance?: number;
  readonly contentMode?: "informational" | "interactive";
  /**
   * When true, inspection mutes non-focused marks (sibling bars/cols) via the
   * interaction mask. Default false — tooltip-only hover avoids full-plot
   * flicker when the pointer crosses gaps between rect marks (#633).
   */
  readonly muteSiblings?: boolean;
  /**
   * Where the default tooltip shows a single group total (stack/fill sum
   * across series at the focused category). Independent of inspect `mode`:
   * stacked bars can keep `mode="exact"` and still show a Total row.
   *
   * - `"auto"` (default): Total at the bottom when the group is additive
   *   (stack/fill) and has more than one series. Axis-mode (`x`/`y`)
   *   inspections already do this; exact/xy do not unless opted in.
   * - `"off"`: never show Total.
   * - `"top"` / `"bottom"`: force Total when a numeric group total exists.
   */
  readonly tooltipTotal?: TooltipTotal;

  /**
   * Durable row identity for interaction payloads (pin rebind, selection
   * keys, legend focus). Preferred over the deprecated GGPlot `key` prop.
   * Default when omitted: `id` column if present, else row index.
   */
  readonly identity?: Key | ((row: Row, index: number) => Key);
  readonly content?: Snippet<[PlotInspectionChange<Row, Key>]>;
}

export interface SelectOptions {
  readonly type: "point" | "interval";
  readonly mode?: AreaMode;
  readonly multiple?: boolean;
  readonly persistent?: boolean;
  /** Facet coordination semantics for durable interval selections. */
  readonly preset?: FacetIntervalPreset;
  /**
   * Durable row identity for selection keys (and shared plot interaction).
   * Preferred over the deprecated GGPlot `key` prop. Not selection semantics —
   * omitted from the resolved select config.
   */
  readonly identity?:
    | PropertyKey
    | ((row: Record<string, CellValue>, index: number) => PropertyKey);
}

export interface ZoomOptions {
  readonly mode?: AreaMode;
  readonly trigger?: "brush";
}

export type InspectInput<Row = Record<string, CellValue>, Key = PropertyKey> =
  | boolean
  | InspectOptions<Row, Key>;
export type SelectInput = false | "point" | "interval" | SelectOptions;
export type ZoomInput = boolean | ZoomOptions;
export interface LegendFocusOptions {
  /** Preview a legend group on pointer hover and DOM focus. */
  readonly preview?: boolean;
}
export type LegendFocusInput = boolean | LegendFocusOptions;

export interface ResolvedInteractionConfig<Row = Record<string, CellValue>, Key = PropertyKey> {
  readonly interactive: boolean;
  readonly inspect: Readonly<
    Required<Omit<InspectOptions<Row, Key>, "content" | "identity">> &
      Pick<InspectOptions<Row, Key>, "content">
  > | null;
  /** Select config without `identity` (identity is resolved separately for row keys). */
  readonly select: Readonly<Required<Omit<SelectOptions, "identity">>> | null;
  readonly zoom: Readonly<Required<ZoomOptions>> | null;
  readonly legendFocus: Readonly<Required<LegendFocusOptions>> | null;
  readonly initialTool: InteractionTool;
  readonly availableTools: ReadonlyArray<InteractionTool>;
  readonly diagnostics: ReadonlyArray<InteractionDiagnostic>;
}

export interface InteractionConfigInput<Row = Record<string, CellValue>, Key = PropertyKey> {
  readonly inspect?: InspectInput<Row, Key>;
  readonly select?: SelectInput;
  readonly zoom?: ZoomInput;
  readonly legendFocus?: LegendFocusInput;
  readonly tool?: InteractionTool;
}

export { normalizeInteractionConfig } from "./normalize-interaction-config.js";

export interface ReadonlyZoomDomains {
  readonly x?: readonly [number, number];
  readonly y?: readonly [number, number];
}

/** Semantic namespaces used when one controller coordinates unlike views.
 * Key state crosses charts only through `keys`; data-space zoom crosses one
 * positional channel only when that channel's scope also matches. */
export interface PlotInteractionScope {
  readonly keys: string;
  readonly x?: string;
  readonly y?: string;
  /** Namespace for semantic facet intervals. Defaults to `keys` when omitted. */
  readonly intervals?: string;
}

export type PlotInteractionChange = "selection" | "emphasis" | "interval" | "zoom";

/** How facet interval state is consumed by coordinated panels.
 *
 * - independent: only the matching panel consumes its interval
 * - union: matching rows from every stored panel interval are combined
 * - cross-panel: the sole origin interval is projected into compatible panels
 */
export type FacetIntervalPreset = "independent" | "union" | "cross-panel";

export type SemanticIntervalAxis =
  | Readonly<{
      kind: "linear" | "time";
      /** Pre-stat position transform (default identity). Always identity for
       *  kind:"time". "log"/"sqrt" semantics live in `transform`, not `kind`. */
      transform?: PositionTransformName;
      /** Ascending data-space values; time values are Unix milliseconds. */
      domain: readonly [number, number];
    }>
  | Readonly<{
      kind: "band";
      /** Ordered, encoded category identities. Labels are presentation-only. */
      values: ReadonlyArray<string>;
    }>;

export interface ReadonlyIntervalDomains {
  readonly x?: SemanticIntervalAxis;
  readonly y?: SemanticIntervalAxis;
}

export interface PlotInteractionInterval<Key extends PropertyKey> {
  /** Stable structured facet identity, never a panel index. */
  readonly panelId: string;
  readonly preset: FacetIntervalPreset;
  readonly domains: ReadonlyIntervalDomains;
  /** Stable source-row identities selected by this panel interval. */
  readonly keys: ReadonlyArray<Key>;
}

export interface ScopedInteractionInterval<
  Key extends PropertyKey,
> extends PlotInteractionInterval<Key> {
  readonly scope: string;
}

export interface ScopedInteractionKeys<Key extends PropertyKey> {
  readonly scope: string;
  readonly keys: ReadonlyArray<Key>;
}

export interface ScopedInteractionDomain {
  readonly scope: string;
  readonly domain: readonly [number, number];
}

/** Controller semantic state. It deliberately excludes rows, renderer
 * indices, pixel rectangles, candidate ids, models, and DOM references. */
export interface PlotInteractionSnapshot<Key extends PropertyKey> {
  readonly revision: number;
  readonly selections: ReadonlyArray<ScopedInteractionKeys<Key>>;
  readonly emphases: ReadonlyArray<ScopedInteractionKeys<Key>>;
  readonly intervals: ReadonlyArray<ScopedInteractionInterval<Key>>;
  readonly zoom: Readonly<{
    x: ReadonlyArray<ScopedInteractionDomain>;
    y: ReadonlyArray<ScopedInteractionDomain>;
  }>;
}

export interface PlotInteractionTransition<Key extends PropertyKey> {
  readonly revision: number;
  readonly kind: PlotInteractionChange | "reconcile";
  readonly changes: ReadonlyArray<PlotInteractionChange>;
  readonly source: InteractionSource;
  readonly scope: PlotInteractionScope;
  readonly snapshot: PlotInteractionSnapshot<Key>;
}

/**
 * @deprecated since 0.1.0 — use IntervalSelection. Kept as a source migration
 * alias only: https://ggsvelte.sh/guide/upgrading#deprecated-type-aliases
 */
export type BrushSelection = IntervalSelection;
/**
 * @deprecated since 0.1.0 — use PlotInspectionChange. Kept as a source
 * migration alias only: https://ggsvelte.sh/guide/upgrading#deprecated-type-aliases
 */
export type TooltipContext<
  Row = Record<string, CellValue>,
  Key = PropertyKey,
> = PlotInspectionChange<Row, Key>;
/**
 * @deprecated since 0.1.0 — use ReadonlyZoomDomains. Kept as a source
 * migration alias only: https://ggsvelte.sh/guide/upgrading#deprecated-type-aliases
 */
export type ZoomDomains = { x?: [number, number]; y?: [number, number] };
