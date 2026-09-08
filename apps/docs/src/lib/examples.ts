/**
 * Loader bridge between the generated manifest (ids + metadata) and the
 * example modules themselves. Vite's import.meta.glob provides lazy module
 * access plus ?raw sources for the code triptych (spec JSON / builder /
 * Svelte — plan: "docs triptychs").
 *
 * Metadata-only consumers should import `$lib/examples-manifest` instead so
 * they do not register the Example.svelte globs (and their chart deps).
 */
import type { PortableSpec } from "@ggsvelte/spec";
import type { Component } from "svelte";

import { indexExampleModulesById, requireExampleModule } from "./example-module-index.js";

export { EXAMPLES, type ExampleManifestEntry } from "./examples-manifest.js";

const components = import.meta.glob<{ default: Component }>("$examples/*/*/Example.svelte");
const specs = import.meta.glob<{ default: PortableSpec }>("$examples/*/*/spec.ts");
const specSources = import.meta.glob<string>("$examples/*/*/spec.ts", {
  query: "?raw",
  import: "default",
});
const svelteSources = import.meta.glob<string>("$examples/*/*/Example.svelte", {
  query: "?raw",
  import: "default",
});
const reactSources = import.meta.glob<string>("$examples/*/*/Example.tsx", {
  query: "?raw",
  import: "default",
});

// Module-scoped id maps: O(n) once, O(1) per loadExample (was O(n) per pick).
const componentsById = indexExampleModulesById(components, "Example.svelte");
const specsById = indexExampleModulesById(specs, "spec.ts");
const specSourcesById = indexExampleModulesById(specSources, "spec.ts");
const svelteSourcesById = indexExampleModulesById(svelteSources, "Example.svelte");
const reactSourcesById = indexExampleModulesById(reactSources, "Example.tsx");

export interface ExampleSources {
  spec: PortableSpec;
  specSource: string;
  svelteSource: string;
  reactSource: string | null;
}

export interface LoadedExample extends ExampleSources {
  component: Component;
}

/**
 * Load code-tab sources only (no Example.svelte / chart stack).
 * Use on example pages that paint a PNG first and upgrade client-side.
 */
export async function loadExampleSources(id: string): Promise<ExampleSources> {
  const [spec, specSource, svelteSource, reactSource] = await Promise.all([
    requireExampleModule(specsById, id, "spec.ts")(),
    requireExampleModule(specSourcesById, id, "spec.ts")(),
    requireExampleModule(svelteSourcesById, id, "Example.svelte")(),
    reactSourcesById.get(id)?.() ?? null,
  ]);
  return {
    spec: spec.default,
    specSource,
    svelteSource,
    reactSource,
  };
}

/** Dynamically import one example's live Svelte chart component. */
export async function loadExampleComponent(id: string): Promise<Component> {
  const component = await requireExampleModule(componentsById, id, "Example.svelte")();
  return component.default;
}

/** Load one example's live component, canonical spec, and raw sources. */
export async function loadExample(id: string): Promise<LoadedExample> {
  const [component, sources] = await Promise.all([
    loadExampleComponent(id),
    loadExampleSources(id),
  ]);
  return { component, ...sources };
}
