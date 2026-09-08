import type { CellValue } from "./table.js";
import type { PositionTransformName } from "./scales/transform.js";

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

export interface LegendFilterClause {
  readonly scale: "color" | "fill" | "size" | "linewidth" | "alpha" | "shape" | "linetype";
  readonly field: string;
  readonly values: readonly CellValue[];
  readonly mode: "exclude" | "include";
}

export interface LegendFilterOptions {
  /** `exclude` stores hidden values; `include` stores shown values. */
  readonly mode?: "exclude" | "include";
  /** Whether several legend entries may remain independently visible. */
  readonly multiple?: boolean;
}

export type LegendFilterInput = boolean | LegendFilterOptions;

export interface LegendFilterEvent {
  readonly type: "legend-filter";
  /** `remove` deletes one clause; `clear` resets the entire filter set. */
  readonly phase: "change" | "remove" | "clear";
  readonly source: "pointer" | "keyboard" | "touch" | "programmatic";
  readonly clause: LegendFilterClause | null;
}

export type ZoomDomains = { x?: [number, number]; y?: [number, number] };
