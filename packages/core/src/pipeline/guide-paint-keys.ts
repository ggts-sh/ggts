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

// Undefined has no contribution. Null records disagreement between contributors.
type Agreement<T> = T | null | undefined;
type Contribution = {
  shape?: Agreement<PointShape>;
  linetype?: Agreement<Linetype>;
  markKinds: number;
};

function combine<T>(left: Agreement<T>, right: Agreement<T>): Agreement<T> {
  if (left === undefined) return right;
  return right === undefined || left === right ? left : null;
}

function collectPaintContributions(bindings: readonly LayerBinding[], aesthetic: "color" | "fill") {
  const broad: Contribution = { markKinds: 0 };
  const byConstant = new Map<string, Contribution>();
  for (const binding of bindings) {
    const paint = binding[aesthetic];
    let target = broad;
    if (paint.scaledConstant !== null) {
      let key: string;
      try {
        key = encodeKey(paint.scaledConstant);
      } catch {
        continue;
      }
      target = byConstant.get(key) ?? { markKinds: 0 };
      byConstant.set(key, target);
    } else if (paint.field === null && (paint.statColumn ?? null) === null) {
      continue;
    }
    target.shape = combine(target.shape, layerConstantShape(binding));
    if (aesthetic === "color") {
      target.linetype = combine(target.linetype, layerConstantLinetype(binding));
      // Bit 1 is line-family, bit 2 is any other contributing geom.
      target.markKinds |= LINE_MARK_GEOMS.has(binding.layer.geom) ? 1 : 2;
    }
  }
  return { broad, byConstant };
}

/** Resolve paint key styles by aggregating shared and typed constant contributions. */
export function enrichPaintLegendKeys(
  input: DiscreteLegendInput,
  bindings: readonly LayerBinding[],
): DiscreteLegendInput {
  const aesthetic = input.scale;
  if (!isPaintScale(aesthetic)) return input;
  const { broad, byConstant } = collectPaintContributions(bindings, aesthetic);
  if (byConstant.size === 0 && !broad.shape && !broad.linetype && broad.markKinds !== 1)
    return input;

  const styles = new Map<
    string,
    {
      shape: Agreement<PointShape>;
      linetype: Linetype | undefined;
    }
  >();
  for (const value of input.domain) {
    let key: string;
    try {
      key = encodeKey(value);
    } catch {
      continue;
    }
    const constant = byConstant.get(key);
    const shape = combine(broad.shape, constant?.shape);
    const linetype = combine(broad.linetype, constant?.linetype);
    const stroke = (broad.markKinds | (constant?.markKinds ?? 0)) === 1;
    // An agreed linetype still installs the wrapper for mixed geoms even when
    // the key gets no stroke style.
    if (shape || linetype || stroke) {
      styles.set(key, { shape, linetype: stroke ? (linetype ?? "solid") : undefined });
    }
  }
  if (styles.size === 0) return input;

  return {
    ...input,
    keyOf(value: unknown): LegendKeyStyle {
      const key: LegendKeyStyle = { ...input.keyOf?.(value) };
      try {
        const style = styles.get(encodeKey(value));
        if (key.shape === undefined && style?.shape) key.shape = style.shape;
        // Preserve supplied marks and keep line strokes off shaped paint keys.
        if (key.shape === undefined && key.linetype === undefined && style?.linetype) {
          key.linetype = style.linetype;
        }
      } catch {
        // Non-encodable values keep the supplied key style.
      }
      return key;
    },
  };
}
