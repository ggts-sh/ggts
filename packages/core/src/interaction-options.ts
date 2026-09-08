import type { CellValue } from "./table.js";
import type {
  InspectMode,
  AreaMode,
  InteractionTool,
  TooltipTotal,
  FacetIntervalPreset,
} from "./interaction-types.js";
import type { InteractionDiagnostic } from "./interaction-diagnostics.js";

export interface InspectOptions<
  Row = Record<string, CellValue>,
  Key = PropertyKey,
  Content = unknown,
> {
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
  readonly content?: Content;
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

export type InspectInput<Row = Record<string, CellValue>, Key = PropertyKey, Content = unknown> =
  | boolean
  | InspectOptions<Row, Key, Content>;
export type SelectInput = false | "point" | "interval" | SelectOptions;
export type ZoomInput = boolean | ZoomOptions;
export interface LegendFocusOptions {
  /** Preview a legend group on pointer hover and DOM focus. */
  readonly preview?: boolean;
}
export type LegendFocusInput = boolean | LegendFocusOptions;

export interface ResolvedInteractionConfig<
  Row = Record<string, CellValue>,
  Key = PropertyKey,
  Content = unknown,
> {
  readonly interactive: boolean;
  readonly inspect: Readonly<
    Required<Omit<InspectOptions<Row, Key, Content>, "content" | "identity">> &
      Pick<InspectOptions<Row, Key, Content>, "content">
  > | null;
  /** Select config without `identity` (identity is resolved separately for row keys). */
  readonly select: Readonly<Required<Omit<SelectOptions, "identity">>> | null;
  readonly zoom: Readonly<Required<ZoomOptions>> | null;
  readonly legendFocus: Readonly<Required<LegendFocusOptions>> | null;
  readonly initialTool: InteractionTool;
  readonly availableTools: ReadonlyArray<InteractionTool>;
  readonly diagnostics: ReadonlyArray<InteractionDiagnostic>;
}

export interface InteractionConfigInput<
  Row = Record<string, CellValue>,
  Key = PropertyKey,
  Content = unknown,
> {
  readonly inspect?: InspectInput<Row, Key, Content>;
  readonly select?: SelectInput;
  readonly zoom?: ZoomInput;
  readonly legendFocus?: LegendFocusInput;
  readonly tool?: InteractionTool;
}
