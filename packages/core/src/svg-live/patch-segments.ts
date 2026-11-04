/**
 * Positional patching of segment-mark batch groups for the live-update path
 * (#1471). The written attrs must match the renderSegments emitter
 * attribute-for-attribute (see ../render-svg-marks.ts); a false return is
 * always safe, a wrong patch never is.
 */
import { resolveSegmentMark } from "../mark-style.js";
import type { SegmentsBatch } from "../scene.js";
import { themeVar } from "../theme.js";
import { paintStroke, pathData } from "../render-svg-marks.js";
import { px } from "../render-svg-format.js";
import { writeAttrs, type AttrMap } from "./patch-attrs.js";
import type { BatchPatchContext } from "./patch-attrs.js";

/** Attributes of one segment mark, mirroring renderSegments exactly. */
function segmentAttrs(
  batch: SegmentsBatch,
  j: number,
  themeInk: string,
  ctx: BatchPatchContext,
): AttrMap {
  const mark = resolveSegmentMark(batch, j, themeInk);
  const stroke = paintStroke(mark.stroke, batch.strokePaint, ctx.paintMode, ctx.idScope);
  const attrs: AttrMap = {};
  if (batch.renderPositions !== undefined && batch.renderPathOffsets !== undefined) {
    attrs["d"] = pathData(
      batch.renderPositions,
      batch.renderPathOffsets[j]!,
      batch.renderPathOffsets[j + 1]!,
      "linear",
    );
    attrs["fill"] = "none";
  } else {
    attrs["x1"] = px(batch.segments[j * 4]!);
    attrs["y1"] = px(batch.segments[j * 4 + 1]!);
    attrs["x2"] = px(batch.segments[j * 4 + 2]!);
    attrs["y2"] = px(batch.segments[j * 4 + 3]!);
  }
  attrs["stroke"] = stroke;
  attrs["stroke-width"] = px(mark.width);
  if (mark.dash.length > 0) attrs["stroke-dasharray"] = mark.dash.join(" ");
  if (batch.alphas !== undefined && mark.alpha !== 1) attrs["opacity"] = px(mark.alpha);
  if (mark.linecap !== undefined) attrs["stroke-linecap"] = mark.linecap;
  return attrs;
}

export function patchSegments(
  group: SVGGElement,
  prev: SegmentsBatch,
  next: SegmentsBatch,
  ctx: BatchPatchContext,
): boolean {
  const themeInk = themeVar("ink", ctx.theme);
  const kids = group.children;
  const n = next.rowIndex.length;
  if (kids.length !== n) return false;
  const asPath = next.renderPositions !== undefined && next.renderPathOffsets !== undefined;
  const tag = asPath ? "path" : "line";
  for (let j = 0; j < n; j++) {
    const el = kids[j]!;
    if (el.tagName !== tag) return false;
    writeAttrs(el, segmentAttrs(next, j, themeInk, ctx), segmentAttrs(prev, j, themeInk, ctx));
  }
  return true;
}
