/**
 * Batch presentation model extracted from scene/Batch.svelte for S5.
 *
 * Owns the per-mark presentation deriveds (points / subpaths / rects /
 * segments / glyphs) plus batch-level alpha, the keyboard-focusability cap,
 * the unfocused-before-focused presentation order, and per-item opacity
 * (interaction mute). All inputs arrive as LIVE getters — never prop
 * snapshots — so template reads re-run when the host's props change.
 */
import type {
  BatchInteractionMask,
  GeometryBatch,
  PointShape,
  PointShapeGeometry,
  ThemeTokens,
} from "@ggts-sh/core";
import {
  pathData,
  pointShapeGeometry,
  resolveGlyphMark,
  resolvePathMark,
  resolvePointMark,
  resolveRectMark,
  resolveSegmentMark,
  themeVar,
} from "@ggts-sh/core";

/** Panel-local box origin for a glyph anchor + box size (geom_label).
 *  Local twin of packages/core labelBoxOrigin — keep private; no new
 *  public core export for a Svelte-scene paint parity fix. */
function labelBoxOrigin(
  x: number,
  y: number,
  width: number,
  height: number,
  anchor: "start" | "middle" | "end",
  padding: number,
): { x: number; y: number } {
  let left = x - width / 2;
  if (anchor === "start") left = x - padding;
  else if (anchor === "end") left = x - width + padding;
  return { x: left, y: y - height / 2 };
}

/** Keyboard-focus cap: point marks become focusable tooltip targets only
 *  up to this many marks per batch (a11y pass; beyond it, the canvas-style
 *  data-table strategy is the documented alternative). */
const FOCUSABLE_LIMIT = 100;

const NO_ROW = 0xffffffff;

const styleNumber = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

interface Point {
  index: number;
  x: number;
  geometry: PointShapeGeometry;
  shape: PointShape;
  fill: string;
  size: number;
  alpha: number;
  /** Source row (null for synthesized marks). */
  row: number | null;
}

interface Subpath {
  index: number;
  d: string;
  stroke: string;
  fill: string;
  linewidth: number;
  alpha: number;
  dasharray: string | undefined;
  linecap: "butt" | "round" | "square";
  linejoin: "miter" | "round" | "bevel";
  /** Even-odd for polygon holes (#809 phase 4); undefined = SVG default nonzero. */
  fillRule: "nonzero" | "evenodd" | undefined;
}

interface Rect {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  /** Outline color when stroke is set; undefined = no outline. */
  stroke: string | undefined;
  strokeWidth: number;
  alpha: number;
  dasharray: string | undefined;
}

interface Segment {
  index: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  d?: string;
  stroke: string;
  linewidth: number;
  alpha: number;
  dasharray: string | undefined;
  /** Present only when the batch opts in (segment geom); omitted for rule. */
  linecap?: "butt" | "round" | "square";
}

interface Glyph {
  index: number;
  x: number;
  y: number;
  text: string;
  fill: string;
  size: number;
  alpha: number;
  /** Present only for geom_label / sf_label visual chrome. */
  box:
    | {
        x: number;
        y: number;
        width: number;
        height: number;
        fill: string;
        stroke: string;
        strokeWidth: number;
        radius: number;
      }
    | undefined;
}

interface Presented<T extends { index: number }> {
  item: T;
  focused: boolean;
}

export type BatchPresentationDeps = {
  batch: () => GeometryBatch;
  theme: () => ThemeTokens;
  focusMask: () => BatchInteractionMask | null;
  focusable: () => boolean;
};

export type BatchPresentation = {
  readonly points: Point[];
  readonly subpaths: Subpath[];
  readonly rects: Rect[];
  readonly segments: Segment[];
  readonly glyphs: Glyph[];
  /** Batch-level opacity; undefined = SVG default (1). */
  readonly alpha: number | undefined;
  readonly pointsFocusable: boolean;
  /** Unfocused marks paint before focused ones (z-order within the batch). */
  presentationOrder<T extends { index: number }>(items: T[]): Presented<T>[];
  /** Interaction mute for one mark; undefined = SVG default (1). */
  itemOpacity(mapped: number, focused: boolean): number | undefined;
};

export function createBatchPresentation(deps: BatchPresentationDeps): BatchPresentation {
  const batch = $derived(deps.batch());
  const theme = $derived(deps.theme());
  const focusMask = $derived(deps.focusMask());
  const focusable = $derived(deps.focusable());

  const pointsFocusable = $derived(
    focusable && batch.kind === "points" && batch.rowIndex.length <= FOCUSABLE_LIMIT,
  );

  const ink = $derived(themeVar("ink", theme));
  const accent = $derived(themeVar("accent", theme));

  const points: Point[] = $derived.by(() => {
    if (batch.kind !== "points") return [];
    return Array.from({ length: batch.rowIndex.length }, (_, j) => {
      const style = resolvePointMark(batch, j, ink);
      const size = styleNumber(style.size);
      const x = batch.positions[j * 2]!;
      const y = batch.positions[j * 2 + 1]!;
      return {
        index: j,
        x,
        y,
        fill: style.fill,
        size,
        alpha: styleNumber(style.alpha),
        shape: style.shape,
        // Rebuild geometry with display-rounded size so path `d` matches prior SSR.
        geometry: pointShapeGeometry(style.shape, x, y, size),
        row: batch.rowIndex[j] === NO_ROW ? null : batch.rowIndex[j]!,
      };
    });
  });

  const subpaths: Subpath[] = $derived.by(() => {
    if (batch.kind !== "paths") return [];
    const out: Subpath[] = [];
    const themeColors = { ink, accent };
    for (let s = 0; s < batch.pathOffsets.length - 1; s++) {
      const d = pathData(
        batch.positions,
        batch.pathOffsets[s]!,
        batch.pathOffsets[s + 1]!,
        batch.curve,
        batch.closed === true,
        batch.ringStarts,
      );
      if (d === "") continue;
      const style = resolvePathMark(batch, s, themeColors);
      out.push({
        index: s,
        d,
        stroke: style.stroke,
        fill: style.fill,
        linewidth: styleNumber(style.width),
        alpha: styleNumber(style.alpha),
        dasharray: style.dash.length === 0 ? undefined : style.dash.join(" "),
        linecap: style.linecap,
        linejoin: style.linejoin,
        fillRule: batch.fillRule,
      });
    }
    return out;
  });

  const rects: Rect[] = $derived.by(() => {
    if (batch.kind !== "rects") return [];
    const themeColors = { accent, paper: themeVar("paper", theme), ink };
    return Array.from({ length: batch.rects.length / 4 }, (_, j) => {
      const style = resolveRectMark(batch, j, themeColors);
      return {
        index: j,
        x: batch.rects[j * 4]!,
        y: batch.rects[j * 4 + 1]!,
        width: batch.rects[j * 4 + 2]!,
        height: batch.rects[j * 4 + 3]!,
        fill: style.fill,
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        alpha: styleNumber(style.alpha),
        dasharray: style.dash.length === 0 ? undefined : style.dash.join(" "),
      };
    });
  });

  const segments: Segment[] = $derived.by(() => {
    if (batch.kind !== "segments") return [];
    return Array.from({ length: batch.segments.length / 4 }, (_, j) => {
      const mark = resolveSegmentMark(batch, j, ink);
      return {
        index: j,
        x1: batch.segments[j * 4]!,
        y1: batch.segments[j * 4 + 1]!,
        x2: batch.segments[j * 4 + 2]!,
        y2: batch.segments[j * 4 + 3]!,
        ...(batch.renderPositions !== undefined &&
          batch.renderPathOffsets !== undefined && {
            d: pathData(
              batch.renderPositions,
              batch.renderPathOffsets[j]!,
              batch.renderPathOffsets[j + 1]!,
              "linear",
            ),
          }),
        stroke: mark.stroke,
        linewidth: styleNumber(mark.width),
        alpha: styleNumber(mark.alpha),
        // Conditional: only set when the batch opts in (rule batches leave undefined).
        ...(mark.linecap !== undefined && { linecap: mark.linecap }),
        dasharray: mark.dash.length === 0 ? undefined : mark.dash.join(" "),
      };
    });
  });

  const glyphs: Glyph[] = $derived.by(() => {
    if (batch.kind !== "glyphs") return [];
    // Measured extents alone do not paint a box (geom_text measures for
    // inspect hover/hit). Visual chrome is geom_label / sf_label only —
    // parity with packages/core render-svg-marks renderGlyphs.
    const hasBox =
      batch.boxWidths !== undefined &&
      batch.boxHeights !== undefined &&
      (batch.boxRadius !== undefined ||
        batch.boxFill !== undefined ||
        batch.boxFills !== undefined ||
        batch.boxStroke !== undefined ||
        batch.boxStrokes !== undefined);
    const paper = themeVar("paper", theme);
    return batch.texts.map((text, j) => {
      const mark = resolveGlyphMark(batch, j, ink);
      const x = batch.positions[j * 2]!;
      const y = batch.positions[j * 2 + 1]!;
      let box: Glyph["box"];
      if (hasBox) {
        const width = batch.boxWidths![j]!;
        const height = batch.boxHeights![j]!;
        const pad = batch.boxPadding ?? 0;
        const origin = labelBoxOrigin(x, y, width, height, batch.anchor, pad);
        box = {
          x: styleNumber(origin.x),
          y: styleNumber(origin.y),
          width: styleNumber(width),
          height: styleNumber(height),
          fill: batch.boxFills?.[j] ?? batch.boxFill ?? paper,
          stroke: batch.boxStrokes?.[j] ?? batch.boxStroke ?? ink,
          strokeWidth: styleNumber(batch.boxStrokeWidth ?? 0.5),
          radius: styleNumber(batch.boxRadius ?? 0),
        };
      }
      return {
        index: j,
        x,
        y,
        text,
        fill: mark.fill,
        size: styleNumber(mark.size),
        alpha: styleNumber(mark.alpha),
        box,
      };
    });
  });

  const alpha = $derived(batch.alpha === 1 ? undefined : batch.alpha);

  function presentationOrder<T extends { index: number }>(items: T[]): Presented<T>[] {
    if (focusMask === null) return items.map((item) => ({ item, focused: true }));
    const presented = items.map((item) => ({
      item,
      focused: focusMask.isFocused(item.index),
    }));
    return [
      ...presented.filter((item) => !item.focused),
      ...presented.filter((item) => item.focused),
    ];
  }

  function itemOpacity(mapped: number, focused: boolean): number | undefined {
    const opacity = focusMask === null || focused ? mapped : mapped * theme.interactionMuted;
    return opacity === 1 ? undefined : opacity;
  }

  return {
    get points() {
      return points;
    },
    get subpaths() {
      return subpaths;
    },
    get rects() {
      return rects;
    },
    get segments() {
      return segments;
    },
    get glyphs() {
      return glyphs;
    },
    get alpha() {
      return alpha;
    },
    get pointsFocusable() {
      return pointsFocusable;
    },
    presentationOrder,
    itemOpacity,
  };
}
