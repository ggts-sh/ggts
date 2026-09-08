/**
 * Attach constant mark style to discrete paint legend keys.
 *
 * Paint scales train colour only. Layer params like `shape: "cross"` (and the
 * default circle for point-family geoms) live on the mark, so without this
 * step every color key falls through to a filled square — indistinguishable
 * for colorblind readers when two layers share one color scale with different
 * shapes (Snow cholera: grey deaths as circles, red pumps as crosses).
 *
 * Line-family colour keys get the same treatment: a constant or default
 * `linetype` so renderers draw a stroke segment instead of a square.
 *
 * When shape or linetype is a mapped aesthetic, leave the agreed-constant
 * map empty so the scale-merge path in prepareLegendInputs can supply the
 * scaled value. Colour keys on line-only plots still get a solid stroke
 * fallback when merge does not set linetype (hidden or separate linetype
 * guide). Area/bar/col fill keys stay squares. Do not stamp linetype onto
 * a key that already carries an agreed point shape — mergeDiscrete drops
 * shape when both exist. Two constant linetypes that conflict also get the
 * solid fallback so the colour key stays a stroke.
 */
import { LINETYPE_NAMES, POINT_SHAPE_NAMES } from "@ggts-sh/spec";

import type { DiscreteLegendInput } from "../legend.js";
import type { Linetype, PointShape } from "../scales/style.js";
import { encodeKey } from "../scales/state.js";

import type { LayerBinding } from "./types.js";

type LegendKeyStyle = ReturnType<NonNullable<DiscreteLegendInput["keyOf"]>>;

const POINT_SHAPE_SET = new Set<string>(POINT_SHAPE_NAMES);
const LINETYPE_SET = new Set<string>(LINETYPE_NAMES);
/**
 * Geoms that always emit point marks (PointsBatch). Not the same as
 * STYLE_AESTHETIC_GEOMS.shape, which lists geoms that *accept* a shape aesthetic
 * (includes `sf` for points only, and `blank` which draws nothing). Choropleth
 * sf / map layers must keep square paint keys.
 */
const POINT_MARK_GEOMS = new Set<string>([
  "point",
  "jitter",
  "count",
  "dotplot",
  "qq",
  "pointrange",
]);
/**
 * Canonical stroke geoms that reach the pipeline. Aliases (`freqpoly` →
 * `line`) are already rewritten. Broader linetype-capable geoms (rule,
 * smooth, rug, density_2d) stay out until audited.
 */
const LINE_MARK_GEOMS = new Set<string>(["line", "path", "step"]);

function isPaintScale(scale: string): scale is "color" | "fill" {
  return scale === "color" || scale === "fill";
}

function layerMapsPaint(binding: LayerBinding, aesthetic: "color" | "fill"): boolean {
  const channel = binding[aesthetic];
  return (
    channel.scaledConstant !== null ||
    channel.field !== null ||
    (channel.statColumn !== null && channel.statColumn !== undefined)
  );
}

/** True when this layer can produce the domain value for the paint aesthetic. */
function layerContributesPaintValue(
  binding: LayerBinding,
  aesthetic: "color" | "fill",
  value: unknown,
): boolean {
  const channel = binding[aesthetic];
  if (channel.scaledConstant !== null) {
    try {
      return encodeKey(channel.scaledConstant) === encodeKey(value);
    } catch {
      return false;
    }
  }
  // Field/stat mappings may emit any trained domain value; without the frame
  // we cannot filter per-value, so the layer's constant mark style applies to
  // every key (correct for the common single-layer colored-points case).
  if (channel.field !== null || (channel.statColumn !== null && channel.statColumn !== undefined)) {
    return true;
  }
  return false;
}

/**
 * Constant shape for a point-mark geom: aes constant, geom param, or the plot
 * default circle. Field / after-stat / scaled-constant shape returns undefined
 * so the shape scale owns the key.
 */
function layerConstantShape(binding: LayerBinding): PointShape | undefined {
  if (!POINT_MARK_GEOMS.has(binding.layer.geom)) return undefined;
  if (
    binding.shape.field !== null ||
    binding.shape.statColumn !== null ||
    binding.shape.scaledConstant !== null
  ) {
    return undefined;
  }
  if (typeof binding.shape.constant === "string" && POINT_SHAPE_SET.has(binding.shape.constant)) {
    return binding.shape.constant as PointShape;
  }
  const params = binding.layer.params as { shape?: unknown } | undefined;
  if (typeof params?.shape === "string" && POINT_SHAPE_SET.has(params.shape)) {
    return params.shape as PointShape;
  }
  return "circle";
}

/**
 * Constant linetype for a stroke-mark geom: aes constant, or the plot
 * default solid. Field / after-stat / scaled-constant linetype returns
 * undefined so the linetype scale owns the key. LineParams has no linetype
 * property; do not read layer.params.
 */
function layerConstantLinetype(binding: LayerBinding): Linetype | undefined {
  if (!LINE_MARK_GEOMS.has(binding.layer.geom)) return undefined;
  if (
    binding.linetype.field !== null ||
    binding.linetype.statColumn !== null ||
    binding.linetype.scaledConstant !== null
  ) {
    return undefined;
  }
  if (
    typeof binding.linetype.constant === "string" &&
    LINETYPE_SET.has(binding.linetype.constant)
  ) {
    return binding.linetype.constant as Linetype;
  }
  return "solid";
}

function agreedMarkStyle<T>(
  relevant: readonly LayerBinding[],
  aesthetic: "color" | "fill",
  domain: readonly unknown[],
  constantOf: (binding: LayerBinding) => T | undefined,
): Map<string, T> {
  const byKey = new Map<string, T>();
  for (const value of domain) {
    let agreed: T | undefined;
    let seen = false;
    let conflict = false;
    for (const binding of relevant) {
      if (!layerContributesPaintValue(binding, aesthetic, value)) continue;
      const style = constantOf(binding);
      if (style === undefined) continue;
      if (!seen) {
        agreed = style;
        seen = true;
      } else if (agreed !== style) {
        conflict = true;
        break;
      }
    }
    if (!seen || conflict || agreed === undefined) continue;
    try {
      byKey.set(encodeKey(value), agreed);
    } catch {
      // Non-encodable domain values cannot key a legend entry.
    }
  }
  return byKey;
}

/**
 * Domain values whose colour keys should draw a stroke even when no
 * constant linetype agreed. Only when every contributing layer is a
 * line-family geom. A point or text layer on the same colour scale
 * suppresses the fallback. Fill-only geoms clear aes.color, so they
 * never join this set.
 */
function lineStrokeFallbackKeys(
  relevant: readonly LayerBinding[],
  aesthetic: "color" | "fill",
  domain: readonly unknown[],
): Set<string> {
  const keys = new Set<string>();
  for (const value of domain) {
    let sawLine = false;
    let sawOther = false;
    for (const binding of relevant) {
      if (!layerContributesPaintValue(binding, aesthetic, value)) continue;
      if (LINE_MARK_GEOMS.has(binding.layer.geom)) sawLine = true;
      else sawOther = true;
    }
    if (!sawLine || sawOther) continue;
    try {
      keys.add(encodeKey(value));
    } catch {
      // Non-encodable domain values cannot key a legend entry.
    }
  }
  return keys;
}

/**
 * Enrich a discrete paint legend so each domain value carries the constant
 * point shape and/or stroke pattern of the layer(s) that paint it. No-op
 * when no mark-style layer maps the aesthetic, or when styles conflict
 * and no line-only stroke fallback applies.
 */
export function enrichPaintLegendKeys(
  input: DiscreteLegendInput,
  bindings: readonly LayerBinding[],
): DiscreteLegendInput {
  if (!isPaintScale(input.scale)) return input;
  const aesthetic = input.scale;
  const relevant = bindings.filter((binding) => layerMapsPaint(binding, aesthetic));
  if (relevant.length === 0) return input;

  const shapeByKey = agreedMarkStyle(relevant, aesthetic, input.domain, layerConstantShape);
  const linetypeByKey =
    aesthetic === "color"
      ? agreedMarkStyle(relevant, aesthetic, input.domain, layerConstantLinetype)
      : new Map<string, Linetype>();
  const strokeFallback =
    aesthetic === "color"
      ? lineStrokeFallbackKeys(relevant, aesthetic, input.domain)
      : new Set<string>();
  if (shapeByKey.size === 0 && linetypeByKey.size === 0 && strokeFallback.size === 0) {
    return input;
  }

  // Capture as a free function so oxlint unbound-method does not flag the
  // method reference when we call it from the enriched keyOf.
  const previousKeyOf = (value: unknown) => input.keyOf?.(value);
  return {
    ...input,
    keyOf(value: unknown): LegendKeyStyle {
      const key: LegendKeyStyle = { ...previousKeyOf(value) };
      try {
        const encoded = encodeKey(value);
        if (key.shape === undefined) {
          const shape = shapeByKey.get(encoded);
          if (shape !== undefined) key.shape = shape;
        }
        // mergeDiscrete deletes shape when both fields exist and no shape
        // scale is merged. Skip linetype if this key already has a shape.
        // Colour-key linetype only when every contributing layer is a
        // line-family geom. Otherwise a lone line's default solid would
        // paint stroke keys on mixed text/point colour legends.
        if (key.shape === undefined && key.linetype === undefined && strokeFallback.has(encoded)) {
          key.linetype = linetypeByKey.get(encoded) ?? "solid";
        }
      } catch {
        // leave key without mark style
      }
      return key;
    },
  };
}
