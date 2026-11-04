/**
 * Positional patching of path-mark batch groups (lines/areas) for the
 * live-update path (#1471). The written attrs must match the renderPaths
 * emitter attribute-for-attribute (see ../render-svg-marks.ts); a false
 * return is always safe, a wrong patch never is.
 */
import { resolvePathMark } from "../mark-style.js";
import type { PathsBatch } from "../scene.js";
import { themeVar } from "../theme.js";
import { paintFill, paintStroke, pathData } from "../render-svg-marks.js";
import { px } from "../render-svg-format.js";
import { writeAttrs, writeAlpha, writeOrRemove, type AttrMap } from "./patch-attrs.js";
import type { BatchPatchContext } from "./patch-attrs.js";

/** Attributes of one path subpath, mirroring renderPaths exactly. */
function pathAttrs(
  batch: PathsBatch,
  s: number,
  themeColors: { ink: string; accent: string },
  ctx: BatchPatchContext,
): AttrMap | null {
  const start = batch.pathOffsets[s]!;
  const end = batch.pathOffsets[s + 1]!;
  if (end <= start) return null; // emitter skips; signature excludes this case
  const d = pathData(
    batch.positions,
    start,
    end,
    batch.curve,
    batch.closed === true,
    batch.ringStarts,
  );
  if (d === "") return null;
  const style = resolvePathMark(batch, s, themeColors);
  const alpha = batch.alphas?.[s];
  const attrs: AttrMap = { d };
  if (batch.fills === undefined) {
    attrs["fill"] = "none";
    attrs["stroke"] = paintStroke(
      style.stroke === "none" ? themeColors.ink : style.stroke,
      batch.strokePaint,
      ctx.paintMode,

      ctx.idScope,
    );
    attrs["stroke-width"] = px(style.width);
    if (style.dash.length > 0) attrs["stroke-dasharray"] = dashStr(style.dash);
    attrs["stroke-linejoin"] = style.linejoin;
    attrs["stroke-linecap"] = style.linecap;
  } else {
    attrs["fill"] = paintFill(
      style.fill === "none" ? themeColors.accent : style.fill,
      batch.fillPaint,
      ctx.paintMode,

      ctx.idScope,
    );
    if (style.stroke === "none") {
      attrs["stroke"] = "none";
    } else {
      attrs["stroke"] = paintStroke(style.stroke, batch.strokePaint, ctx.paintMode, ctx.idScope);
      attrs["stroke-width"] = px(style.width);
      if (style.dash.length > 0) attrs["stroke-dasharray"] = dashStr(style.dash);
      attrs["stroke-linejoin"] = style.linejoin;
      attrs["stroke-linecap"] = style.linecap;
    }
    if (batch.fillRule !== undefined) attrs["fill-rule"] = batch.fillRule;
  }
  if (alpha !== undefined && alpha !== 1) attrs["opacity"] = px(alpha);
  return attrs;
}

/** Path style branch: 0 = area stroke-none, 1 = area stroked, 2 = line. */
function pathBranch(batch: PathsBatch, stroke: string): number {
  return batch.fills === undefined ? 2 : stroke === "none" ? 0 : 1;
}

/** stroke-dasharray value, absent ("") when the dash list is empty. */
function dashStr(dash: readonly number[]): string {
  return dash.length === 0 ? "" : dash.join(" ");
}

function sameRingStarts(prev: Uint32Array | undefined, next: Uint32Array | undefined): boolean {
  if (prev === undefined || next === undefined) return prev === next;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < next.length; i++) if (prev[i] !== next[i]) return false;
  return true;
}

function samePathGeometry(
  prev: PathsBatch,
  next: PathsBatch,
  s: number,
  start: number,
  end: number,
): boolean {
  const prevStart = prev.pathOffsets[s]!;
  const prevEnd = prev.pathOffsets[s + 1]!;
  const length = end - start;
  if (length !== prevEnd - prevStart) return false;
  if (prev.curve !== next.curve || (prev.closed === true) !== (next.closed === true)) return false;
  if (!sameRingStarts(prev.ringStarts, next.ringStarts)) return false;
  for (let i = 0; i < length * 2; i++) {
    if (prev.positions[prevStart * 2 + i] !== next.positions[start * 2 + i]) return false;
  }
  return true;
}

type PathStyle = ReturnType<typeof resolvePathMark>;

function writePathStyle(
  el: Element,
  prev: PathsBatch,
  next: PathsBatch,
  styleP: PathStyle,
  styleN: PathStyle,
  branch: number,
  themeColors: { ink: string; accent: string },
  ctx: BatchPatchContext,
): void {
  const w = writeOrRemove;
  if (branch === 0) {
    w(
      el,
      "fill",
      paintFill(
        styleN.fill === "none" ? themeColors.accent : styleN.fill,
        next.fillPaint,
        ctx.paintMode,

        ctx.idScope,
      ),
      paintFill(
        styleP.fill === "none" ? themeColors.accent : styleP.fill,
        prev.fillPaint,
        ctx.paintMode,

        ctx.idScope,
      ),
    );
    return;
  }
  w(
    el,
    "stroke",
    paintStroke(
      branch === 2 && styleN.stroke === "none" ? themeColors.ink : styleN.stroke,
      next.strokePaint,
      ctx.paintMode,

      ctx.idScope,
    ),
    paintStroke(
      branch === 2 && styleP.stroke === "none" ? themeColors.ink : styleP.stroke,
      prev.strokePaint,
      ctx.paintMode,

      ctx.idScope,
    ),
  );
  if (styleN.width !== styleP.width) el.setAttribute("stroke-width", px(styleN.width));
  w(el, "stroke-dasharray", dashStr(styleN.dash), dashStr(styleP.dash));
  w(el, "stroke-linejoin", styleN.linejoin, styleP.linejoin);
  w(el, "stroke-linecap", styleN.linecap, styleP.linecap);
  if (branch === 1) {
    w(
      el,
      "fill",
      paintFill(
        styleN.fill === "none" ? themeColors.accent : styleN.fill,
        next.fillPaint,
        ctx.paintMode,

        ctx.idScope,
      ),
      paintFill(
        styleP.fill === "none" ? themeColors.accent : styleP.fill,
        prev.fillPaint,
        ctx.paintMode,

        ctx.idScope,
      ),
    );
  }
}

function patchPath(
  el: Element,
  prev: PathsBatch,
  next: PathsBatch,
  s: number,
  start: number,
  end: number,
  themeColors: { ink: string; accent: string },
  ctx: BatchPatchContext,
): boolean {
  const styleN = resolvePathMark(next, s, themeColors);
  const styleP = resolvePathMark(prev, s, themeColors);
  const branch = pathBranch(next, styleN.stroke);
  if (branch !== pathBranch(prev, styleP.stroke)) {
    const nextAttrs = pathAttrs(next, s, themeColors, ctx);
    const prevAttrs = pathAttrs(prev, s, themeColors, ctx);
    if (nextAttrs === null || prevAttrs === null) return false;
    writeAttrs(el, nextAttrs, prevAttrs);
    return true;
  }
  if (!samePathGeometry(prev, next, s, start, end)) {
    const d = pathData(
      next.positions,
      start,
      end,
      next.curve,
      next.closed === true,
      next.ringStarts,
    );
    if (d === "") return false;
    el.setAttribute("d", d);
  }
  writePathStyle(el, prev, next, styleP, styleN, branch, themeColors, ctx);
  writeOrRemove(el, "fill-rule", next.fillRule ?? "", prev.fillRule ?? "");
  const alphaN = next.alphas?.[s] ?? 1;
  if (alphaN !== (prev.alphas?.[s] ?? 1)) writeAlpha(el, alphaN);
  return true;
}

/**
 * Hot path for dense line/area updates: the `d` rebuild is skipped when the
 * span's vertices are bit-identical between scenes (raw Float32 compares —
 * no string formatting for unchanged paths), and style channels compare as
 * resolved scalars. The expensive pathData format runs only for spans that
 * actually moved. A stroke-presence branch change (data-driven stroke
 * toggling "none") falls back to the exact attribute-map diff.
 */
export function patchPaths(
  group: SVGGElement,
  prev: PathsBatch,
  next: PathsBatch,
  ctx: BatchPatchContext,
): boolean {
  const themeColors = { ink: themeVar("ink", ctx.theme), accent: themeVar("accent", ctx.theme) };
  const kids = group.children;
  const subpaths = next.pathOffsets.length - 1;
  // Signature equality guarantees the non-empty span sequence aligns 1:1.
  let k = 0;
  for (let s = 0; s < subpaths; s++) {
    const start = next.pathOffsets[s]!;
    const end = next.pathOffsets[s + 1]!;
    if (end <= start) continue;
    const el = kids[k]!;
    k++;
    if (el === undefined || el.tagName !== "path") return false;
    if (!patchPath(el, prev, next, s, start, end, themeColors, ctx)) return false;
  }
  return k === kids.length;
}
