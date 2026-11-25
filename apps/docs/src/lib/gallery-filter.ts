import type { GalleryEntry } from "./catalog/gallery.js";

export interface GalleryFilterState {
  query: string;
  categories: string[];
  tags: string[];
}

export interface GalleryFilterOptions {
  categories: ReadonlySet<string>;
  tags: ReadonlySet<string>;
}

const OWNED_KEYS = ["q", "category", "tag"] as const;

function normalized(value: string): string {
  return value.trim().replaceAll(/\s+/g, " ").toLowerCase();
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].toSorted((left, right) => left.localeCompare(right));
}

export function filterGallery(
  entries: readonly GalleryEntry[],
  state: GalleryFilterState,
): GalleryEntry[] {
  const query = normalized(state.query);
  const categories = new Set(state.categories);
  const tags = new Set(state.tags);
  return entries.filter((entry) => {
    if (categories.size > 0 && !categories.has(entry.category)) return false;
    if ([...tags].some((tag) => !entry.tags.includes(tag))) return false;
    if (query === "") return true;
    const haystack = normalized(
      [
        entry.id,
        entry.title,
        entry.description,
        entry.category,
        entry.docsSection,
        ...entry.tags,
      ].join(" "),
    );
    return query.split(" ").every((part) => haystack.includes(part));
  });
}

export function parseGalleryFilter(
  params: URLSearchParams,
  options: GalleryFilterOptions,
): { state: GalleryFilterState; reset: boolean } {
  let reset = false;
  const readKnown = (key: "category" | "tag", allowed: ReadonlySet<string>): string[] => {
    const values = uniqueSorted(params.getAll(key));
    const known = values.filter((value) => allowed.has(value));
    if (known.length !== values.length) reset = true;
    return known;
  };
  return {
    state: {
      query: params.get("q")?.trim().replaceAll(/\s+/g, " ") ?? "",
      categories: readKnown("category", options.categories),
      tags: readKnown("tag", options.tags),
    },
    reset,
  };
}

export function serializeGalleryFilter(
  state: GalleryFilterState,
  current: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of OWNED_KEYS) next.delete(key);
  const query = state.query.trim().replaceAll(/\s+/g, " ");
  if (query !== "") next.set("q", query);
  for (const category of uniqueSorted(state.categories)) next.append("category", category);
  for (const tag of uniqueSorted(state.tags)) next.append("tag", tag);
  return next;
}

/** Minimal seed for ranking when the current page is not itself a candidate. */
export type RelatedSeed = Pick<GalleryEntry, "id" | "category" | "tags">;

/**
 * Rank related gallery cards for a detail page.
 *
 * `entries` is the candidate pool (usually `galleryCatalog`). When the current
 * page is outside that pool — e.g. an interaction exposition still rendered at
 * its old `/examples/interaction/*` alias — pass `seed` from the manifest so
 * category/tag overlap still yields gallery neighbours instead of an empty list.
 */
export function rankRelatedExamples(
  currentId: string,
  entries: readonly GalleryEntry[],
  limit = 3,
  seed?: RelatedSeed,
): GalleryEntry[] {
  const current = seed ?? entries.find((entry) => entry.id === currentId);
  const count = Math.trunc(limit);
  if (current === undefined || !(count > 0)) return [];

  const currentTags = new Set(current.tags);
  const byScore: GalleryEntry[][] = [];
  entries.forEach((entry) => {
    if (entry.id === current.id) return;
    let score = entry.category === current.category ? 2 : 0;
    entry.tags.forEach((tag) => {
      if (currentTags.has(tag)) score += 1;
    });

    const bucket = byScore[score];
    if (bucket === undefined) byScore[score] = [entry];
    else bucket.push(entry);
  });

  const related: GalleryEntry[] = [];
  for (let score = byScore.length - 1; score >= 0; score -= 1) {
    const bucket = byScore[score];
    if (bucket === undefined) continue;
    for (const entry of bucket) {
      related.push(entry);
      if (related.length === count) return related;
    }
  }
  return related;
}
