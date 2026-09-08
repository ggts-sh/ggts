/**
 * Style scale family → resolver registry.
 *
 * `scale-style.ts` dispatches through this map so unused numeric (size /
 * linewidth / alpha, including sequential) and finite (shape / linetype)
 * resolvers stay out of lean graphs that do not map those aesthetics.
 */
import type { PortableSpec, StyleAesthetic } from "@ggts-sh/spec";

import type { ScaleState } from "../scales/state.js";
import type { CellValue } from "../table.js";

import type { StyleResolution } from "./scale-style-types.js";
import type { PipelineWarning } from "./types.js";

export type StyleScaleFamily = "finite" | "numeric";

export interface StyleScaleResolveInput {
  aesthetic: StyleAesthetic;
  values: readonly CellValue[];
  catalog: readonly CellValue[];
  anyDiscrete: boolean;
  anyIndexable: boolean;
  nonInteractiveValues?: readonly CellValue[];
  config: NonNullable<PortableSpec["scales"]>[StyleAesthetic] | undefined;
  prevState: ScaleState | null;
  title: string;
  warnings: PipelineWarning[];
}

export type StyleScaleResolver = (input: StyleScaleResolveInput) => StyleResolution;

const resolvers = new Map<StyleScaleFamily, StyleScaleResolver>();

export function registerStyleScaleResolver(
  family: StyleScaleFamily,
  resolve: StyleScaleResolver,
): void {
  resolvers.set(family, resolve);
}

export function getStyleScaleResolver(family: StyleScaleFamily): StyleScaleResolver | undefined {
  return resolvers.get(family);
}
