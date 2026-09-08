export type PlotRect = {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
};

export type PanelBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** Convert viewport `PlotRect` bounds into the xywh shape keyboard/clamp callers use. */
export function panelBoundsFrom(rect: PlotRect): PanelBounds {
  return {
    x: rect.x0,
    y: rect.y0,
    width: rect.x1 - rect.x0,
    height: rect.y1 - rect.y0,
  };
}

/** Continuous zoom domain bag used by brush-to-zoom commit paths. */
export type ContinuousZoomDomains = {
  x?: [number, number];
  y?: [number, number];
};

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function frozenZoomDomains(domains: ContinuousZoomDomains): ContinuousZoomDomains {
  return Object.freeze({
    ...(domains.x !== undefined && {
      x: Object.freeze([...domains.x]) as unknown as [number, number],
    }),
    ...(domains.y !== undefined && {
      y: Object.freeze([...domains.y]) as unknown as [number, number],
    }),
  });
}

export function normalizedRect(r: PlotRect): PlotRect {
  return {
    x0: Math.min(r.x0, r.x1),
    y0: Math.min(r.y0, r.y1),
    x1: Math.max(r.x0, r.x1),
    y1: Math.max(r.y0, r.y1),
  };
}

/**
 * CSS-px radius of the inspection hover ring (`.gg-hover-ring`).
 * Keep in sync with InteractionOverlay.
 */
export const HOVER_RING_RADIUS = 6;

/**
 * Half-width of the empty focus hole around the inspected anchor.
 * Must clear the hover ring (r=6) plus ring stroke (1.5) so guides never
 * paint through the focused mark under the halo.
 */
export const HOVER_CROSSHAIR_GAP_RADIUS = 8;

/**
 * Fallback glyph highlight size when measured box extents are unavailable.
 * Wide enough to read a short label; measured extents replace this at runtime.
 */
const DEFAULT_GLYPH_HOVER_BOX = Object.freeze({ width: 48, height: 16 });

export type GlyphHoverBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * Axis-aligned highlight box for a glyph at `anchor`, using measured batch
 * extents when present. Anchor semantics match GlyphsBatch (middle/start/end).
 */
export function glyphHoverBox(
  anchor: { readonly x: number; readonly y: number },
  extents: {
    readonly width?: number | undefined;
    readonly height?: number | undefined;
    readonly textAnchor?: "start" | "middle" | "end" | undefined;
  } = {},
): GlyphHoverBox {
  const width =
    extents.width !== undefined && extents.width > 0
      ? extents.width
      : DEFAULT_GLYPH_HOVER_BOX.width;
  const height =
    extents.height !== undefined && extents.height > 0
      ? extents.height
      : DEFAULT_GLYPH_HOVER_BOX.height;
  const textAnchor = extents.textAnchor ?? "middle";
  let x = anchor.x - width / 2;
  if (textAnchor === "start") x = anchor.x;
  else if (textAnchor === "end") x = anchor.x - width;
  return { x, y: anchor.y - height / 2, width, height };
}

/** Gap radius that clears a rectangular glyph box (half diagonal + stroke pad). */
export function crosshairGapForBox(width: number, height: number): number {
  return Math.hypot(width / 2, height / 2) + 2;
}

/** Minimal batch surface for glyph highlight extents (Scene GeometryBatch). */
export type GlyphExtentBatch = {
  readonly kind: string;
  readonly boxWidths?: ArrayLike<number> | undefined;
  readonly boxHeights?: ArrayLike<number> | undefined;
  readonly anchor?: "start" | "middle" | "end" | undefined;
};

/**
 * Read measured glyph box extents from a scene batch when the seed points at
 * a glyphs primitive. Returns null for non-glyph batches or missing extents.
 */
export function glyphExtentsFromBatch(
  batch: GlyphExtentBatch | null | undefined,
  primitiveIndex: number,
): {
  readonly width: number;
  readonly height: number;
  readonly textAnchor: "start" | "middle" | "end";
} | null {
  if (batch === null || batch === undefined || batch.kind !== "glyphs") return null;
  const width = batch.boxWidths?.[primitiveIndex];
  const height = batch.boxHeights?.[primitiveIndex];
  if (width === undefined || height === undefined || !(width > 0) || !(height > 0)) {
    return null;
  }
  return {
    width,
    height,
    textAnchor: batch.anchor ?? "middle",
  };
}

export type CrosshairSegment = {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
};

/** Axis-aligned box in plot px (same space as focus anchors / glyphHoverBox). */
export type CrosshairGapBox = GlyphHoverBox;

/**
 * Extra pad when cutting a guide through a glyph AABB so stroke does not
 * kiss the label edge. Kept separate from measured boxWidths (which already
 * include geom_label boxPadding).
 */
export const CROSSHAIR_BOX_GAP_PAD = 2;

type GapInterval = { lo: number; hi: number };

function mergeGapIntervals(intervals: GapInterval[]): GapInterval[] {
  if (intervals.length === 0) return [];
  const sorted = intervals.toSorted((a, b) => a.lo - b.lo);
  const out: GapInterval[] = [{ lo: sorted[0]!.lo, hi: sorted[0]!.hi }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out.at(-1)!;
    if (cur.lo <= last.hi) {
      last.hi = Math.max(last.hi, cur.hi);
    } else {
      out.push({ lo: cur.lo, hi: cur.hi });
    }
  }
  return out;
}

/**
 * Solid segments along [rangeLo, rangeHi] with holes at each merged gap.
 * Uses strict endpoints (gap starts exactly at rangeLo drop the leading piece)
 * to match the historical `gapTop > panel.y` comparison.
 */
function segmentsAroundGaps(
  rangeLo: number,
  rangeHi: number,
  gaps: readonly GapInterval[],
  project: (a: number, b: number) => CrosshairSegment,
): CrosshairSegment[] {
  if (!(rangeHi > rangeLo)) return [];
  const clamped: GapInterval[] = [];
  for (const gap of gaps) {
    const lo = Math.max(gap.lo, rangeLo);
    const hi = Math.min(gap.hi, rangeHi);
    if (hi > lo) clamped.push({ lo, hi });
  }
  const merged = mergeGapIntervals(clamped);
  if (merged.length === 0) return [project(rangeLo, rangeHi)];

  const segments: CrosshairSegment[] = [];
  let cursor = rangeLo;
  for (const gap of merged) {
    if (gap.lo > cursor) {
      segments.push(project(cursor, gap.lo));
    }
    cursor = Math.max(cursor, gap.hi);
  }
  if (cursor < rangeHi) {
    segments.push(project(cursor, rangeHi));
  }
  return segments;
}

/**
 * Panel-spanning axis guide with a circular focus gap and rectangular holes
 * for any obstacle boxes the guide line intersects (sibling GeomText labels).
 * `gapRadius <= 0` still applies box obstacles (rect hover chrome path).
 * Empty obstacles degrades to the focus-only path.
 */
export function gappedCrosshairSegmentsWithObstacles(
  axis: "vertical" | "horizontal",
  focus: { readonly x: number; readonly y: number },
  panel: PanelBounds,
  gapRadius: number,
  obstacles: readonly CrosshairGapBox[],
): readonly CrosshairSegment[] {
  const panelBottom = panel.y + panel.height;
  const panelRight = panel.x + panel.width;
  const pad = CROSSHAIR_BOX_GAP_PAD;
  const gaps: GapInterval[] = [];

  if (gapRadius > 0) {
    if (axis === "vertical") {
      gaps.push({ lo: focus.y - gapRadius, hi: focus.y + gapRadius });
    } else {
      gaps.push({ lo: focus.x - gapRadius, hi: focus.x + gapRadius });
    }
  }

  for (const box of obstacles) {
    const bx0 = box.x - pad;
    const by0 = box.y - pad;
    const bx1 = box.x + box.width + pad;
    const by1 = box.y + box.height + pad;
    if (axis === "vertical") {
      if (focus.x >= bx0 && focus.x <= bx1) {
        gaps.push({ lo: by0, hi: by1 });
      }
    } else if (focus.y >= by0 && focus.y <= by1) {
      gaps.push({ lo: bx0, hi: bx1 });
    }
  }

  if (axis === "vertical") {
    return segmentsAroundGaps(panel.y, panelBottom, gaps, (y1, y2) => ({
      x1: focus.x,
      y1,
      x2: focus.x,
      y2,
    }));
  }
  return segmentsAroundGaps(panel.x, panelRight, gaps, (x1, x2) => ({
    x1,
    y1: focus.y,
    x2,
    y2: focus.y,
  }));
}

/**
 * Panel-spanning axis guide broken into segments that leave a circular gap
 * around the focus anchor. `gapRadius <= 0` yields one continuous segment
 * (rect hover chrome with no ring).
 */
export function gappedCrosshairSegments(
  axis: "vertical" | "horizontal",
  focus: { readonly x: number; readonly y: number },
  panel: PanelBounds,
  gapRadius: number,
): readonly CrosshairSegment[] {
  return gappedCrosshairSegmentsWithObstacles(axis, focus, panel, gapRadius, []);
}

/**
 * Minimal batch surface for crosshair obstacle collection.
 * Structural (not core Scene types) so geometry stays free of @ggsvelte/core.
 * Wide enough to accept GeometryBatch[] (rects may carry a different `anchor`
 * vocabulary — only `kind === "glyphs"` is read).
 * Walk scene batches, not the candidate store: uninspectable layers (#1065)
 * still paint and still need gaps even when they never become targets.
 */
export type GlyphObstacleBatch = {
  readonly kind: string;
  readonly panelIndex: number;
  /** Interleaved panel-local x,y (dx/dy already applied). Present on glyphs. */
  readonly positions?: ArrayLike<number>;
  readonly boxWidths?: ArrayLike<number>;
  readonly boxHeights?: ArrayLike<number>;
  /** Glyph text-anchor; other batch kinds may use different vocabularies. */
  readonly anchor?: string;
};

/** Minimal panel surface: id + plot origin (matches scene.panels[i]). */
export type GlyphObstaclePanel = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
};

function glyphTextAnchor(anchor: string | undefined): "start" | "middle" | "end" | undefined {
  if (anchor === "start" || anchor === "middle" || anchor === "end") return anchor;
  return undefined;
}

/**
 * Plot-space glyph AABBs for every measured text/label in `panelId`.
 * Positions are panel-local; add panel origin so boxes share coordinates with
 * `inspection.focus.anchor` / viewport panel bounds (viewport is built from
 * the same scene panels).
 */
export function crosshairGlyphObstacles(
  batches: readonly GlyphObstacleBatch[],
  panels: readonly GlyphObstaclePanel[],
  panelId: string,
): CrosshairGapBox[] {
  const boxes: CrosshairGapBox[] = [];
  for (const batch of batches) {
    if (batch.kind !== "glyphs") continue;
    const positions = batch.positions;
    if (positions === undefined) continue;
    const panel = panels[batch.panelIndex];
    if (panel === undefined || panel.id !== panelId) continue;
    const textAnchor = glyphTextAnchor(batch.anchor);
    const count = Math.floor(positions.length / 2);
    for (let i = 0; i < count; i++) {
      const extents = glyphExtentsFromBatch(
        {
          kind: batch.kind,
          boxWidths: batch.boxWidths,
          boxHeights: batch.boxHeights,
          anchor: textAnchor,
        },
        i,
      );
      if (extents === null) continue;
      const lx = positions[2 * i];
      const ly = positions[2 * i + 1];
      if (lx === undefined || ly === undefined) continue;
      boxes.push(
        glyphHoverBox(
          { x: panel.x + lx, y: panel.y + ly },
          {
            width: extents.width,
            height: extents.height,
            textAnchor: extents.textAnchor,
          },
        ),
      );
    }
  }
  return boxes;
}
