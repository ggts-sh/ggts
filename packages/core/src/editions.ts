/**
 * Defaults editions (Hadley lesson 13: fix accumulated bad defaults "without
 * breaking existing code").
 *
 * `normalize()` (in @ggts-sh/spec) stamps `edition: CURRENT_EDITION` onto
 * every spec that does not already carry one, freezing which generation of
 * DEFAULT aesthetics the spec was authored against. This module is the other
 * half of the mechanism: the pipeline resolves its default theme table,
 * default categorical palette, and default sequential ramp THROUGH the spec's
 * edition, so a future edition can ship better defaults while every stamped
 * spec keeps its original look. Explicit settings (spec.theme, scales.*.range,
 * scales.*.scheme) always win over edition defaults.
 *
 * There is no global mutable registry (Hadley lesson 14): the edition table is
 * frozen, and callers who need to extend it (tests proving the mechanism; a
 * future edition-2 rollout) pass a table via `RunOptions.editions`, scoped to
 * the run.
 *
 * Unknown editions (a spec stamped by a NEWER ggts than the one rendering
 * it) fall back to the latest edition this build knows, and the pipeline emits
 * an `unknown-edition` warning — old renderers degrade to their best defaults
 * instead of failing.
 */
import { VIRIDIS_RAMP_10 } from "./scales/viridis-ramp.js";
import { CATEGORICAL_PALETTE_10 } from "./scales/train.js";
import { BUILTIN_THEMES, LEGACY_BUILTIN_THEMES } from "./theme-builtins.js";
import {
  resolveEditionDefaults as resolveEditionDefaultsAgainst,
  type EditionDefaults,
  type ResolvedEdition,
} from "./editions-resolve.js";

export type { EditionDefaults, ResolvedEdition } from "./editions-resolve.js";

/** Editions known to this build. Edition 1 = the 0.1.0 defaults. */
export const EDITION_DEFAULTS: Readonly<Record<number, EditionDefaults>> = Object.freeze({
  1: Object.freeze({
    categoricalPalette: CATEGORICAL_PALETTE_10,
    sequentialRamp: VIRIDIS_RAMP_10,
    themes: LEGACY_BUILTIN_THEMES,
  }),
  2: Object.freeze({
    categoricalPalette: CATEGORICAL_PALETTE_10,
    sequentialRamp: VIRIDIS_RAMP_10,
    themes: BUILTIN_THEMES,
  }),
});

/**
 * Resolve the defaults for a spec's edition. `undefined` means "current"
 * (normalize stamps specs, but non-validating callers may skip it); unknown
 * editions fall back to the latest known one (see module docs).
 */
export function resolveEditionDefaults(
  edition?: number,
  table: Readonly<Record<number, EditionDefaults>> = EDITION_DEFAULTS,
): ResolvedEdition {
  return resolveEditionDefaultsAgainst(edition, table);
}
