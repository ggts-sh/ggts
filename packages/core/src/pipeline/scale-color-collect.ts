/**
 * Collect color/fill channel values across panel frames for scale training.
 */
import { encodeKey } from "../scales/state.js";
import type { CellValue } from "../table.js";
import type { ColumnTable } from "../table.js";

import type { LayerBinding, LayerFrame } from "./types.js";

export interface CollectedColorChannel {
  values: CellValue[];
  anyDiscreteField: boolean;
  anyField: boolean;
}

export function collectColorChannelValues(
  name: "color" | "fill",
  frames: readonly LayerFrame[],
  table: ColumnTable,
): CollectedColorChannel {
  const values: CellValue[] = [];
  let anyDiscreteField = false;
  let anyField = false;
  for (const frame of frames) {
    const channel = name === "color" ? frame.binding.color : frame.binding.fill;
    const frameValues = name === "color" ? frame.colorValues : frame.fillValues;
    // Field-mapped or after_stat color/fill (e.g. bin_2d fill = count): values
    // live on the frame. One push only — do not dual-loop statColumn rows.
    if (frameValues !== null && (channel.field !== null || (channel.statColumn ?? null) !== null)) {
      anyField = true;
      if (
        channel.field !== null &&
        table.has(channel.field) &&
        table.discreteness(channel.field) === "discrete"
      ) {
        anyDiscreteField = true;
      }
      for (const v of frameValues) values.push(v);
    }
    if (channel.scaledConstant !== null) {
      anyDiscreteField = true;
      anyField = true;
      values.push(channel.scaledConstant);
    }
  }
  return { values, anyDiscreteField, anyField };
}

/**
 * Frame-level mapping flags without materializing per-row values.
 * Ordinal training uses the source catalog; sequential still needs the full
 * values array from {@link collectColorChannelValues}.
 */
export function collectColorChannelFlags(
  name: "color" | "fill",
  frames: readonly LayerFrame[],
  table: ColumnTable,
): { anyDiscreteField: boolean; anyField: boolean } {
  let anyDiscreteField = false;
  let anyField = false;
  for (const frame of frames) {
    const channel = name === "color" ? frame.binding.color : frame.binding.fill;
    const frameValues = name === "color" ? frame.colorValues : frame.fillValues;
    if (frameValues !== null && (channel.field !== null || (channel.statColumn ?? null) !== null)) {
      anyField = true;
      if (
        channel.field !== null &&
        table.has(channel.field) &&
        table.discreteness(channel.field) === "discrete"
      ) {
        anyDiscreteField = true;
      }
    }
    if (channel.scaledConstant !== null) {
      anyDiscreteField = true;
      anyField = true;
    }
  }
  return { anyDiscreteField, anyField };
}

/** Count null cells on the mapped color/fill channel (NA-color warning). */
export function countNullColorChannelValues(
  name: "color" | "fill",
  frames: readonly LayerFrame[],
): number {
  let missing = 0;
  for (const frame of frames) {
    const channel = name === "color" ? frame.binding.color : frame.binding.fill;
    const frameValues = name === "color" ? frame.colorValues : frame.fillValues;
    if (frameValues !== null && (channel.field !== null || (channel.statColumn ?? null) !== null)) {
      for (let i = 0; i < frameValues.length; i++) {
        if (frameValues[i] === null) missing++;
      }
    }
  }
  return missing;
}

export interface CollectedColorCatalog {
  /** Distinct channel values from the unfiltered source table, in first-seen
   * order. Empty when no layer maps the channel. */
  catalogValues: CellValue[];
  anyDiscreteField: boolean;
  anyField: boolean;
}

function addCatalogValue(
  catalogValues: CellValue[],
  catalogKeys: Set<string>,
  value: CellValue,
): void {
  // Monomorphic strings (series labels): Set membership on the string
  // itself — encodeKey for plain strings is identity, but the call +
  // startsWith("@") check still costs at 30k cells.
  const key = typeof value === "string" && !value.startsWith("@") ? value : encodeKey(value);
  if (catalogKeys.has(key)) return;
  catalogKeys.add(key);
  catalogValues.push(value);
}

function addCatalogValues(
  values: readonly CellValue[],
  catalogValues: CellValue[],
  catalogKeys: Set<string>,
): void {
  // Keep the selected non-run loop self-contained so the JIT can optimize it
  // independently from the run-aware loop below.
  for (const value of values) {
    const key = typeof value === "string" && !value.startsWith("@") ? value : encodeKey(value);
    if (catalogKeys.has(key)) continue;
    catalogKeys.add(key);
    catalogValues.push(value);
  }
}

function hasDenseStringRuns(values: readonly CellValue[]): boolean {
  const sampleCount = 16;
  const minimumRunMatches = Math.ceil(sampleCount * 0.75);
  if (values.length <= sampleCount) return false;
  let runMatches = 0;
  for (let sample = 0; sample < sampleCount; sample++) {
    const index = Math.floor((sample * (values.length - 2)) / sampleCount);
    const value = values[index];
    if (typeof value === "string" && value === values[index + 1] && value === values[index + 2]) {
      runMatches++;
    }
  }
  return runMatches >= minimumRunMatches;
}

function addStringRunCatalogValues(
  values: readonly CellValue[],
  catalogValues: CellValue[],
  catalogKeys: Set<string>,
): void {
  let previousString: string | undefined;
  for (const value of values) {
    let key: string;
    if (typeof value === "string") {
      if (value === previousString) continue;
      previousString = value;
      key = value.startsWith("@") ? encodeKey(value) : value;
    } else {
      previousString = undefined;
      key = encodeKey(value);
    }
    if (catalogKeys.has(key)) continue;
    catalogKeys.add(key);
    catalogValues.push(value);
  }
}

/**
 * Collect the full source-table value catalog for a color/fill channel so
 * runtime row filters keep categorical assignments stable: the scale trains
 * on every value the source data can produce, not just the filtered rows.
 */
export function collectColorCatalogValues(
  name: "color" | "fill",
  bindings: readonly LayerBinding[],
  catalogTable: ColumnTable,
  walkCatalog = true,
): CollectedColorCatalog {
  const catalogValues: CellValue[] = [];
  const catalogKeys = new Set<string>();
  let anyDiscreteField = false;
  let anyField = false;
  for (const binding of bindings) {
    const channel = name === "color" ? binding.color : binding.fill;
    // Multi-table: each layer contributes from its own source (#589).
    const table = binding.sourceTable ?? catalogTable;
    if (channel.field !== null && table.has(channel.field)) {
      anyField = true;
      if (table.discreteness(channel.field) === "discrete") anyDiscreteField = true;
      if (walkCatalog) {
        const values = table.column(channel.field);
        // Select the run-aware loop only when evenly spaced samples show that
        // three-value string runs dominate; interleaved categories retain the
        // standard catalog loop.
        if (hasDenseStringRuns(values)) {
          addStringRunCatalogValues(values, catalogValues, catalogKeys);
        } else {
          addCatalogValues(values, catalogValues, catalogKeys);
        }
      }
    }
    if (channel.scaledConstant !== null) {
      anyDiscreteField = true;
      anyField = true;
      if (walkCatalog) addCatalogValue(catalogValues, catalogKeys, channel.scaledConstant);
    }
  }
  return { catalogValues, anyDiscreteField, anyField };
}
