/// <reference lib="dom" />
/**
 * Canvas path (and path-subset) drawers.
 */
import { canvasGradientStyle, subpathBounds, type ResolvedGradientPaint } from "../mark-paint.js";
import { areaOutlineActive, linetypeDash, markLinetype, resolvePathMark } from "../mark-style.js";
import type { PathsBatch, RectsBatch, SegmentsBatch } from "../scene.js";
import type { Linetype } from "../scales/style.js";
import type { ThemeTokens } from "../theme-construct.js";
import { themeVar } from "../theme-resolve.js";
import { stepCorners } from "../path-step.js";
import { ringCuts } from "../ring-cuts.js";
import type { ColorResolver } from "./canvas-dom.js";
import { maskIncludes, type PrimitiveFocusMask } from "./canvas-marks-mask.js";

export function resolvePaintStyle(
  ctx: CanvasRenderingContext2D,
  solid: string,
  paint: ResolvedGradientPaint | undefined,
  bounds: { x: number; y: number; width: number; height: number },
  resolve: ColorResolver,
): string | CanvasGradient {
  if (paint === undefined) return resolve(solid);
  return canvasGradientStyle(ctx, paint, bounds);
}

export function applyGlow(ctx: CanvasRenderingContext2D, glow: PathsBatch["glow"]): () => void {
  if (glow === undefined) return () => {};
  const prevShadowColor = ctx.shadowColor;
  const prevShadowBlur = ctx.shadowBlur;
  ctx.shadowColor = glow.color;
  ctx.shadowBlur = glow.radius;
  // shadowOpacity is not a standard property; bake via rgba on shadowColor when possible.
  if (glow.opacity < 1) {
    const hex = glow.color;
    const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
    const r = Number.parseInt(full.slice(1, 3), 16);
    const g = Number.parseInt(full.slice(3, 5), 16);
    const b = Number.parseInt(full.slice(5, 7), 16);
    ctx.shadowColor = `rgba(${String(r)},${String(g)},${String(b)},${String(glow.opacity)})`;
  }
  return () => {
    ctx.shadowColor = prevShadowColor;
    ctx.shadowBlur = prevShadowBlur;
  };
}

function traceRing(
  ctx: CanvasRenderingContext2D,
  batch: PathsBatch,
  start: number,
  end: number,
): void {
  if (end <= start) return;
  ctx.moveTo(batch.positions[start * 2]!, batch.positions[start * 2 + 1]!);
  for (let i = start + 1; i < end; i++) {
    const x = batch.positions[i * 2]!;
    const y = batch.positions[i * 2 + 1]!;
    if (batch.curve === "step" || batch.curve === "step-hv" || batch.curve === "step-vh") {
      const prevX = batch.positions[(i - 1) * 2]!;
      const prevY = batch.positions[(i - 1) * 2 + 1]!;
      for (const c of stepCorners(prevX, prevY, x, y, batch.curve)) {
        ctx.lineTo(c.x, c.y);
      }
    }
    ctx.lineTo(x, y);
  }
  if (batch.closed === true) ctx.closePath();
}

/** Trace one subpath; hole rings (ringStarts) become extra moveTo/closePath rings. */
function traceSubpath(
  ctx: CanvasRenderingContext2D,
  batch: PathsBatch,
  start: number,
  end: number,
): void {
  if (end <= start) return;
  const breaks = batch.ringStarts;
  if (breaks === undefined || breaks.length === 0 || batch.closed !== true) {
    traceRing(ctx, batch, start, end);
    return;
  }
  const cuts = ringCuts(breaks, start, end);
  for (let i = 0; i + 1 < cuts.length; i++) {
    traceRing(ctx, batch, cuts[i]!, cuts[i + 1]!);
  }
}

function linetypeAt(batch: PathsBatch | SegmentsBatch | RectsBatch, index: number): Linetype {
  return markLinetype(batch, index);
}

function applyDash(ctx: CanvasRenderingContext2D, linetype: Linetype): void {
  if (typeof ctx.setLineDash !== "function") return;
  ctx.setLineDash([...linetypeDash(linetype)]);
}

function strokePath(
  ctx: CanvasRenderingContext2D,
  batch: PathsBatch,
  s: number,
  stroke: string,
  resolve: ColorResolver,
): void {
  ctx.strokeStyle = resolve(stroke);
  ctx.lineWidth = batch.linewidths?.[s] ?? batch.linewidth;
  applyDash(ctx, linetypeAt(batch, s));
  ctx.lineJoin = batch.linejoin ?? "round";
  ctx.lineCap = batch.linecap ?? "round";
  ctx.stroke();
}

function isSolidLineHot(batch: PathsBatch, isArea: boolean, needBounds: boolean): boolean {
  return (
    !isArea &&
    !needBounds &&
    batch.glow === undefined &&
    batch.alphas === undefined &&
    batch.linewidths === undefined &&
    batch.linetypeIndexes === undefined &&
    (batch.linetype === undefined || batch.linetype === "solid") &&
    batch.curve === "linear"
  );
}

function drawSolidLines(
  ctx: CanvasRenderingContext2D,
  batch: PathsBatch,
  ink: string,
  resolve: ColorResolver,
): void {
  ctx.lineWidth = batch.linewidth;
  ctx.lineJoin = batch.linejoin ?? "round";
  ctx.lineCap = batch.linecap ?? "round";
  if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
  for (let s = 0; s + 1 < batch.pathOffsets.length; s++) {
    const start = batch.pathOffsets[s]!;
    const end = batch.pathOffsets[s + 1]!;
    if (end <= start) continue;
    ctx.strokeStyle = resolve(batch.strokes[s] ?? batch.strokePaint?.fallback ?? ink);
    ctx.beginPath();
    ctx.moveTo(batch.positions[start * 2]!, batch.positions[start * 2 + 1]!);
    for (let i = start + 1; i < end; i++) {
      ctx.lineTo(batch.positions[i * 2]!, batch.positions[i * 2 + 1]!);
    }
    ctx.stroke();
  }
}

function drawResolvedPath(
  ctx: CanvasRenderingContext2D,
  batch: PathsBatch,
  s: number,
  start: number,
  end: number,
  baseAlpha: number,
  isArea: boolean,
  needBounds: boolean,
  themeColors: { ink: string; accent: string },
  resolve: ColorResolver,
): void {
  const bounds = needBounds ? subpathBounds(batch.positions, start, end) : null;
  const style = resolvePathMark(batch, s, themeColors);
  ctx.beginPath();
  traceSubpath(ctx, batch, start, end);
  ctx.globalAlpha = baseAlpha * style.alpha;
  if (isArea) {
    const solid = style.fill === "none" ? themeColors.accent : style.fill;
    ctx.fillStyle =
      bounds === null
        ? resolve(solid)
        : resolvePaintStyle(ctx, solid, batch.fillPaint, bounds, resolve);
    if (batch.fillRule === "evenodd") ctx.fill("evenodd");
    else ctx.fill();
    if (style.stroke === "none") return;
  }
  const solid = style.stroke === "none" ? themeColors.ink : style.stroke;
  ctx.strokeStyle =
    bounds === null
      ? resolve(solid)
      : resolvePaintStyle(ctx, solid, batch.strokePaint, bounds, resolve);
  ctx.lineWidth = style.width;
  if (typeof ctx.setLineDash === "function") ctx.setLineDash([...style.dash]);
  ctx.lineJoin = style.linejoin;
  ctx.lineCap = style.linecap;
  ctx.stroke();
}

export function drawPaths(
  ctx: CanvasRenderingContext2D,
  batch: PathsBatch,
  theme: ThemeTokens,
  resolve: ColorResolver,
): void {
  const isArea = batch.fills !== undefined;
  const subpaths = batch.pathOffsets.length - 1;
  const baseAlpha = ctx.globalAlpha;
  const restoreGlow = applyGlow(ctx, batch.glow);
  const themeColors = { ink: themeVar("ink", theme), accent: themeVar("accent", theme) };
  const needBounds = batch.fillPaint !== undefined || batch.strokePaint !== undefined;

  // Solid multi-series lines (competitive line-3×N): no fills, no per-subpath
  // alpha/linewidth/linetype, no gradient paint — one monomorphic stroke loop
  // without resolvePathMark allocations or setLineDash per subpath (#1468).
  if (isSolidLineHot(batch, isArea, needBounds)) {
    drawSolidLines(ctx, batch, themeColors.ink, resolve);
    restoreGlow();
    ctx.globalAlpha = baseAlpha;
    return;
  }

  for (let s = 0; s < subpaths; s++) {
    const start = batch.pathOffsets[s]!;
    const end = batch.pathOffsets[s + 1]!;
    if (end <= start) continue;
    drawResolvedPath(
      ctx,
      batch,
      s,
      start,
      end,
      baseAlpha,
      isArea,
      needBounds,
      themeColors,
      resolve,
    );
  }
  restoreGlow();
  ctx.globalAlpha = baseAlpha;
  applyDash(ctx, "solid");
}

export function drawPathsSubset(
  ctx: CanvasRenderingContext2D,
  batch: PathsBatch,
  theme: ThemeTokens,
  resolve: ColorResolver,
  mask: PrimitiveFocusMask,
  focused: boolean,
): void {
  const isArea = batch.fills !== undefined;
  const subpaths = batch.pathOffsets.length - 1;
  const baseAlpha = ctx.globalAlpha;
  for (let s = 0; s < subpaths; s++) {
    if (maskIncludes(mask, s) !== focused) continue;
    const start = batch.pathOffsets[s]!;
    const end = batch.pathOffsets[s + 1]!;
    if (end <= start) continue;
    ctx.beginPath();
    traceSubpath(ctx, batch, start, end);
    ctx.globalAlpha = baseAlpha * (batch.alphas?.[s] ?? 1);
    if (isArea) {
      ctx.fillStyle = resolve(batch.fills![s] ?? themeVar("accent", theme));
      if (batch.fillRule === "evenodd") ctx.fill("evenodd");
      else ctx.fill();
      const strokeColor = batch.strokes[s];
      const linewidth = batch.linewidths?.[s] ?? batch.linewidth;
      if (areaOutlineActive(strokeColor, linewidth)) {
        strokePath(ctx, batch, s, strokeColor, resolve);
      }
    } else {
      strokePath(ctx, batch, s, batch.strokes[s] ?? themeVar("ink", theme), resolve);
    }
  }
  ctx.globalAlpha = baseAlpha;
  applyDash(ctx, "solid");
}

export { applyDash };
