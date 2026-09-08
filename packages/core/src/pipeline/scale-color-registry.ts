/**
 * Color scale kind → resolver registry.
 *
 * `scale-color.ts` dispatches through this map so unused kinds (sequential,
 * binned, manual, identity) stay out of lean graphs that only register
 * ordinal. `@ggts-sh/core/render` and `registerBasic()` still register every
 * kind.
 */
import type { ColorScaleSpec } from "@ggts-sh/spec";

import type { EditionDefaults } from "../editions.js";
import type { ScaleState } from "../scales/state.js";
import type { CellValue } from "../table.js";

import type { ColorResolution } from "./scale-color-types.js";
import type { Advisory, PipelineWarning } from "./types.js";

export type ColorScaleKind = "ordinal" | "sequential" | "binned" | "manual" | "identity";

export interface ColorScaleResolveInput {
  name: "color" | "fill";
  values: readonly CellValue[];
  catalogValues: readonly CellValue[];
  anyDiscreteField: boolean;
  config: ColorScaleSpec | undefined;
  prevState: ScaleState | null;
  legendTitle: string;
  warnings: PipelineWarning[];
  advisories: Advisory[];
  editionDefaults: EditionDefaults;
}

export type ColorScaleResolver = (input: ColorScaleResolveInput) => ColorResolution;

const resolvers = new Map<ColorScaleKind, ColorScaleResolver>();

export function registerColorScaleResolver(
  kind: ColorScaleKind,
  resolve: ColorScaleResolver,
): void {
  resolvers.set(kind, resolve);
}

export function getColorScaleResolver(kind: ColorScaleKind): ColorScaleResolver | undefined {
  return resolvers.get(kind);
}
