/**
 * gen-llms — ONE source for the docs guide prose and the agent-facing
 * `llms.txt` / `llms-full.txt` endpoints (plan: prerendered from the
 * manifest, zero manual upkeep; "one source, three uses").
 *
 * Module layout:
 * - `llms-markdown.ts` — minimal markdown renderer
 * - `llms-guide-content.ts` — guide prose constants + interaction reference
 * - `llms-diagnostic-docs.ts` — errors + advisories catalog builders
 * - `llms-lifecycle-docs.ts` — lifecycle guide builder + LifecycleDoc
 * - this file — guidePages, llms surfaces, public re-exports
 *
 * Everything here is pure (data in, string out) and unit-tested in
 * scripts/gen-llms/*.test.ts; apps/docs imports it via the `$scripts` alias
 * for its prerendered endpoints and guide pages.
 */
import { CURRENT_EDITION, THEME_NAMES } from "@ggts-sh/spec";
import { REACT_SPEC_HOST_SOURCE } from "./agent-quickstart";
import sveltePackage from "../packages/svelte/package.json";
import { GUIDE_CATALOG, type GuideSlug } from "../apps/docs/src/lib/catalog/guide";
import { assertGuideCodeContract } from "./guide-code-contract";
import {
  AGENTS_MD,
  FACETS_COORDINATES_MD,
  GETTING_STARTED_MD,
  INTERACTIONS_MD,
  INTERACTION_REFERENCE_MD,
  PRODUCTION_MD,
  SCALES_GUIDES_MD,
  STATISTICS_POSITIONS_MD,
  TEMPORAL_SCALES_MD,
  UPGRADING_MD,
} from "./llms-guide-content";
import { buildAdvisoriesMd, buildErrorsMd } from "./llms-diagnostic-docs";
import { buildLifecycleMd, type LifecycleDoc } from "./llms-lifecycle-docs";

export { buildDiagnosticDocs } from "./diagnostic-docs";
export { extractMarkdownHeadings, renderMarkdown, type MarkdownHeading } from "./llms-markdown";
export {
  AGENTS_MD,
  FACETS_COORDINATES_MD,
  GETTING_STARTED_MD,
  INTERACTIONS_MD,
  INTERACTION_REFERENCE_INDEX,
  INTERACTION_REFERENCE_MD,
  PRODUCTION_MD,
  SCALES_GUIDES_MD,
  STATISTICS_POSITIONS_MD,
  TEMPORAL_SCALES_MD,
  UPGRADING_MD,
  type InteractionReferenceEntry,
} from "./llms-guide-content";
export { buildAdvisoriesMd, buildErrorsMd } from "./llms-diagnostic-docs";
export { buildLifecycleMd, type LifecycleDoc } from "./llms-lifecycle-docs";

export interface LlmsExampleEntry {
  id: string;
  title: string;
  description: string;
  tags: readonly string[];
  docsSection: string;
}

export interface LlmsFullExample extends LlmsExampleEntry {
  /** Canonical PortableSpec, pretty-printed JSON. */
  specJSON: string;
  /** The Example.svelte source. */
  svelteSource: string;
  /** Authored React host behavior when the example has a dedicated adapter version. */
  reactSource?: string;
  prunedRows?: number;
}

export interface GuidePage {
  slug: string;
  title: string;
  description: string;
  markdown: string;
}

export function guidePages(lifecycle: LifecycleDoc): GuidePage[] {
  const markdownBySlug: Record<GuideSlug, string> = {
    agents: AGENTS_MD,
    "getting-started": GETTING_STARTED_MD,
    "statistics-positions": STATISTICS_POSITIONS_MD,
    "scales-guides": SCALES_GUIDES_MD,
    "facets-coordinates": FACETS_COORDINATES_MD,
    "temporal-scales": TEMPORAL_SCALES_MD,
    interactions: INTERACTIONS_MD,
    production: PRODUCTION_MD,
    "interaction-reference": INTERACTION_REFERENCE_MD,
    errors: buildErrorsMd(),
    advisories: buildAdvisoriesMd(),
    lifecycle: buildLifecycleMd(lifecycle),
    upgrading: UPGRADING_MD,
  };

  return GUIDE_CATALOG.map(({ slug, title, description }) => {
    const markdown = markdownBySlug[slug];
    assertGuideCodeContract(markdown, slug);
    return { slug, title, description, markdown };
  });
}

export interface DocsDiscoveryFacts {
  canonicalBase: string;
  packageVersion: string;
  currentEdition: number;
  themeNames: readonly string[];
}

export function docsDiscoveryFacts(canonicalBase: string): DocsDiscoveryFacts {
  return {
    canonicalBase,
    packageVersion: sveltePackage.version,
    currentEdition: CURRENT_EDITION,
    themeNames: THEME_NAMES,
  };
}

export function markdownOutsideFences(markdown: string): string {
  let fenced = false;
  return markdown
    .split("\n")
    .filter((line) => {
      if (line.trimStart().startsWith("```")) {
        fenced = !fenced;
        return false;
      }
      return !fenced;
    })
    .join("\n");
}

function absoluteMarkdownLinks(markdown: string, canonicalBase: string): string {
  const origin = canonicalBase.replace(/\/$/, "");
  let fenced = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (line.trimStart().startsWith("```")) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;
      return line
        .replaceAll("https://ljodea.github.io/ggsvelte", origin)
        .replaceAll(/\]\((\/[^)\s]*)\)/g, (_match, path: string) => `](${origin}${path})`);
    })
    .join("\n");
}

/** llms.txt — the curated index (llmstxt.org shape: H1, blurb, link lists). */
export function buildLlmsIndex(
  pages: readonly GuidePage[],
  examples: readonly LlmsExampleEntry[],
  facts: DocsDiscoveryFacts = docsDiscoveryFacts("https://ggts.sh"),
): string {
  const lines = [
    "# ggts",
    "",
    "> A layered grammar of graphics for JavaScript: ggplot2 semantics (aes/geom/stat/scale/coord/facet/theme/position), a strictly-JSON PortableSpec that agents emit (published JSON Schema for constrained decoding), a TypeScript builder, React and Svelte 5 components, hybrid SVG/canvas rendering, and value-stable color scales. validate() returns { code, path, message, fix } errors whose fix.example is machine-applicable.",
    "",
    "## Current release facts",
    "",
    `- Package version: ${facts.packageVersion}`,
    `- Defaults edition: ${String(facts.currentEdition)}`,
    `- Registered chart themes (${String(facts.themeNames.length)}): ${facts.themeNames.join(", ")}`,
    "",
    "## Docs",
    "",
  ];
  for (const page of pages) {
    lines.push(`- [${page.title}](/guide/${page.slug}): ${page.description}`);
  }
  lines.push(
    "- [Geoms](/reference/geoms): every Geom* component with defaults, allowed stats/positions, and params from the schema",
    "- [Stats](/reference/stats): every statistical transform with after_stat columns and compatible geoms",
    "- [Positions](/reference/positions): every position adjustment with positionParams and compatible geoms",
    "- [Scales](/reference/scales): every Scale* component for position, color/fill, and style channels",
    "- [Guides and legends](/reference/guides): GuideLegend, GuideColorbar, GuideColorsteps, GuideAxis, and GuideNone with channels and props",
    "- [Labs](/reference/labs): plot title, subtitle, caption, and per-aesthetic axis/legend titles",
    "- [Axes and ticks](/reference/axes): GuideAxis presentation, scale breaks/labels, band layout, and grids",
    "- [Labels](/reference/labels): plot chrome vs tick labels vs GeomText/GeomLabel/SF data labels",
    "- [Search interaction reference](/reference/interactions): filter interaction capabilities, events, diagnostics, and accessibility guidance",
    "- [JSON Schema v0](/schema/v0.json): the PortableSpec schema (unstable in v0.1)",
    "- [llms-full.txt](/llms-full.txt): all docs prose plus every example (spec JSON, React host, and Svelte source)",
    "",
    "## Examples",
    "",
  );
  let section = "";
  for (const ex of examples) {
    if (ex.docsSection !== section) {
      section = ex.docsSection;
      lines.push("", `### ${section}`, "");
    }
    const href = `/examples/${ex.id}`;
    lines.push(
      ex.description.trim() === ""
        ? `- [${ex.title}](${href})`
        : `- [${ex.title}](${href}): ${ex.description}`,
    );
  }
  lines.push("");
  return absoluteMarkdownLinks(lines.join("\n"), facts.canonicalBase);
}

/**
 * Cap a spec's inline data for the llms-full listing (a 10k-row canvas
 * example would otherwise dominate the file): values arrays and column
 * arrays are truncated to `maxRows`, and the count of pruned rows is
 * returned so the listing can say so. The spec's structure is untouched.
 */
export function pruneSpecData(spec: unknown, maxRows = 20): { spec: unknown; prunedRows: number } {
  let prunedRows = 0;
  const pruneData = (data: unknown): unknown => {
    if (typeof data !== "object" || data === null) return data;
    const d = data as Record<string, unknown>;
    if (Array.isArray(d["values"]) && d["values"].length > maxRows) {
      prunedRows += d["values"].length - maxRows;
      return { ...d, values: d["values"].slice(0, maxRows) };
    }
    if (typeof d["columns"] === "object" && d["columns"] !== null) {
      const columns = d["columns"] as Record<string, unknown>;
      let pruned = false;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(columns)) {
        if (Array.isArray(v) && v.length > maxRows) {
          if (!pruned) prunedRows += v.length - maxRows;
          pruned = true;
          out[k] = v.slice(0, maxRows);
        } else {
          out[k] = v;
        }
      }
      return pruned ? { ...d, columns: out } : d;
    }
    return data;
  };
  if (typeof spec !== "object" || spec === null) return { spec, prunedRows };
  const s = spec as Record<string, unknown>;
  const out: Record<string, unknown> = { ...s };
  if (out["data"] !== undefined) out["data"] = pruneData(out["data"]);
  if (typeof out["datasets"] === "object" && out["datasets"] !== null) {
    const datasets: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(out["datasets"] as Record<string, unknown>)) {
      datasets[k] = pruneData(v);
    }
    out["datasets"] = datasets;
  }
  return { spec: out, prunedRows };
}

/** llms-full.txt — all guide prose + every example, from the manifest. */
export function buildLlmsFull(
  pages: readonly GuidePage[],
  examples: readonly LlmsFullExample[],
  facts: DocsDiscoveryFacts = docsDiscoveryFacts("https://ggts.sh"),
): string {
  const parts = [
    "# ggts — full docs corpus for language models",
    "",
    "Generated from the shared guide sources and example manifest. Each example supplies PortableSpec JSON for every framework and authored Svelte usage. The React host below renders the same grammar; host-only interactions require adapter callbacks and components.",
    "",
    "## Current release facts",
    "",
    `- Package version: ${facts.packageVersion}`,
    `- Defaults edition: ${String(facts.currentEdition)}`,
    `- Registered chart themes (${String(facts.themeNames.length)}): ${facts.themeNames.join(", ")}`,
    "",
    "---",
    "",
  ];
  for (const page of pages) {
    parts.push(page.markdown.trim(), "", "---", "");
  }
  parts.push(
    "# React gallery host",
    "",
    "Save an example's complete Spec JSON from its gallery page as chart.json beside this component. Corpus data may be shortened with an explicit note; use the gallery page for all rows.",
    "",
    "```tsx",
    REACT_SPEC_HOST_SOURCE,
    "```",
    "",
    "# Examples",
    "",
  );
  for (const ex of examples) {
    parts.push(`## ${ex.title} (${ex.id})`, "");
    if (ex.description.trim() !== "") {
      parts.push(ex.description, "");
    }
    if ((ex.prunedRows ?? 0) > 0)
      parts.push(
        `Data sample: ${String(ex.prunedRows)} rows omitted. The gallery page contains the complete spec.`,
        "",
      );
    parts.push(
      `Tags: ${ex.tags.join(", ")}`,
      "",
      "Spec (canonical PortableSpec JSON):",
      "",
      "```json",
      ex.specJSON.trim(),
      "```",
      "",
      "Svelte usage:",
      "",
      "```svelte",
      ex.svelteSource.trim(),
      "```",
      "",
    );
    if (ex.reactSource !== undefined) {
      parts.push("React usage:", "", "```tsx", ex.reactSource.trim(), "```", "");
    }
  }
  return absoluteMarkdownLinks(parts.join("\n"), facts.canonicalBase);
}
