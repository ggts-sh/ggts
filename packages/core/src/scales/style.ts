/** Runtime contracts and canonical tables for mapped non-color styles. */
import { LINETYPE_NAMES, POINT_SHAPE_NAMES, type StyleAesthetic } from "@ggts-sh/spec";

import type { CellValue } from "../table.js";

export type PointShape = (typeof POINT_SHAPE_NAMES)[number];
export type Linetype = (typeof LINETYPE_NAMES)[number];

/** Canvas/SVG dash arrays in CSS pixels, indexed by LINETYPE_NAMES. */
export const LINETYPE_DASHES: readonly (readonly number[])[] = Object.freeze([
  Object.freeze([]),
  Object.freeze([6, 4]),
  Object.freeze([1, 3]),
  Object.freeze([6, 3, 1, 3]),
  Object.freeze([10, 4]),
  Object.freeze([6, 3, 2, 3]),
]);

export function pointShapeIndex(shape: PointShape): number {
  return POINT_SHAPE_NAMES.indexOf(shape);
}

export function linetypeIndex(linetype: Linetype): number {
  return LINETYPE_NAMES.indexOf(linetype);
}

export type StyleOutput = number | PointShape | Linetype;

export interface StyleScale {
  readonly aesthetic: StyleAesthetic;
  readonly type: "sequential" | "ordinal" | "binned" | "manual" | "identity";
  readonly domain: readonly CellValue[] | readonly [number, number];
  readonly naValue: StyleOutput;
  readonly unknownValue: StyleOutput;
  valueOf(value: unknown): StyleOutput;
  indexOf?(value: unknown): number | undefined;
}

export interface ResolvedStyleScale {
  readonly kind: StyleScale["type"];
  readonly scale: StyleScale;
}
