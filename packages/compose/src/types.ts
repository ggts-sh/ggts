/**
 * Runes-free layer types shared by the registry (`.svelte.ts`) and pure
 * assembly (`assemble.ts`). #785: one `Layer` union — no structural clone.
 */
import type {
  AesInput,
  CoordSpec,
  DataInput,
  FacetInput,
  GeomName,
  GuidesSpec,
  Labs,
  LegendSpec,
  PositionName,
  PositionParams,
  RenderBackend,
  Scales,
  StatName,
  ThemeName,
  ThemeSpec,
} from "@ggts-sh/spec";

/** Aesthetic channel a GuideLegend may enable for focus/filter. */
export type LegendAestheticChannel =
  | "color"
  | "fill"
  | "size"
  | "linewidth"
  | "alpha"
  | "shape"
  | "linetype";

/** Host-only GuideLegend focus contribution (null when focus is off). */
export type LegendFocusLayerValue = {
  readonly channel: LegendAestheticChannel;
  readonly input: true | { readonly preview?: boolean };
} | null;

/** Host-only GuideLegend filter contribution (null when filter is off). */
export type LegendFilterLayerValue = {
  readonly channel: LegendAestheticChannel;
  readonly input: true | { readonly mode?: string; readonly multiple?: boolean };
} | null;

/**
 * A live mark-layer descriptor: properties are getters over the child's
 * `$props`, so prop updates flow into the plot's derived spec without
 * re-registration. (`| undefined` is explicit so getter-backed objects
 * satisfy the type under exactOptionalPropertyTypes.)
 *
 * `params` is a plain record: each geom component narrows its own props
 * (typed per-geom), and normalize()/validate() enforce the per-geom schema.
 */
export interface MarkLayerDescriptor {
  readonly geom: GeomName;
  readonly stat?: StatName | undefined;
  readonly aes?: AesInput | undefined;
  /** Optional layer-local data (#589). */
  readonly data?: DataInput | readonly Record<string, unknown>[] | undefined;
  readonly position?: PositionName | undefined;
  readonly positionParams?: PositionParams | undefined;
  readonly render?: RenderBackend | undefined;
  /** `false` keeps a decorative layer out of inspection (#1065). */
  readonly inspect?: false | undefined;
  readonly params?: Record<string, unknown> | undefined;
}

/**
 * Everything a declaration-only child may contribute to a plot.
 * Mark/geom layers map onto `spec.layers`; other kinds fold into top-level
 * portable-spec fields (theme/scale/coord/facet/labs/guides/legend).
 *
 * Live getters are load-bearing for non-mark variants exactly as for marks:
 * `value` reads the child's `$props` proxy so prop changes flow through the
 * plot's `$derived` with zero re-registration.
 */
export type Layer =
  | { readonly kind: "mark"; readonly descriptor: MarkLayerDescriptor }
  | { readonly kind: "scale"; get value(): Scales }
  | { readonly kind: "theme"; get value(): ThemeName | ThemeSpec }
  | { readonly kind: "coord"; get value(): CoordSpec | "flip" }
  | { readonly kind: "facet"; get value(): FacetInput }
  | { readonly kind: "labs"; get value(): Labs }
  | { readonly kind: "guides"; get value(): GuidesSpec }
  | { readonly kind: "legend"; get value(): LegendSpec }
  /** Host-only interaction contribution from `<GuideLegend focus>` — not PortableSpec. */
  | { readonly kind: "legendFocus"; get value(): LegendFocusLayerValue }
  /** Host-only interaction contribution from `<GuideLegend filter>` — not PortableSpec. */
  | { readonly kind: "legendFilter"; get value(): LegendFilterLayerValue };

/** Non-mark grammar layer kinds (the seven #659 families). Host-only kinds excluded. */
export type GrammarLayerKind = Exclude<Layer["kind"], "mark" | "legendFocus" | "legendFilter">;

/**
 * Structural form accepted by fold/assemble: `value` may be a live getter or a
 * plain field. Compatible with registry `Layer` objects and test literals.
 */
export type PlotLayerLike =
  | { readonly kind: "mark"; readonly descriptor: MarkLayerDescriptor }
  | { readonly kind: "scale"; readonly value: Scales }
  | { readonly kind: "theme"; readonly value: ThemeName | ThemeSpec }
  | { readonly kind: "coord"; readonly value: CoordSpec | "flip" }
  | { readonly kind: "facet"; readonly value: FacetInput }
  | { readonly kind: "labs"; readonly value: Labs }
  | { readonly kind: "guides"; readonly value: GuidesSpec }
  | { readonly kind: "legend"; readonly value: LegendSpec }
  | { readonly kind: "legendFocus"; readonly value: LegendFocusLayerValue }
  | { readonly kind: "legendFilter"; readonly value: LegendFilterLayerValue };

/** True for host-only registry kinds that assemble/fold must ignore. */
export function isHostPlotLayer(layer: { readonly kind: string }): boolean {
  return layer.kind === "legendFocus" || layer.kind === "legendFilter";
}
