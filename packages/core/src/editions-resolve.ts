/**
 * Edition-table lookup. No theme catalog import.
 */
import type { ThemeName } from "@ggts-sh/spec";

import type { ThemeTokens } from "./theme-construct.js";

export interface EditionDefaults {
  categoricalPalette: readonly string[];
  sequentialRamp: readonly string[];
  /** Partial: missing names throw at resolveTheme (unknown-theme). */
  themes: Readonly<Partial<Record<ThemeName, ThemeTokens>>>;
}

export interface ResolvedEdition {
  edition: number;
  defaults: EditionDefaults;
  unknownRequested: number | null;
}

export function resolveEditionDefaults(
  edition: number | undefined,
  table: Readonly<Record<number, EditionDefaults>>,
): ResolvedEdition {
  const known = Object.keys(table)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .toSorted((a, b) => a - b);
  if (known.length === 0) throw new Error("resolveEditionDefaults: empty edition table");
  const latest = known.at(-1)!;
  const requested = edition ?? latest;
  const defaults = table[requested];
  if (defaults !== undefined) {
    return { edition: requested, defaults, unknownRequested: null };
  }
  return { edition: latest, defaults: table[latest]!, unknownRequested: requested };
}
