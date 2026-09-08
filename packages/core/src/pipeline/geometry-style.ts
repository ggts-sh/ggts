/** Shared per-primitive style lookup over mapped/literal/scaled channels. */
import type { StyleAesthetic } from "@ggts-sh/spec";

import type { ResolvedStyleScale, StyleOutput } from "../scales/style.js";
import type { CellValue } from "../table.js";
import type { LayerBinding, LayerFrame, ResolvedColorScale } from "./types.js";
import { colorOf } from "./types.js";

export type ResolvedStyleScales = Readonly<Record<StyleAesthetic, ResolvedStyleScale | null>>;

type PaintChannel = "color" | "fill";

function paintValues(frame: LayerFrame, channel: PaintChannel): LayerFrame["colorValues"] {
  return channel === "color" ? frame.colorValues : frame.fillValues;
}

/** Probe length for unique-ratio estimation (see mapUniqueThenFanOut). */
const UNIQUE_PROBE = 512;
/**
 * If uniques in the probe exceed this fraction of probe rows, the column is
 * treated as high-cardinality and we skip the memo Map (Devin #1449).
 */
const HIGH_CARDINALITY_RATIO = 0.75;

/**
 * Map unique source values once, then fan out onto kept rows (#1423).
 * SameValueZero Map keys (number/string/boolean/null/NaN); Dates fall back
 * to per-row evaluation because object identity is not value identity.
 *
 * High-cardinality columns (most continuous measurements: nearly all-distinct
 * floats) fall back to a plain per-row loop after a short probe so we do not
 * grow an unused Map to one entry per row.
 */
function mapUniqueThenFanOut<T>(
  rows: ArrayLike<number>,
  valueAt: (row: number) => unknown,
  mapOne: (value: unknown) => T,
): T[] {
  const n = rows.length;
  const out = Array.from<T>({ length: n });
  if (n === 0) return out;
  // Fast constant path: every kept row reads the same value.
  const first = valueAt(rows[0]!);
  let allSame = true;
  for (let i = 1; i < n; i++) {
    if (!Object.is(valueAt(rows[i]!), first)) {
      allSame = false;
      break;
    }
  }
  if (allSame) {
    const mapped = mapOne(first);
    for (let i = 0; i < n; i++) out[i] = mapped;
    return out;
  }

  // Probe a prefix: if nearly every sample is unique, memoization is a pure
  // loss (failed gets + Map growth). Fall back to the direct loop.
  const probe = Math.min(n, UNIQUE_PROBE);
  const probeSeen = new Set<unknown>();
  let probeUniques = 0;
  for (let i = 0; i < probe; i++) {
    const value = valueAt(rows[i]!);
    if (typeof value === "object" && value !== null) {
      // Objects never memoize; count each as unique for the ratio.
      probeUniques++;
      continue;
    }
    if (!probeSeen.has(value)) {
      probeSeen.add(value);
      probeUniques++;
    }
  }
  if (probeUniques >= probe * HIGH_CARDINALITY_RATIO) {
    for (let i = 0; i < n; i++) out[i] = mapOne(valueAt(rows[i]!));
    return out;
  }

  const cache = new Map<unknown, T>();
  for (let i = 0; i < n; i++) {
    const value = valueAt(rows[i]!);
    // Date / object keys are reference-identity only — evaluate per row.
    if (typeof value === "object" && value !== null) {
      out[i] = mapOne(value);
      continue;
    }
    let mapped = cache.get(value);
    if (mapped === undefined && !cache.has(value)) {
      mapped = mapOne(value);
      cache.set(value, mapped);
    }
    out[i] = mapped as T;
  }
  return out;
}

/**
 * Resolve a style aesthetic once per unique source value, then fan out.
 * Uses the first kept row that carries each value so `mappedStyleOutput`
 * (constant / scaledConstant / null) stays behavior-identical.
 */
function uniqueStyleOutputs<T>(
  frame: LayerFrame,
  aesthetic: StyleAesthetic,
  rows: ArrayLike<number>,
  scales: ResolvedStyleScales,
  project: (output?: StyleOutput) => T,
): T[] {
  const binding = frame.binding[aesthetic];
  if (binding.constant !== null) {
    // Binding constants are CellValue; style aesthetics store StyleOutput.
    const projected = project(binding.constant as StyleOutput);
    return Array.from({ length: rows.length }, () => projected);
  }
  const values = styleFrameValues(frame, aesthetic);
  const resolved = scales[aesthetic];
  if (resolved === null) {
    // No scale → same as mappedStyleOutput returning undefined.
    const projected = project();
    return Array.from({ length: rows.length }, () => projected);
  }
  return mapUniqueThenFanOut(
    rows,
    (row) => (values === null ? binding.scaledConstant : values[row]),
    (value) => {
      if (value === null || value === undefined) {
        return binding.scaledConstant === null && values === null
          ? project()
          : project(resolved.scale.valueOf(null));
      }
      return project(resolved.scale.valueOf(value));
    },
  );
}

/**
 * Per-row paint when the caller has already proven the channel is mapped
 * (scale non-null and values|scaledConstant present). Feeds Points/Rects/
 * Segments `string[]` fields without null casts.
 *
 * Resolves the scale once per unique source value, then fans out (#1423).
 */
export function mappedPaintVector(
  frame: LayerFrame,
  channel: PaintChannel,
  scale: ResolvedColorScale,
  rows: ArrayLike<number>,
): string[] {
  const binding = frame.binding[channel];
  const values = paintValues(frame, channel);
  if (values === null) {
    const color = colorOf(scale, binding.scaledConstant);
    return Array.from({ length: rows.length }, () => color);
  }
  return mapUniqueThenFanOut(
    rows,
    (row) => values[row]!,
    (value) => colorOf(scale, value as CellValue),
  );
}

/** Palette + per-row indexes when cardinality fits a Uint8. Null if not. */
export interface IndexedPaint {
  readonly palette: string[];
  readonly indexes: Uint8Array;
}

const MAX_INDEXED_PALETTE = 256;

function indexUniqueThenFanOut(
  rows: ArrayLike<number>,
  valueAt: (row: number) => unknown,
  mapOne: (value: unknown) => string,
): IndexedPaint | null {
  const n = rows.length;
  if (n === 0) return { palette: [], indexes: new Uint8Array(0) };

  const first = valueAt(rows[0]!);
  let allSame = true;
  for (let i = 1; i < n; i++) {
    if (!Object.is(valueAt(rows[i]!), first)) {
      allSame = false;
      break;
    }
  }
  if (allSame) {
    return { palette: [mapOne(first)], indexes: new Uint8Array(n) };
  }

  const probe = Math.min(n, UNIQUE_PROBE);
  const probeSeen = new Set<unknown>();
  let probeUniques = 0;
  for (let i = 0; i < probe; i++) {
    const value = valueAt(rows[i]!);
    if (typeof value === "object" && value !== null) {
      probeUniques++;
      continue;
    }
    if (!probeSeen.has(value)) {
      probeSeen.add(value);
      probeUniques++;
    }
  }
  // Small columns: 3/4 uniques is still a 3-color palette. Only skip when
  // the probe is full-length and nearly every sample is distinct.
  if (n >= UNIQUE_PROBE && probeUniques >= probe * HIGH_CARDINALITY_RATIO) return null;

  const palette: string[] = [];
  const indexOf = new Map<unknown, number>();
  const indexes = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const value = valueAt(rows[i]!);
    if (typeof value === "object" && value !== null) return null;
    let id = indexOf.get(value);
    if (id === undefined && !indexOf.has(value)) {
      if (palette.length >= MAX_INDEXED_PALETTE) return null;
      id = palette.length;
      indexOf.set(value, id);
      palette.push(mapOne(value));
    }
    indexes[i] = id!;
  }
  return { palette, indexes };
}

/**
 * Same colors as {@link mappedPaintVector}, packed as palette + indexes
 * when the column is low-cardinality (categorical scatter). High-cardinality
 * continuous ramps return null so the caller keeps the string[] path.
 */
export function mappedPaintIndexVector(
  frame: LayerFrame,
  channel: PaintChannel,
  scale: ResolvedColorScale,
  rows: ArrayLike<number>,
): IndexedPaint | null {
  const binding = frame.binding[channel];
  const values = paintValues(frame, channel);
  if (values === null) {
    const color = colorOf(scale, binding.scaledConstant);
    return { palette: [color], indexes: new Uint8Array(rows.length) };
  }
  return indexUniqueThenFanOut(
    rows,
    (row) => values[row]!,
    (value) => colorOf(scale, value as CellValue),
  );
}

/**
 * Per-subpath / per-row paint vector. Honour mapped field values ·
 * scaledConstant · literal constant. `rows` is required: style vectors index
 * kept subpaths/marks, never raw frame rows.
 */
export function paintVector(
  frame: LayerFrame,
  channel: PaintChannel,
  scale: ResolvedColorScale | null,
  rows: ArrayLike<number>,
): (string | null)[] {
  const binding = frame.binding[channel];
  const values = paintValues(frame, channel);
  if (scale !== null && (values !== null || binding.scaledConstant !== null)) {
    return mappedPaintVector(frame, channel, scale, rows);
  }
  const constant = binding.constant;
  return Array.from({ length: rows.length }, () => constant);
}

/**
 * Literal alpha/linewidth: binding.constant → params[key] → fallback.
 * Fallback is explicit so site-specific defaults stay behavior-identical.
 */
export function constantStyle(
  binding: LayerBinding,
  params: { alpha?: number; linewidth?: number },
  key: "alpha" | "linewidth",
  fallback: number,
): number {
  // Optional: some emit/pack tests build partial bindings without every style key.
  const c = binding[key]?.constant;
  if (typeof c === "number") return c;
  const p = params[key];
  if (typeof p === "number") return p;
  return fallback;
}

/** Resolve a frame's per-row value column for a style aesthetic. Shared by the
 *  scale trainer (scale-style.ts) and geometry so both read the same columns. */
export function styleFrameValues(
  frame: LayerFrame,
  aesthetic: StyleAesthetic,
): LayerFrame["sizeValues"] {
  switch (aesthetic) {
    case "size":
      return frame.sizeValues;
    case "linewidth":
      return frame.linewidthValues;
    case "alpha":
      return frame.alphaValues;
    case "shape":
      return frame.shapeValues;
    case "linetype":
      return frame.linetypeValues;
    default:
      return null;
  }
}

export function mappedStyleOutput(
  frame: LayerFrame,
  aesthetic: StyleAesthetic,
  row: number,
  scales: ResolvedStyleScales,
): StyleOutput | undefined {
  const binding = frame.binding[aesthetic];
  if (binding.constant !== null) return binding.constant as StyleOutput;
  const resolved = scales[aesthetic];
  if (resolved === null) return undefined;
  const values = styleFrameValues(frame, aesthetic);
  const value = values === null ? binding.scaledConstant : values[row];
  return value === null || value === undefined
    ? binding.scaledConstant === null && values === null
      ? undefined
      : resolved.scale.valueOf(null)
    : resolved.scale.valueOf(value);
}

export function numericStyleVector(
  frame: LayerFrame,
  aesthetic: Extract<StyleAesthetic, "size" | "linewidth" | "alpha">,
  rows: ArrayLike<number>,
  scales: ResolvedStyleScales,
): Float32Array | undefined {
  const binding = frame.binding[aesthetic];
  if (
    binding === undefined ||
    (binding.field === null && binding.statColumn === null && binding.scaledConstant === null)
  ) {
    return undefined;
  }
  // Unique-value map then fan-out (#1423): size/alpha columns often cycle a
  // small domain (bench: 100 magnitudes / 100 confidences over 100k rows).
  const mapped = uniqueStyleOutputs(frame, aesthetic, rows, scales, (output) => output as number);
  const out = new Float32Array(mapped.length);
  for (let i = 0; i < mapped.length; i++) out[i] = mapped[i]!;
  return out;
}

export function indexedStyleVector(
  frame: LayerFrame,
  aesthetic: Extract<StyleAesthetic, "shape" | "linetype">,
  rows: ArrayLike<number>,
  scales: ResolvedStyleScales,
  indexOf: (value: string) => number,
): Uint8Array | undefined {
  const binding = frame.binding[aesthetic];
  if (
    binding === undefined ||
    (binding.field === null && binding.statColumn === null && binding.scaledConstant === null)
  ) {
    return undefined;
  }
  const mapped = uniqueStyleOutputs(frame, aesthetic, rows, scales, (output) =>
    indexOf(String(output)),
  );
  const out = new Uint8Array(mapped.length);
  for (let i = 0; i < mapped.length; i++) out[i] = mapped[i]!;
  return out;
}
