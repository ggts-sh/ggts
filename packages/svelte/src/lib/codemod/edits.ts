/**
 * Positional source edits (#659 slice 7).
 *
 * ADR 0013 named `magic-string` as the starting-point stack and told the first
 * real codemod to revisit it. This transform only ever removes attribute
 * ranges and inserts child elements, so the whole requirement is "apply
 * non-overlapping [start, end) replacements to the original string" — 20 lines
 * that keep `@ggts-sh/svelte` free of a runtime dependency consumers would
 * install forever to run a tool once.
 *
 * Applying right-to-left is what makes earlier offsets stay valid, which is
 * why every offset in the caller can come straight from the parse tree.
 */

/** A replacement of `source[start, end)` with `text`. Insert ⇒ start === end. */
export interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/**
 * Apply non-overlapping edits to `source`.
 *
 * @throws if two edits overlap — a codemod bug that would otherwise corrupt
 * output silently, which is exactly the "wrong rewrite" blast radius ADR 0013
 * weighs. Insertions at the same offset are not overlaps and keep their
 * relative order.
 */
export function applyEdits(source: string, edits: readonly Edit[]): string {
  const ordered = edits
    .map((edit, index) => ({ edit, index }))
    .toSorted((a, b) => b.edit.start - a.edit.start || b.index - a.index);

  let out = source;
  let lowestApplied = source.length;
  for (const { edit } of ordered) {
    if (edit.end > lowestApplied) {
      throw new Error(`codemod: overlapping edits at [${String(edit.start)}, ${String(edit.end)})`);
    }
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    lowestApplied = edit.start;
  }
  return out;
}
