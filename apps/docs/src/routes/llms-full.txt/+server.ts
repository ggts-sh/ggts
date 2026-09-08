/**
 * /llms-full.txt — all docs prose + every example (title, description,
 * canonical spec JSON, Svelte source) from the manifest (prerendered; plan:
 * "one source, three uses" — this is the third use). Zero manual upkeep:
 * examples come from import.meta.glob over the corpus, prose from the same
 * generators the guide pages render.
 */
import type { PortableSpec } from "@ggsvelte/spec";

import type { LlmsFullExample } from "$scripts/gen-llms";
import { buildLlmsFull, docsDiscoveryFacts, pruneSpecData } from "$scripts/gen-llms";

import { EXAMPLES } from "$lib/examples-manifest";
import { indexExampleModulesById, requireExampleModule } from "$lib/example-module-index";
import { docsBuildConfig } from "$lib/server/build-config";
import { GUIDE_PAGES } from "$lib/guide";

export const prerender = true;

const specs = import.meta.glob<{ default: PortableSpec }>("$examples/*/*/spec.ts", {
  eager: true,
});
const svelteSources = import.meta.glob<string>("$examples/*/*/Example.svelte", {
  query: "?raw",
  import: "default",
  eager: true,
});
const reactSources = import.meta.glob<string>("$examples/*/*/Example.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
});

// Module-scoped id maps: O(n) once per table, O(1) per EXAMPLE (was O(n²)).
const specsById = indexExampleModulesById(specs, "spec.ts");
const svelteSourcesById = indexExampleModulesById(svelteSources, "Example.svelte");
const reactSourcesById = indexExampleModulesById(reactSources, "Example.tsx");

export function GET(): Response {
  const config = docsBuildConfig();
  const examples: LlmsFullExample[] = EXAMPLES.map((entry) => {
    const full = requireExampleModule(
      specsById,
      entry.id,
      "spec.ts",
      "llms-full: example module",
    ).default;
    // Cap inline data so one 10k-row example cannot dominate the corpus.
    const { spec, prunedRows } = pruneSpecData(full, 20);
    const reactSource = reactSourcesById.get(entry.id);
    return {
      ...entry,
      specJSON: JSON.stringify(spec, null, 2),
      prunedRows,
      ...(reactSource === undefined ? {} : { reactSource }),
      svelteSource: requireExampleModule(
        svelteSourcesById,
        entry.id,
        "Example.svelte",
        "llms-full: example module",
      ),
    };
  });
  return new Response(
    buildLlmsFull(GUIDE_PAGES, examples, docsDiscoveryFacts(config.canonicalBase)),
    {
      headers: { "content-type": "text/plain; charset=utf-8" },
    },
  );
}
