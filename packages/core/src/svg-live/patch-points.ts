/**
 * Positional patching of point-mark batch groups for the live-update path
 * (#1471). The written attrs must match the renderPoints/pointShape emitters
 * attribute-for-attribute (see ../render-svg-marks.ts); a false return is
 * always safe, a wrong patch never is.
 */
import {
  pointFillAt,
  pointShapeGeometry,
  pointShapePathD,
  type PointShapeGeometry,
} from "../mark-style.js";
import type { PointsBatch } from "../scene.js";
import type { PointShape } from "../scales/style.js";
import { themeVar } from "../theme.js";
import { POINT_SHAPE_NAMES } from "@ggts-sh/spec";
import { px } from "../render-svg-format.js";
import { writeAttrs, writeAlpha } from "./patch-attrs.js";
import type { BatchPatchContext } from "./patch-attrs.js";
import type { AttrMap } from "./patch-attrs.js";

/** Per-mark shape: constant, or the shapeIndexes entry when aes.shape is mapped. */
function shapeAt(batch: PointsBatch, j: number): PointShape {
  return batch.shapeIndexes === undefined
    ? batch.shape
    : POINT_SHAPE_NAMES[batch.shapeIndexes[j]!]!;
}

/** Attributes of one point mark, mirroring renderPoints/pointShape exactly. */
function pointAttrs(
  batch: PointsBatch,
  j: number,
  themeInk: string,
): { tag: string; attrs: AttrMap } | null {
  const shape = shapeAt(batch, j);
  const size = batch.sizes?.[j] ?? batch.size;
  const x = batch.positions[j * 2]!;
  const y = batch.positions[j * 2 + 1]!;
  const geometry = pointShapeGeometry(shape, x, y, size);
  const fill = pointFillAt(batch, j, themeInk);
  const alphaRaw = batch.alphas?.[j] ?? 1;
  const attrs: AttrMap = { class: `gg-shape-${shape}` };
  let tag: string;
  switch (geometry.kind) {
    case "circle":
      tag = "circle";
      attrs["cx"] = px(geometry.cx);
      attrs["cy"] = px(geometry.cy);
      attrs["r"] = px(geometry.r);
      if (geometry.mode === "stroke") {
        attrs["fill"] = "none";
        attrs["stroke"] = fill;
        attrs["stroke-width"] = px(geometry.strokeWidth);
      } else {
        attrs["fill"] = fill;
      }
      break;
    case "rect":
      tag = "rect";
      attrs["x"] = px(geometry.x);
      attrs["y"] = px(geometry.y);
      attrs["width"] = px(geometry.width);
      attrs["height"] = px(geometry.height);
      attrs["fill"] = fill;
      break;
    case "polygon":
      tag = "path";
      attrs["d"] = pointShapePathD(geometry, px);
      attrs["fill"] = fill;
      break;
    case "lines":
      tag = "path";
      attrs["d"] = pointShapePathD(geometry, px);
      attrs["fill"] = "none";
      attrs["stroke"] = fill;
      attrs["stroke-width"] = px(geometry.strokeWidth);
      break;
    default:
      return null;
  }
  // alphaAttr omission rule: absent iff the raw alpha is exactly 1; a value
  // that merely rounds to "1" is still emitted by the string renderer.
  if (batch.alphas !== undefined && alphaRaw !== 1) attrs["opacity"] = px(alphaRaw);
  return { tag, attrs };
}

/**
 * Write the fill-carrying attr(s) of a point mark. Which attribute carries
 * the color depends on the shape's geometry kind (stroke-mode circle and
 * lines-kind shapes paint via stroke, everything else via fill); the other
 * channel is the constant "none" and never needs a write.
 */
function writePointFill(el: Element, geometry: PointShapeGeometry, fill: string): void {
  const stroked =
    (geometry.kind === "circle" && geometry.mode === "stroke") || geometry.kind === "lines";
  el.setAttribute(stroked ? "stroke" : "fill", fill);
}

/** Element-wise equality for optional string lists (palettes). */
function sameStringList(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function canCompareColorIndexes(
  prev: PointsBatch,
  next: PointsBatch,
  paletteSame: boolean,
): boolean {
  return paletteSame && prev.colorIndexes !== undefined && next.colorIndexes !== undefined;
}

function canPatchIndexedCircles(prev: PointsBatch, next: PointsBatch, indexed: boolean): boolean {
  return (
    indexed &&
    prev.shape === "circle" &&
    next.shape === "circle" &&
    prev.shapeIndexes === undefined &&
    next.shapeIndexes === undefined &&
    prev.sizes === undefined &&
    next.sizes === undefined &&
    prev.size === next.size
  );
}

function patchIndexedCircles(
  kids: HTMLCollection,
  prev: PointsBatch,
  next: PointsBatch,
  themeInk: string,
): boolean {
  const palette = next.colorPalette!;
  for (let j = 0; j < next.rowIndex.length; j++) {
    const el = kids[j]!;
    if (el.tagName !== "circle") return false;
    const x = next.positions[j * 2]!;
    const y = next.positions[j * 2 + 1]!;
    if (x !== prev.positions[j * 2]) el.setAttribute("cx", px(x));
    if (y !== prev.positions[j * 2 + 1]) el.setAttribute("cy", px(y));
    const colorIndex = next.colorIndexes![j]!;
    let fillChanged = colorIndex !== prev.colorIndexes![j]! || palette[colorIndex] === undefined;
    if (fillChanged && palette[colorIndex] === undefined && prev.colorIndexes![j] === colorIndex) {
      fillChanged = pointFillAt(next, j, themeInk) !== pointFillAt(prev, j, themeInk);
    }
    if (fillChanged) el.setAttribute("fill", pointFillAt(next, j, themeInk));
    const alpha = next.alphas?.[j] ?? 1;
    if (alpha !== (prev.alphas?.[j] ?? 1)) writeAlpha(el, alpha);
  }
  return true;
}

function pointFillChanged(
  prev: PointsBatch,
  next: PointsBatch,
  j: number,
  themeInk: string,
  indexedCompare: boolean,
): boolean {
  if (!indexedCompare) return pointFillAt(next, j, themeInk) !== pointFillAt(prev, j, themeInk);
  const colorIndex = next.colorIndexes![j]!;
  const changed =
    colorIndex !== prev.colorIndexes![j]! || next.colorPalette![colorIndex] === undefined;
  if (
    changed &&
    next.colorPalette![colorIndex] === undefined &&
    prev.colorIndexes![j] === colorIndex
  ) {
    return pointFillAt(next, j, themeInk) !== pointFillAt(prev, j, themeInk);
  }
  return changed;
}

type RectGeometry = Extract<PointShapeGeometry, { kind: "rect" }>;
type PolygonGeometry = Extract<PointShapeGeometry, { kind: "polygon" }>;
type LinesGeometry = Extract<PointShapeGeometry, { kind: "lines" }>;

function patchRect(
  el: Element,
  geometry: RectGeometry,
  xChanged: boolean,
  yChanged: boolean,
  sizeChanged: boolean,
  fillChanged: boolean,
  fill: string,
): boolean {
  if (el.tagName !== "rect") return false;
  if (xChanged || sizeChanged) {
    el.setAttribute("x", px(geometry.x));
    el.setAttribute("width", px(geometry.width));
  }
  if (yChanged || sizeChanged) {
    el.setAttribute("y", px(geometry.y));
    el.setAttribute("height", px(geometry.height));
  }
  if (fillChanged) el.setAttribute("fill", fill);
  return true;
}

function patchPolygon(
  el: Element,
  geometry: PolygonGeometry,
  fillChanged: boolean,
  fill: string,
): boolean {
  if (el.tagName !== "path") return false;
  el.setAttribute("d", pointShapePathD(geometry, px));
  if (fillChanged) el.setAttribute("fill", fill);
  return true;
}

function patchLines(
  el: Element,
  geometry: LinesGeometry,
  fillChanged: boolean,
  fill: string,
): boolean {
  if (el.tagName !== "path") return false;
  el.setAttribute("d", pointShapePathD(geometry, px));
  el.setAttribute("stroke-width", px(geometry.strokeWidth));
  if (fillChanged) el.setAttribute("stroke", fill);
  return true;
}

function patchPointGeometry(
  el: Element,
  geometry: PointShapeGeometry,
  xChanged: boolean,
  yChanged: boolean,
  sizeChanged: boolean,
  fillChanged: boolean,
  fill: string,
): boolean {
  switch (geometry.kind) {
    case "circle": {
      if (el.tagName !== "circle") return false;
      if (xChanged) el.setAttribute("cx", px(geometry.cx));
      if (yChanged) el.setAttribute("cy", px(geometry.cy));
      if (sizeChanged) {
        el.setAttribute("r", px(geometry.r));
        if (geometry.mode === "stroke") {
          el.setAttribute("stroke-width", px(geometry.strokeWidth));
        }
      }
      if (fillChanged) el.setAttribute(geometry.mode === "stroke" ? "stroke" : "fill", fill);
      return true;
    }
    case "rect":
      return patchRect(el, geometry, xChanged, yChanged, sizeChanged, fillChanged, fill);
    case "polygon":
      return patchPolygon(el, geometry, fillChanged, fill);
    case "lines":
      return patchLines(el, geometry, fillChanged, fill);
  }
  return false;
}

function patchChangedShape(
  el: Element,
  prev: PointsBatch,
  next: PointsBatch,
  j: number,
  themeInk: string,
): boolean {
  const nextMark = pointAttrs(next, j, themeInk);
  const prevMark = pointAttrs(prev, j, themeInk);
  if (nextMark === null || prevMark === null || el.tagName !== nextMark.tag) return false;
  writeAttrs(el, nextMark.attrs, prevMark.attrs);
  return true;
}

function writeStablePoint(
  el: Element,
  shape: PointShape,
  x: number,
  y: number,
  size: number,
  fillChanged: boolean,
  fill: string,
  alphaChanged: boolean,
  alpha: number,
): void {
  if (fillChanged) writePointFill(el, pointShapeGeometry(shape, x, y, size), fill);
  if (alphaChanged) writeAlpha(el, alpha);
}

/**
 * Hot path for the 10k+ scatter case: compare RAW batch values (positions,
 * sizes, fill strings, alphas) before any px() formatting, so unchanged
 * channels skip both the format and the setAttribute. Per-mark shape changes
 * (rare; only when aes.shape is data-mapped) fall back to the exact
 * attribute-map diff, which also covers tag/mode changes.
 */
export function patchPoints(
  group: SVGGElement,
  prev: PointsBatch,
  next: PointsBatch,
  ctx: BatchPatchContext,
): boolean {
  const themeInk = themeVar("ink", ctx.theme);
  const kids = group.children;
  const n = next.rowIndex.length;
  if (kids.length !== n) return false;
  // Batch-level fill facts: when both batches index the same palette, a
  // point's fill can only move when its index does — a numeric compare that
  // skips two string resolutions per point. Anything else (palette churn,
  // mixed colors/palette paths, fill scalar moves) compares resolved strings.
  const paletteSame = sameStringList(prev.colorPalette, next.colorPalette);
  const indexedCompare = canCompareColorIndexes(prev, next, paletteSame);
  if (canPatchIndexedCircles(prev, next, indexedCompare)) {
    return patchIndexedCircles(kids, prev, next, themeInk);
  }
  for (let j = 0; j < n; j++) {
    const el = kids[j]!;
    const shape = shapeAt(next, j);
    if (shape !== shapeAt(prev, j)) {
      if (!patchChangedShape(el, prev, next, j, themeInk)) return false;
      continue;
    }
    const x = next.positions[j * 2]!;
    const y = next.positions[j * 2 + 1]!;
    const size = next.sizes?.[j] ?? next.size;
    const xChanged = x !== prev.positions[j * 2]!;
    const yChanged = y !== prev.positions[j * 2 + 1]!;
    const sizeChanged = size !== (prev.sizes?.[j] ?? prev.size);
    const fillChanged = pointFillChanged(prev, next, j, themeInk, indexedCompare);
    const fill = fillChanged ? pointFillAt(next, j, themeInk) : "";
    const alpha = next.alphas?.[j] ?? 1;
    const alphaChanged = alpha !== (prev.alphas?.[j] ?? 1);
    if (!xChanged && !yChanged && !sizeChanged) {
      writeStablePoint(el, shape, x, y, size, fillChanged, fill, alphaChanged, alpha);
      continue;
    }
    const geometry = pointShapeGeometry(shape, x, y, size);
    if (!patchPointGeometry(el, geometry, xChanged, yChanged, sizeChanged, fillChanged, fill)) {
      return false;
    }
    if (alphaChanged) writeAlpha(el, alpha);
  }
  return true;
}
