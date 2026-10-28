/// <reference lib="dom" />
/**
 * Canvas segment drawers with run-length stroke batching.
 * strokePaint/glow follow the paths batch contract (#1112).
 *
 * Mark-space gradients use per-segment bounds so canvas matches SVG
 * objectBoundingBox mapping (one gradient box per <line>/<path>).
 */
import { subpathBounds, type ResolvedGradientPaint } from "../mark-paint.js";
import { resolveSegmentMark, segmentStrokeAt } from "../mark-style.js";
import type { SegmentsBatch } from "../scene.js";
import type { ThemeTokens } from "../theme-construct.js";
import { themeVar } from "../theme-resolve.js";
import type { ColorResolver } from "./canvas-dom.js";
import { applyDash, applyGlow, resolvePaintStyle } from "./canvas-marks-paths.js";

function traceSegment(ctx: CanvasRenderingContext2D, batch: SegmentsBatch, j: number): void {
  if (batch.renderPositions !== undefined && batch.renderPathOffsets !== undefined) {
    const start = batch.renderPathOffsets[j]!;
    const end = batch.renderPathOffsets[j + 1]!;
    if (end <= start) return;
    ctx.moveTo(batch.renderPositions[start * 2]!, batch.renderPositions[start * 2 + 1]!);
    for (let vertex = start + 1; vertex < end; vertex++) {
      ctx.lineTo(batch.renderPositions[vertex * 2]!, batch.renderPositions[vertex * 2 + 1]!);
    }
    return;
  }
  const o = j * 4;
  ctx.moveTo(batch.segments[o]!, batch.segments[o + 1]!);
  ctx.lineTo(batch.segments[o + 2]!, batch.segments[o + 3]!);
}

function segmentBounds(
  batch: SegmentsBatch,
  j: number,
): { x: number; y: number; width: number; height: number } {
  if (batch.renderPositions !== undefined && batch.renderPathOffsets !== undefined) {
    return subpathBounds(
      batch.renderPositions,
      batch.renderPathOffsets[j]!,
      batch.renderPathOffsets[j + 1]!,
    );
  }
  const o = j * 4;
  const x1 = batch.segments[o]!;
  const y1 = batch.segments[o + 1]!;
  const x2 = batch.segments[o + 2]!;
  const y2 = batch.segments[o + 3]!;
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  return {
    x: minX,
    y: minY,
    width: Math.max(Math.abs(x2 - x1), 1e-6),
    height: Math.max(Math.abs(y2 - y1), 1e-6),
  };
}

function finishSegments(
  ctx: CanvasRenderingContext2D,
  restoreGlow: () => void,
  previousLineCap: CanvasLineCap,
): void {
  applyDash(ctx, "solid");
  restoreGlow();
  ctx.lineCap = previousLineCap;
}

function drawMappedSegments(
  ctx: CanvasRenderingContext2D,
  batch: SegmentsBatch,
  themeInk: string,
  resolve: ColorResolver,
  includes: ((index: number) => boolean) | undefined,
): void {
  const baseAlpha = ctx.globalAlpha;
  for (let j = 0; j < batch.segments.length / 4; j++) {
    if (includes !== undefined && !includes(j)) continue;
    const mark = resolveSegmentMark(batch, j, themeInk);
    ctx.strokeStyle = resolvePaintStyle(
      ctx,
      mark.stroke,
      batch.strokePaint,
      segmentBounds(batch, j),
      resolve,
    );
    ctx.lineWidth = mark.width;
    ctx.globalAlpha = baseAlpha * mark.alpha;
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([...mark.dash]);
    ctx.beginPath();
    traceSegment(ctx, batch, j);
    ctx.stroke();
  }
  ctx.globalAlpha = baseAlpha;
}

function panelStrokeStyle(
  ctx: CanvasRenderingContext2D,
  color: string,
  paint: ResolvedGradientPaint | undefined,
  resolve: ColorResolver,
): string | CanvasGradient {
  return paint === undefined
    ? resolve(color)
    : resolvePaintStyle(ctx, color, paint, { x: 0, y: 0, width: 1, height: 1 }, resolve);
}

function drawMonoSegments(
  ctx: CanvasRenderingContext2D,
  batch: SegmentsBatch,
  themeInk: string,
  resolve: ColorResolver,
  includes: ((index: number) => boolean) | undefined,
): void {
  ctx.strokeStyle = panelStrokeStyle(
    ctx,
    segmentStrokeAt(batch, 0, themeInk),
    batch.strokePaint,
    resolve,
  );
  ctx.beginPath();
  let traced = false;
  for (let j = 0; j < batch.segments.length / 4; j++) {
    if (includes !== undefined && !includes(j)) continue;
    traceSegment(ctx, batch, j);
    traced = true;
  }
  if (traced) ctx.stroke();
}

function drawSegmentRuns(
  ctx: CanvasRenderingContext2D,
  batch: SegmentsBatch,
  themeInk: string,
  resolve: ColorResolver,
  includes: ((index: number) => boolean) | undefined,
): void {
  const n = batch.segments.length / 4;
  let runStart = 0;
  while (runStart < n) {
    if (includes !== undefined && !includes(runStart)) {
      runStart++;
      continue;
    }
    const color = segmentStrokeAt(batch, runStart, themeInk);
    let runEnd = runStart + 1;
    while (runEnd < n && segmentStrokeAt(batch, runEnd, themeInk) === color) runEnd++;
    ctx.strokeStyle = panelStrokeStyle(ctx, color, batch.strokePaint, resolve);
    ctx.beginPath();
    let traced = false;
    for (let j = runStart; j < runEnd; j++) {
      if (includes !== undefined && !includes(j)) continue;
      traceSegment(ctx, batch, j);
      traced = true;
    }
    if (traced) ctx.stroke();
    runStart = runEnd;
  }
}

/**
 * Draw segments with Θ(runs) stroke() calls: mono batches (no per-segment
 * `strokes`) are one path; per-segment colors collapse contiguous same-color
 * runs. Optional `includes` skips primitives for focus-mask subset passes.
 *
 * Mark-space strokePaint forces per-segment strokes so each segment gets the
 * same objectBoundingBox gradient mapping as SVG.
 */
export function drawSegments(
  ctx: CanvasRenderingContext2D,
  batch: SegmentsBatch,
  theme: ThemeTokens,
  resolve: ColorResolver,
  includes?: (index: number) => boolean,
): void {
  const themeInk = resolve(themeVar("ink", theme));
  ctx.lineWidth = batch.linewidth;
  // Save/restore lineCap so a segment batch with lineend does not leak into
  // later rule/errorbar segment batches that leave linecap undefined.
  const previousLineCap = ctx.lineCap;
  if (batch.linecap !== undefined) ctx.lineCap = batch.linecap;
  applyDash(ctx, batch.linetype ?? "solid");
  const n = batch.segments.length / 4;
  if (n === 0) {
    ctx.lineCap = previousLineCap;
    return;
  }

  const restoreGlow = applyGlow(ctx, batch.glow);
  const paint = batch.strokePaint;
  // Mark-space gradients need per-segment bounds (SVG objectBoundingBox parity).
  // Panel-space ignores bounds, so the batched solid/panel path stays valid.
  const perSegmentPaint = paint !== undefined && paint.space === "mark";

  const mappedStyle =
    batch.linewidths !== undefined ||
    batch.alphas !== undefined ||
    batch.linetypeIndexes !== undefined;
  if (mappedStyle || perSegmentPaint) {
    drawMappedSegments(ctx, batch, themeInk, resolve, includes);
    finishSegments(ctx, restoreGlow, previousLineCap);
    return;
  }

  // Solid mono path, or panel-space paint (bounds unused for panel mapping).
  if (batch.strokes === undefined) {
    drawMonoSegments(ctx, batch, themeInk, resolve, includes);
    finishSegments(ctx, restoreGlow, previousLineCap);
    return;
  }
  drawSegmentRuns(ctx, batch, themeInk, resolve, includes);
  finishSegments(ctx, restoreGlow, previousLineCap);
}
