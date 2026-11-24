/**
 * Field-name → readable guide label helpers (#961).
 *
 * Axis and legend titles fall through to the mapped field when `labs` omits
 * that channel. Raw camelCase reads as an implementation leftover; these
 * helpers space identifiers without inventing domain semantics.
 */

/**
 * Split camelCase / snake_case identifiers into spaced words.
 * Empty input stays empty. Leading/trailing underscores are trimmed away
 * with the spaces they become. Already-spaced input is collapsed to single
 * spaces. Single tokens (including all-lowercase and Title Case) are unchanged
 * aside from underscore/spacing cleanup.
 */
export function spaceFieldName(fieldName: string): string {
  if (fieldName.length === 0) return fieldName;
  return fieldName
    .replaceAll("_", " ")
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replaceAll(/\s+/g, " ")
    .trim();
}

/**
 * Default axis/legend title from a mapped field name.
 *
 * Multi-word identifiers become sentence case (`bloomRefDate` → `Bloom ref date`).
 * Single tokens stay as authored (`Region`, `year`, `count`, `stackpos`) so
 * short ggplot-style names and stat columns are not rewritten.
 */
export function humanizeFieldTitle(fieldName: string): string {
  const spaced = spaceFieldName(fieldName);
  if (spaced.length === 0 || !/\s/.test(spaced)) return spaced;
  const lower = spaced.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
