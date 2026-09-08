import { error } from "@sveltejs/kit";

import { GEOM_REFERENCE, type GeomName, KNOWN_GEOMS } from "@ggts-sh/spec";

import { EXAMPLES } from "$lib/examples-manifest";
import { illustrationForGeom } from "$lib/geom-thumbnails";

import type { EntryGenerator, PageServerLoad } from "./$types";

const GEOM_SET = new Set<string>(KNOWN_GEOMS);

/** Prerender one page per geom (adapter-static). */
export const entries: EntryGenerator = () => KNOWN_GEOMS.map((name) => ({ name }));

function relatedExamples(geom: GeomName) {
  return EXAMPLES.filter(
    (entry) =>
      entry.category === geom ||
      entry.category === geom.replaceAll("_", "") ||
      entry.tags.includes(geom) ||
      entry.tags.includes(geom.replaceAll("_", "-")),
  ).slice(0, 8);
}

/** Resolve gallery illustration on the server so the client stays catalog-free. */
function illustrationData(geom: GeomName, component: string) {
  const resolved = illustrationForGeom(geom);
  if (resolved === undefined) {
    return null;
  }
  const example = EXAMPLES.find((ex) => ex.id === resolved.exampleId);
  return {
    path: resolved.path,
    exampleId: resolved.exampleId,
    title: example?.title ?? component,
    width: example?.vrWidth ?? 640,
    height: example?.vrHeight ?? 400,
  };
}

export const load: PageServerLoad = ({ params }) => {
  const name = params.name;
  if (!GEOM_SET.has(name)) {
    error(404, `No geom reference for "${name}".`);
  }
  const entry = GEOM_REFERENCE[name as GeomName];
  return {
    entry,
    illustration: illustrationData(entry.name, entry.component),
    examples: relatedExamples(entry.name).map((ex) => ({
      id: ex.id,
      title: ex.title,
      href: `/examples/${ex.id}`,
    })),
  };
};
