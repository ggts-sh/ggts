import { error } from "@sveltejs/kit";

import { COORD_REFERENCE, KNOWN_COORD_TYPES, type CoordTypeName } from "@ggts-sh/spec";

import type { EntryGenerator, PageServerLoad } from "./$types";

const COORD_SET = new Set<string>(KNOWN_COORD_TYPES);

/** Prerender one page per coord type (adapter-static). */
export const entries: EntryGenerator = () => KNOWN_COORD_TYPES.map((name) => ({ name }));

export const load: PageServerLoad = ({ params }) => {
  const raw: unknown = (params as { name?: unknown }).name;
  const name = typeof raw === "string" ? raw : "";
  if (!COORD_SET.has(name)) {
    error(404, `No coord reference for "${name}".`);
  }
  return {
    entry: COORD_REFERENCE[name as CoordTypeName],
  };
};
