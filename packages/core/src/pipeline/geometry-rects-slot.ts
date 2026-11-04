/**
 * Resolve bar/col rect center/width and y-bounds in normalized [0,1] space.
 */
import type { BandScale, ContinuousScale } from "../scales/train.js";

import type { LayerFrame } from "./types.js";
import type { Frame } from "./geometry-shared.js";

type RectSlotInput = {
  frame: LayerFrame;
  fx: Frame;
  row: number;
  binned: boolean;
  widthFrac: number;
};

type RectSlot = { center: number; w: number; t0: number; t1: number };

function resolveBandRectSlot(
  input: RectSlotInput,
  xScale: BandScale,
  t0: number,
  t1: number,
): RectSlot | null {
  const { frame, row, binned, widthFrac } = input;
  if (binned) return null;
  const tc = xScale.normalize(frame.xValues?.[row] ?? null);
  if (tc === undefined || Number.isNaN(tc) || Number.isNaN(t0) || Number.isNaN(t1)) return null;
  let center = tc;
  let w = widthFrac;
  if (frame.dodge !== null) {
    const slotCount = Math.max(1, frame.dodge.slotCounts[row]!);
    const full = w;
    w = full / slotCount;
    center += full * ((frame.dodge.slot[row]! + 0.5) / slotCount - 0.5);
  }
  return { center, w, t0, t1 };
}

function binnedRectEdges(frame: LayerFrame, row: number): [number, number] | null {
  if (frame.xmin !== null && frame.xmax !== null) {
    return [frame.xmin[row]!, frame.xmax[row]!];
  }
  // A binned position scale snaps identity/count rows to a transformed center.
  // Prefer the stable integer bin id; float lookup is the defensive fallback.
  const boundaries = frame.binding.xBinning;
  const transformedCenter = frame.xNumeric?.[row];
  if (boundaries === undefined || transformedCenter === undefined) return null;
  const xBinId = frame.bin?.xId ?? null;
  const index =
    xBinId === null
      ? boundaries.centers.findIndex((value) => Object.is(value, transformedCenter))
      : xBinId[row]!;
  if (index < 0) return null;
  return [boundaries.edges[index]!, boundaries.edges[index + 1]!];
}

function resolveContinuousRectSlot(
  input: RectSlotInput,
  xScale: ContinuousScale,
  t0: number,
  t1: number,
): RectSlot | null {
  const { frame, row, binned, widthFrac } = input;
  let sourceLeft: number;
  let sourceRight: number;
  if (binned) {
    const edges = binnedRectEdges(frame, row);
    if (edges === null) return null;
    [sourceLeft, sourceRight] = edges;
    if (widthFrac !== 0) {
      const midpoint = (sourceLeft + sourceRight) / 2;
      const half = ((sourceRight - sourceLeft) * widthFrac) / 2;
      sourceLeft = midpoint - half;
      sourceRight = midpoint + half;
    }
  } else {
    const transformedCenter = frame.xNumeric?.[row];
    if (transformedCenter === undefined) return null;
    const scaleSpan = xScale.transformedDomain[1] - xScale.transformedDomain[0];
    const half = (widthFrac * scaleSpan) / 2;
    sourceLeft = transformedCenter - half;
    sourceRight = transformedCenter + half;
  }
  // Dodge in scale space, then project both final edges independently.
  if (frame.dodge !== null) {
    const slotCount = Math.max(1, frame.dodge.slotCounts[row]!);
    const slot = frame.dodge.slot[row]!;
    const full = sourceRight - sourceLeft;
    sourceRight = sourceLeft + (full * (slot + 1)) / slotCount;
    sourceLeft += (full * slot) / slotCount;
  }
  const tx0 = xScale.normalizeTransformed(sourceLeft);
  const tx1 = xScale.normalizeTransformed(sourceRight);
  if (Number.isNaN(tx0) || Number.isNaN(tx1) || Number.isNaN(t0) || Number.isNaN(t1)) return null;
  return { center: (tx0 + tx1) / 2, w: Math.abs(tx1 - tx0), t0, t1 };
}

/**
 * Clamp a projected bound to the panel's unit span. Rects are axis-aligned, so
 * clamping IS panel clipping — no shape change, just the visible extent.
 * Bar/col edges are synthesized at a zero baseline, which an author-pinned
 * domain may exclude; unclamped, that baseline projects far outside the panel
 * and the rect overflows it (#1897). NaN passes through untouched so callers
 * keep their drop-the-row behavior.
 */
function clampUnit(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function resolveRectSlot(input: RectSlotInput): RectSlot | null {
  const { frame, fx, row } = input;
  // Frame bounds are already transformed; do not apply the forward transform twice.
  const t0 =
    fx.yScale.type === "band" ? NaN : clampUnit(fx.yScale.normalizeTransformed(frame.ymin![row]!));
  const t1 =
    fx.yScale.type === "band" ? NaN : clampUnit(fx.yScale.normalizeTransformed(frame.ymax![row]!));
  return fx.xScale.type === "band"
    ? resolveBandRectSlot(input, fx.xScale, t0, t1)
    : resolveContinuousRectSlot(input, fx.xScale, t0, t1);
}
