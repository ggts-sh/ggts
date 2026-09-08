/**
 * normalize() — the canonicalizer (plan: "One canonical form per concept").
 *
 * Input: a SpecInput, the TS/builder-level convenience form where channels may
 * be bare strings ('displ' means { field: 'displ' }). The JSON Schema does NOT
 * admit bare strings — the shorthand exists only here and in the Svelte props.
 * Input types live in normalize-input.ts.
 *
 * Output: a canonical PortableSpec. Canonicalization performed:
 *  1. Bare-string channels -> { field } (in plot aes and layer aes).
 *  2. Geom defaults filled (GEOM_DEFAULTS): bar -> stat count + position
 *     stack; col/area -> identity + stack; everything else identity/identity.
 *  3. Bar layers with no y channel get the count stat's default mapping
 *     y: { stat: "count" } (ggplot2's after_stat default aes).
 *  4. Aes inheritance RESOLVED into each layer with null-unset semantics
 *     (layer channel null removes the inherited channel), and the plot-level
 *     `aes` removed from the output. Every normalized layer is self-contained.
 *     (Resolving at normalize time is what makes normalize idempotent: keeping
 *     plot aes AND merged layers would re-inherit null-unset channels on a
 *     second pass.)
 *  5. Theme names stay strings; theme objects are cloned (both canonical).
 *  6. Deterministic key order for every object it constructs.
 *
 * Scale-type inference needs data, so it lives in @ggts-sh/core (pipeline);
 * normalize only fills structural defaults. Normalized output is itself a
 * valid PortableSpec, and normalize(normalize(s)) deep-equals normalize(s).
 *
 * Scale and coord canonicalization live in normalize-scales.ts and
 * normalize-coord.ts; this module owns channels, layers, facet, theme, and
 * the top-level normalize() walk.
 */
import type {
  Aes,
  AliasGeomName,
  ChannelValue,
  FacetSpec,
  GuidesSpec,
  GuideSpec,
  NormalizedGeomName,
  NormalizedLayerSpec,
  NormalizedSpec,
  ThemeName,
  ThemeSpec,
} from "./schema.js";
import { normalizeCoord } from "./normalize-coord.js";
import { normalizeLayerParamsPaint } from "./normalize-paint.js";
import { normalizeScales } from "./normalize-scales.js";
import { CHANNELS, CURRENT_EDITION, GEOM_ALIASES, GEOM_DEFAULTS } from "./schema-catalog.js";
import type {
  AesInput,
  ChannelInput,
  FacetInput,
  LayerInput,
  SpecInput,
} from "./normalize-input.js";

// Stable public path: re-export input types so index/builder/tests keep
// importing from ./normalize.js (type-only dependency on normalize-input).
export type {
  AesInput,
  AreaLayerInput,
  BarLayerInput,
  BoxplotLayerInput,
  ChannelInput,
  ColLayerInput,
  DensityLayerInput,
  ErrorbarLayerInput,
  LinerangeLayerInput,
  PointrangeLayerInput,
  CrossbarLayerInput,
  FacetFieldInput,
  FacetInput,
  HistogramLayerInput,
  FreqpolyLayerInput,
  HlineLayerInput,
  JitterLayerInput,
  RibbonLayerInput,
  SegmentLayerInput,
  CountLayerInput,
  ViolinLayerInput,
  FunctionLayerInput,
  PolygonLayerInput,
  AblineLayerInput,
  ContourLayerInput,
  Density2dLayerInput,
  Density2dFilledLayerInput,
  DotplotLayerInput,
  BlankLayerInput,
  MapLayerInput,
  SpokeLayerInput,
  SfLayerInput,
  SfTextLayerInput,
  SfLabelLayerInput,
  CurveLayerInput,
  RugLayerInput,
  StepLayerInput,
  QqLayerInput,
  QqLineLayerInput,
  LayerInput,
  LineLayerInput,
  PathLayerInput,
  PointLayerInput,
  RasterLayerInput,
  HexLayerInput,
  RectLayerInput,
  RuleLayerInput,
  QuantileLayerInput,
  SmoothLayerInput,
  SpecInput,
  TextLayerInput,
  LabelLayerInput,
  TileLayerInput,
  Bin2dLayerInput,
  VlineLayerInput,
} from "./normalize-input.js";

/** Canonicalize one channel: bare string -> { field }; clone canonical forms. */
export function normalizeChannel(input: ChannelInput): ChannelValue {
  if (typeof input === "string") return { field: input };
  if (input === null) return null;
  if ("field" in input) return { field: input.field };
  if ("value" in input) {
    return input.scale === undefined
      ? { value: input.value }
      : { value: input.value, scale: input.scale };
  }
  return { stat: input.stat };
}

function normalizeAes(input: AesInput | undefined): Aes | undefined {
  if (input === undefined) return undefined;
  const out: Record<string, ChannelValue> = {};
  for (const channel of CHANNELS) {
    const v = input[channel];
    if (v === undefined) continue;
    out[channel] = normalizeChannel(v);
  }
  return out;
}

/**
 * Merge plot-level aes into a layer's aes with null-unset semantics:
 * layer channels override; a layer channel of null REMOVES the inherited
 * channel (and does not survive into the resolved mapping).
 */
function resolveLayerAes(plotAes: Aes | undefined, layerAes: Aes | undefined): Aes | undefined {
  const out: Record<string, ChannelValue> = {};
  for (const channel of CHANNELS) {
    const own = layerAes?.[channel];
    if (own === null) continue; // explicit unset
    const inherited = plotAes?.[channel];
    const chosen = own ?? inherited;
    if (chosen === undefined || chosen === null) continue;
    out[channel] = chosen;
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

/** Annotation-form rule / hline / vline layers (fixed intercepts) inherit NO
 *  plot aes — ggplot2's `inherit.aes = FALSE` on geom_vline/hline (Hadley
 *  lesson 15: honest, separate signatures for the two rule forms).
 *  Asymmetric: hline is annotation only when yintercept is set; vline only
 *  when xintercept is set; rule when either intercept is set. */
function isAnnotationRule(layer: LayerInput): boolean {
  const params = layer.params as { xintercept?: unknown; yintercept?: unknown } | undefined;
  if (layer.geom === "hline") return params?.yintercept !== undefined;
  if (layer.geom === "vline") return params?.xintercept !== undefined;
  if (layer.geom !== "rule") return false;
  return params?.xintercept !== undefined || params?.yintercept !== undefined;
}

/** Abline is always annotation-style (fixed slope/intercept; no plot aes). */
function isAnnotationAbline(layer: LayerInput): boolean {
  return layer.geom === "abline";
}

/**
 * Convenience geom aliases (#818 / histogram / freqpoly): rewrite to the
 * canonical geom name. Pure renames only — no cross-field params surgery.
 *
 * The rewrite is GEOM_ALIASES, so the alias set is one table core can key its
 * pipeline records off (#1042) rather than a fact buried in this branch.
 */
function canonicalGeom(geom: LayerInput["geom"]): NormalizedGeomName {
  // Own-key check, not `in`: `in` walks the prototype chain, so a geom named
  // "constructor" or "toString" would read as an alias and rewrite to a
  // function. Unknown names must pass through for validate() to reject.
  return Object.hasOwn(GEOM_ALIASES, geom)
    ? GEOM_ALIASES[geom as AliasGeomName]
    : (geom as NormalizedGeomName);
}

function normalizeLayer(layer: LayerInput, plotAes: Aes | undefined): NormalizedLayerSpec {
  // Data-driven hline/vline are one-axis rules: drop the orthogonal position
  // channel from inheritance so plot-level x+y does not trigger rule-both-axes.
  const layerAesInput = normalizeRuleAesInput(layer);

  const inherited = isAnnotationRule(layer) || isAnnotationAbline(layer) ? undefined : plotAes;
  let aes = resolveLayerAes(inherited, normalizeAes(layerAesInput));
  // Unknown geoms fall back to identity defaults so normalize never throws —
  // validate() rejects them right after with the proper did-you-mean error.
  // Own-key check for the same reason as canonicalGeom: plain `[…]` on a geom
  // named "constructor" returns a function, which is truthy, so `??` would not
  // fire and the layer would lose stat and position.
  const defaults = Object.hasOwn(GEOM_DEFAULTS, layer.geom)
    ? GEOM_DEFAULTS[layer.geom]
    : { stat: "identity" as const, position: "identity" as const };
  // geom_sf: public stat_sf (#809 phase 7). Rewrite legacy portable
  // `stat: "identity"` so re-normalize stays additive (draw path unchanged).
  const rawStat = layer.stat ?? defaults.stat;
  const stat = layer.geom === "sf" && rawStat === "identity" ? "sf" : rawStat;
  // Stat default mappings (ggplot2's `after_stat()` default aes): the count
  // and bin stats map y to their count column; the density stat maps y to
  // its density column.
  aes = normalizeStatAes(aes, stat, layer.geom);
  const geom = canonicalGeom(layer.geom);
  const positionParams =
    "positionParams" in layer && layer.positionParams !== undefined
      ? { ...layer.positionParams }
      : undefined;
  const rawParams = layer.params === undefined ? undefined : { ...layer.params };
  const params = rawParams === undefined ? undefined : normalizeLayerParamsPaint(rawParams);
  // "auto" is the render default — one canonical form per concept, so it
  // canonicalizes away (same rule as coord "cartesian" / a11y "auto").
  const render = layer.render === "auto" ? undefined : layer.render;
  // Jitter alias has no position field on the input type; always use defaults.
  const position = normalizeLayerPosition(layer, defaults.position);
  const out = {
    geom,
    stat,
    position,
    ...(positionParams !== undefined && { positionParams }),
    ...(render !== undefined && { render }),
    ...(aes !== undefined && { aes }),
    ...(layer.data !== undefined && { data: layer.data }),
    // Only `false` is expressible. Read as unknown so a raw JSON `inspect: true`
    // is not rewritten to false — validate rejects non-false; typed input only
    // admits false (#1065).
    ...((layer as { readonly inspect?: unknown }).inspect === false && {
      inspect: false as const,
    }),
    ...(params !== undefined && { params }),
  };
  return out as NormalizedLayerSpec;
}

function normalizeRuleAesInput(layer: LayerInput): LayerInput["aes"] {
  if (layer.geom === "hline" && !isAnnotationRule(layer)) return { ...layer.aes, x: null };
  if (layer.geom === "vline" && !isAnnotationRule(layer)) return { ...layer.aes, y: null };
  return layer.aes;
}

function normalizeStatAes(
  aes: Aes | undefined,
  stat: string,
  geom: LayerInput["geom"],
): Aes | undefined {
  let normalized = normalizeStatPositionAes(aes, stat);
  normalized = normalizeStatStyleAes(normalized, stat, geom);
  return normalized;
}

function normalizeStatPositionAes(aes: Aes | undefined, stat: string): Aes | undefined {
  if ((stat === "count" || stat === "bin") && aes?.y === undefined) {
    return { ...aes, y: { stat: "count" } };
  }
  if (stat === "density" && aes?.y === undefined) return { ...aes, y: { stat: "density" } };
  if (stat === "function" && aes?.y === undefined) return { ...aes, y: { stat: "y" } };
  if (stat === "ecdf" && aes?.y === undefined) return { ...aes, y: { stat: "ecdf" } };
  if (stat === "bindot" && aes?.y === undefined) return { ...aes, y: { stat: "stackpos" } };
  return aes;
}

function normalizeStatStyleAes(
  aes: Aes | undefined,
  stat: string,
  geom: LayerInput["geom"],
): Aes | undefined {
  if (stat === "sum" && aes?.size === undefined) return { ...aes, size: { stat: "n" } };
  if (stat === "bin_hex" && aes?.fill === undefined) return { ...aes, fill: { stat: "count" } };
  if ((stat === "density_2d_filled" || geom === "density_2d_filled") && aes?.fill === undefined) {
    return { ...aes, fill: { stat: "level" } };
  }
  if (stat === "bin_2d" && aes?.fill === undefined) return { ...aes, fill: { stat: "count" } };
  return aes;
}

function normalizeLayerPosition(
  layer: LayerInput,
  defaultPosition: NormalizedLayerSpec["position"],
): NormalizedLayerSpec["position"] {
  if (layer.geom === "jitter") return defaultPosition;
  return "position" in layer && layer.position !== undefined ? layer.position : defaultPosition;
}

/** Canonicalize one facet field: bare string -> { field }; clone levels/labels. */
function normalizeFacetField(v: FacetInput["wrap"]): FacetSpec["wrap"] | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "string") return { field: v };
  const levels =
    v.levels === undefined
      ? undefined
      : ([...v.levels] as NonNullable<FacetSpec["wrap"]>["levels"]);
  const labels = v.labels === undefined ? undefined : { ...v.labels };
  return {
    field: v.field,
    ...(levels !== undefined && { levels }),
    ...(labels !== undefined && { labels }),
  };
}

/** Canonicalize facet strip chrome (position + show). */
function normalizeFacetStrip(strip: NonNullable<FacetInput["strip"]>): FacetSpec["strip"] {
  const out: NonNullable<FacetSpec["strip"]> = {
    ...(strip.position !== undefined && { position: strip.position }),
    ...(strip.show !== undefined && { show: strip.show }),
  };
  return out;
}

/** Canonicalize a facet input: bare-string fields -> { field }. */
function normalizeFacet(facet: FacetInput): FacetSpec {
  const wrap = normalizeFacetField(facet.wrap);
  const rows = normalizeFacetField(facet.rows);
  const cols = normalizeFacetField(facet.cols);
  const strip = facet.strip === undefined ? undefined : normalizeFacetStrip(facet.strip);
  return {
    ...(wrap !== undefined && { wrap }),
    ...(rows !== undefined && { rows }),
    ...(cols !== undefined && { cols }),
    ...(facet.ncol !== undefined && { ncol: facet.ncol }),
    ...(facet.scales !== undefined && { scales: facet.scales }),
    ...(strip !== undefined && Object.keys(strip).length > 0 && { strip }),
  };
}

function normalizeTheme(theme: ThemeName | ThemeSpec): ThemeName | ThemeSpec {
  return typeof theme === "string" ? theme : { ...theme };
}

function normalizeGuide(guide: GuideSpec): GuideSpec {
  return {
    ...guide,
    ...(guide.type !== "none" && guide.theme !== undefined && { theme: { ...guide.theme } }),
  };
}

const GUIDE_ORDER = [
  "x",
  "y",
  "color",
  "fill",
  "size",
  "linewidth",
  "alpha",
  "shape",
  "linetype",
] as const;

function normalizeGuides(guides: GuidesSpec): GuidesSpec {
  return Object.fromEntries(
    GUIDE_ORDER.flatMap((aesthetic) => {
      const guide = guides[aesthetic];
      return guide === undefined ? [] : [[aesthetic, normalizeGuide(guide)]];
    }),
  );
}

/**
 * Canonicalize a SpecInput into a normalized PortableSpec (see module docs).
 *
 * The NormalizedSpec return type promises one thing the runtime enforces —
 * canonicalGeom() has rewritten every alias geom. It promises nothing about an
 * unknown geom: normalize() deliberately never throws on one (see below), so
 * the type is only sound once validate() has passed on the result.
 */
export function normalize(input: SpecInput): NormalizedSpec {
  const plotAes = normalizeAes(input.aes);
  // Defaults canonicalize away: Cartesian/identity coord and a11y "auto" ARE
  // the absent forms (one canonical form per concept).
  const coord = normalizeCoord(input.coord);
  const a11y = input.a11y === "force-svg" ? input.a11y : undefined;
  const out: NormalizedSpec = {
    ...(input.$schema !== undefined && { $schema: input.$schema }),
    // Defaults-edition stamping (Hadley lesson 13): absent -> current, so the
    // spec's default look is frozen at authoring time (schema description).
    edition: input.edition ?? CURRENT_EDITION,
    ...(input.data !== undefined && { data: input.data }),
    ...(input.datasets !== undefined && { datasets: input.datasets }),
    layers: input.layers.map((layer) => normalizeLayer(layer, plotAes)),
    ...(input.facet !== undefined && { facet: normalizeFacet(input.facet) }),
    ...(coord !== undefined && { coord }),
    ...(input.scales !== undefined && { scales: normalizeScales(input.scales) }),
    ...(input.guides !== undefined && { guides: normalizeGuides(input.guides) }),
    ...(input.legend !== undefined && { legend: { ...input.legend } }),
    ...(input.labs !== undefined && { labs: { ...input.labs } }),
    ...(input.theme !== undefined && { theme: normalizeTheme(input.theme) }),
    ...(input.width !== undefined && { width: input.width }),
    ...(input.height !== undefined && { height: input.height }),
    ...(a11y !== undefined && { a11y }),
  };
  return out;
}
