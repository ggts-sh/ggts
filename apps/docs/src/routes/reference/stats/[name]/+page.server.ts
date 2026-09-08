import { error } from "@sveltejs/kit";

import { STAT_REFERENCE, type StatName, KNOWN_STATS } from "@ggts-sh/spec";

import { EXAMPLES } from "$lib/examples-manifest";

import type { EntryGenerator, PageServerLoad } from "./$types";

const STAT_SET = new Set<string>(KNOWN_STATS);

/** Prerender one page per stat (adapter-static). */
export const entries: EntryGenerator = () => KNOWN_STATS.map((name) => ({ name }));

function relatedExamples(stat: StatName) {
  return EXAMPLES.filter(
    (entry) =>
      entry.category === stat ||
      entry.category === stat.replaceAll("_", "") ||
      entry.tags.includes(stat) ||
      entry.tags.includes(stat.replaceAll("_", "-")) ||
      entry.tags.includes(`stat-${stat}`) ||
      entry.tags.includes(`stat_${stat}`),
  ).slice(0, 8);
}

export const load: PageServerLoad = ({ params }) => {
  const name = params.name;
  if (!STAT_SET.has(name)) {
    error(404, `No stat reference for "${name}".`);
  }
  const entry = STAT_REFERENCE[name as StatName];
  return {
    entry,
    examples: relatedExamples(entry.name).map((ex) => ({
      id: ex.id,
      title: ex.title,
      href: `/examples/${ex.id}`,
    })),
  };
};
