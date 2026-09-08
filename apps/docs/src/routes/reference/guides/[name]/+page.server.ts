import { error } from "@sveltejs/kit";

import { GUIDE_REFERENCE, KNOWN_GUIDE_TYPES, type GuideTypeName } from "@ggts-sh/spec";

import type { EntryGenerator, PageServerLoad } from "./$types";

const GUIDE_SET = new Set<string>(KNOWN_GUIDE_TYPES);

/** Prerender one page per guide type (adapter-static). */
export const entries: EntryGenerator = () => KNOWN_GUIDE_TYPES.map((name) => ({ name }));

export const load: PageServerLoad = ({ params }) => {
  const name = params.name;
  if (!GUIDE_SET.has(name)) {
    error(404, `No guide reference for "${name}".`);
  }
  return {
    entry: GUIDE_REFERENCE[name as GuideTypeName],
  };
};
