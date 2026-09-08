import { error } from "@sveltejs/kit";

import { SCALE_REFERENCE, knownScaleSlugs, type ScaleReferenceEntry } from "@ggts-sh/spec";

import { EXAMPLES } from "$lib/examples-manifest";

import type { EntryGenerator, PageServerLoad } from "./$types";

const SLUG_SET = new Set(knownScaleSlugs());

/** Prerender one page per Scale* surface (adapter-static). */
export const entries: EntryGenerator = () => knownScaleSlugs().map((name) => ({ name }));

function relatedExamples(entry: ScaleReferenceEntry) {
  const tokens = new Set([
    entry.slug,
    entry.helper,
    entry.component.toLowerCase(),
    ...entry.aesthetics,
    entry.scaleType,
    entry.family,
    // Common gallery tags for scale families
    ...(entry.aesthetics.includes("color") || entry.aesthetics.includes("fill")
      ? ["color", "fill", "palette", "viridis", "gradient", "hue"]
      : []),
    ...(entry.aesthetics.includes("x") || entry.aesthetics.includes("y")
      ? ["log", "scale", "time", "date"]
      : []),
    ...(entry.aesthetics.includes("size") ? ["size"] : []),
  ]);
  return EXAMPLES.filter((ex) => {
    const hay = [ex.id, ex.category, ...ex.tags].join(" ").toLowerCase();
    for (const t of tokens) {
      if (hay.includes(t.toLowerCase())) return true;
    }
    return false;
  }).slice(0, 8);
}

export const load: PageServerLoad = ({ params }) => {
  const name = params.name;
  if (!SLUG_SET.has(name)) {
    error(404, `No scale reference for "${name}".`);
  }
  const entry = SCALE_REFERENCE[name];
  if (entry === undefined) {
    error(404, `No scale reference for "${name}".`);
  }
  const aliasTarget = entry.aliasOf === undefined ? undefined : SCALE_REFERENCE[entry.aliasOf];
  return {
    entry,
    aliasTarget,
    examples: relatedExamples(entry).map((ex) => ({
      id: ex.id,
      title: ex.title,
      href: `/examples/${ex.id}`,
    })),
  };
};
