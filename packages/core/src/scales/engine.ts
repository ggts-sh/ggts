/**
 * Scale engine: policies owned once (#643).
 *
 * Orchestration collects evidence and packs legends; trainers and pipeline
 * color families call into this module for:
 * - degenerate-domain padding
 * - NA / unknown color defaults
 * - palette / ramp precedence
 * - transform registry as the only forward/valid source for sequential color
 */
import { CYCLIC_SCHEME_NAMES } from "@ggts-sh/spec";

import { CATEGORICAL_PALETTE_10, CATEGORICAL_SCHEMES } from "./categorical-palettes.js";
import { colorBrewerStops } from "./colorbrewer-palettes.js";
import { crameriRampStops } from "./crameri-ramps.js";
import { normalizeColor } from "./normalize-color.js";
import { sequentialSchemeRamp } from "./sequential-schemes.js";
import { VIRIDIS_RAMP_10 } from "./viridis-ramp.js";

const CYCLIC_SCHEMES = new Set<string>(CYCLIC_SCHEME_NAMES);

/** Default NA / unknown color when authors omit either side. */
export const DEFAULT_MISSING_COLOR = "#999999";

/**
 * Symmetric pad for zero-variance continuous domains (ggplot2-style).
 * Shared by positional training and sequential color training.
 */
export function padDegenerateDomain(min: number, max: number): [number, number] {
  if (min === max) return [min - 0.5, max + 0.5];
  return [min, max];
}

export interface MissingColorConfig {
  naValue?: string;
  unknownValue?: string;
}

/** Resolve NA/unknown colors from optional author config (normalized #rrggbb). */
export function resolveMissingColors(config?: MissingColorConfig): {
  naValue: string;
  unknownValue: string;
} {
  return {
    naValue: normalizeColor(config?.naValue ?? DEFAULT_MISSING_COLOR),
    unknownValue: normalizeColor(config?.unknownValue ?? DEFAULT_MISSING_COLOR),
  };
}

export interface PaletteConfig {
  range?: readonly string[];
  scheme?: string;
}

/**
 * Pipeline-facing ordinal range. Explicit range wins. Named schemes leave
 * range undefined so {@link resolveOrdinalPaletteStops} / trainColor keep
 * scheme fingerprints. Edition palettes apply only when they differ from the
 * built-in default (edition-1 byte-stability).
 */
export function resolveOrdinalPipelineRange(
  config: PaletteConfig | undefined,
  editionPalette: readonly string[],
): readonly string[] | undefined {
  const scheme = config?.scheme;
  const edition = editionPalette === CATEGORICAL_PALETTE_10 ? undefined : editionPalette;
  return config?.range ?? (scheme === undefined ? edition : undefined);
}

/**
 * Continuous ramps that even-sample for discrete ordinal use (viridis_d
 * parity): viridis family + Crameri scientific maps. ColorBrewer stays
 * discrete-table fallthrough (max-n stops), not even-sampled.
 */
export function continuousSchemeRamp(name: string | undefined): readonly string[] | undefined {
  if (name === undefined || CYCLIC_SCHEMES.has(name)) return undefined;
  return sequentialSchemeRamp(name) ?? crameriRampStops(name);
}

/** Sequential + cyclic Crameri ramps. Cyclic names are excluded from ordinal sampling. */
function sequentialOrCyclicRamp(name: string | undefined): readonly string[] | undefined {
  if (name === undefined) return undefined;
  return sequentialSchemeRamp(name) ?? crameriRampStops(name);
}

/** Trainer-facing ordinal stops: explicit range > named scheme > built-in. */
export function resolveOrdinalPaletteStops(
  input: {
    range?: readonly string[];
    scheme?: string;
  } = {},
): readonly string[] {
  if (input.range !== undefined) return input.range;
  // Continuous-family schemes are sampled to domain size in trainColor; the
  // raw ramp is only a fallback placeholder for fingerprinting.
  const sequential = continuousSchemeRamp(input.scheme);
  if (sequential !== undefined) return sequential;
  if (input.scheme !== undefined) {
    const named = CATEGORICAL_SCHEMES[input.scheme as keyof typeof CATEGORICAL_SCHEMES];
    if (named !== undefined) return named;
    // ColorBrewer sequential/diverging may also be used ordinally (brewer type=seq).
    const brewer = colorBrewerStops(input.scheme);
    if (brewer !== undefined) return brewer;
  }
  return CATEGORICAL_PALETTE_10;
}

/**
 * Pipeline-facing sequential range. Explicit range wins; a named sequential
 * scheme selects its built-in ramp; edition ramps apply only when they differ
 * from viridis (edition-1 byte-stability via VIRIDIS_RAMP_10 identity).
 */
export function resolveSequentialPipelineRange(
  config: PaletteConfig | undefined,
  editionRamp: readonly string[],
): readonly string[] | undefined {
  const edition = editionRamp === VIRIDIS_RAMP_10 ? undefined : editionRamp;
  // Named continuous schemes first (viridis family + Crameri); ColorBrewer
  // palette names fall through to the brewer tables (#825).
  const namedSchemeRamp =
    sequentialOrCyclicRamp(config?.scheme) ??
    (config?.scheme === undefined ? undefined : colorBrewerStops(config.scheme));
  return config?.range ?? namedSchemeRamp ?? edition;
}
