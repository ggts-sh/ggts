import { error } from "@sveltejs/kit";

import {
  GEOM_DEFAULTS,
  POSITION_REFERENCE,
  type GeomName,
  type PositionName,
  KNOWN_POSITIONS,
} from "@ggts-sh/spec";

import { EXAMPLES } from "$lib/examples-manifest";

import type { EntryGenerator, PageServerLoad } from "./$types";

const POSITION_SET = new Set<string>(KNOWN_POSITIONS);

/** Prerender one page per position (adapter-static). */
export const entries: EntryGenerator = () => KNOWN_POSITIONS.map((name) => ({ name }));

function relatedExamples(position: PositionName) {
  return EXAMPLES.filter(
    (entry) =>
      entry.tags.includes(position) ||
      entry.tags.includes(`position-${position}`) ||
      entry.tags.includes(`position_${position}`) ||
      entry.id.includes(position),
  ).slice(0, 8);
}

export const load: PageServerLoad = ({ params }) => {
  const name = params.name;
  if (!POSITION_SET.has(name)) {
    error(404, `No position reference for "${name}".`);
  }
  const entry = POSITION_REFERENCE[name as PositionName];
  const primaryGeom = entry.defaultForGeoms[0] ?? entry.compatibleGeoms[0];
  const geomName: GeomName = primaryGeom ?? "bar";
  const defaultStat = GEOM_DEFAULTS[geomName]?.stat ?? "identity";
  return {
    entry,
    primaryGeom: primaryGeom ?? null,
    geomName,
    defaultStat,
    examples: relatedExamples(entry.name).map((ex) => ({
      id: ex.id,
      title: ex.title,
      href: `/examples/${ex.id}`,
    })),
  };
};
