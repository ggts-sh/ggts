/**
 * Chooser logic for /palettes: sort order, deep-link resolution, and the
 * self-declared colorblind-safe set. Pure functions — no chart imports.
 */
import type { CATEGORICAL_SCHEME_NAMES } from "@ggts-sh/spec";

type CategoricalSchemeName = (typeof CATEGORICAL_SCHEME_NAMES)[number];

/**
 * Schemes whose source palettes self-declare colorblind-safe colors (see
 * doc-comments in packages/core/src/scales/categorical-palettes.ts).
 * A full perceptual audit of all schemes is tracked in TODOS.md.
 */
export const COLORBLIND_SAFE_SCHEMES = [
  "colorblind",
  "tableau_colorblind",
  "pander",
] as const satisfies readonly CategoricalSchemeName[];

const COLORBLIND_SAFE = new Set<string>(COLORBLIND_SAFE_SCHEMES);

export const isColorblindSafe = (name: string): boolean => COLORBLIND_SAFE.has(name);

export type PaletteSort = "name" | "capacity";

interface SortableSpecimen {
  readonly name: string;
  readonly label: string;
  readonly capacity: number;
}

/** Returns a new array; never mutates the input. Sorts by what the user reads. */
export const sortPaletteSpecimens = <T extends SortableSpecimen>(
  specimens: readonly T[],
  sort: PaletteSort,
): T[] => {
  const copy = [...specimens];
  copy.sort((a, b) =>
    sort === "capacity"
      ? a.capacity - b.capacity || a.label.localeCompare(b.label)
      : a.label.localeCompare(b.label),
  );
  return copy;
};

/**
 * Validates a ?scheme= deep-link against the picker list. Unknown or absent
 * values fall back to null so the caller picks its default.
 */
export const resolveInitialScheme = <T extends { readonly name: string }>(
  requested: string | null,
  specimens: readonly T[],
): T["name"] | null => {
  if (requested === null) return null;
  return specimens.find((s) => s.name === requested)?.name ?? null;
};
