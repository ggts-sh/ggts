import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { DOCS_ROUTES } from "../apps/docs/src/lib/generated/routes.ts";
import type { DocsRouteMetadata } from "../apps/docs/src/lib/route-types.ts";
import type { DocsSearchEntry } from "../apps/docs/src/lib/search-types.ts";
import { EXAMPLES } from "../examples/manifest.ts";
import lifecycle from "../lifecycle.json";
import { defineArtifact, formatGeneratedSource } from "./artifact.ts";
import { CLI_REFERENCE_OPTIONS } from "./cli-docs.ts";
import { buildDiagnosticDocs } from "./diagnostic-docs.ts";
import { docsRoutesArtifact } from "./gen-docs-routes.ts";
import { lifecycleArtifact } from "./gen-lifecycle.ts";
import { manifestArtifact } from "./gen-manifest.ts";

export type { DocsSearchEntry } from "../apps/docs/src/lib/search-types.ts";

const SEARCH_EXACT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "/guide/scales-guides#date-and-time-axes": ["date axis"],
  "/guide/interactions#inspection": ["tooltip"],
  "/guide/production#server-and-export": ["server render"],
  "/guide/production#rendering": ["canvas selection"],
  "/reference/labs": ["labs", "plot title", "axis title"],
  "/reference/axes": ["axis", "ticks", "GuideAxis", "tick labels"],
  "/reference/labels": ["GeomText", "GeomLabel", "data labels"],
  "/reference/axes#scale-breaks-labels": ["breaks", "tick format"],
  "/reference/axes#guide-axis": ["showTicks", "collision"],
};

const OUTPUT_PATH = join(
  import.meta.dir,
  "..",
  "apps",
  "docs",
  "src",
  "lib",
  "generated",
  "search-index.ts",
);

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function routeId(path: string): string {
  return path === "/" ? "home" : path.slice(1).replaceAll("/", "-");
}

function cleanTitle(title: string): string {
  return title.replace(/ — ggts(?: gallery)?$/, "");
}

function lifecycleAnchor(packageName: string, entry: string): string {
  return slug(`${packageName}${entry === "." ? "" : ` ${entry}`}`);
}

function appendRouteEntries(entries: DocsSearchEntry[]): void {
  const routes: readonly DocsRouteMetadata[] = DOCS_ROUTES;
  for (const route of routes) {
    if (!route.index || route.kind !== "page" || route.path.startsWith("/examples/")) continue;
    const pageTitle = cleanTitle(route.title);
    entries.push({
      id: `page:${routeId(route.path)}`,
      kind: "page",
      title: pageTitle,
      summary: route.description,
      href: route.path,
      keywords: route.navigation === undefined ? [] : [route.navigation.section],
      exact: [pageTitle, ...(SEARCH_EXACT_ALIASES[route.path] ?? [])],
    });
    for (const heading of route.headings ?? []) {
      if (route.path === "/reference/cli" && heading.level === 3) continue;
      entries.push({
        id: `heading:${routeId(route.path)}:${heading.id}`,
        kind: "heading",
        title: heading.title,
        summary: `${heading.title} in ${pageTitle}. ${route.description}`,
        href: `${route.path}#${heading.id}`,
        keywords: [pageTitle, route.navigation?.section ?? "documentation"],
        exact: [heading.title, ...(SEARCH_EXACT_ALIASES[`${route.path}#${heading.id}`] ?? [])],
      });
    }
  }
}

function appendExampleEntries(entries: DocsSearchEntry[]): void {
  for (const example of EXAMPLES) {
    entries.push({
      id: `example:${example.id.replaceAll("/", ":")}`,
      kind: "example",
      title: example.title,
      summary:
        example.description.trim() === ""
          ? `${example.title} (${example.docsSection})`
          : example.description,
      href: `/examples/${example.id}`,
      keywords: [example.title, example.docsSection, ...example.tags],
      exact: [example.title],
    });
  }
}

function appendLifecycleEntries(entries: DocsSearchEntry[]): void {
  for (const surface of lifecycle.surfaces) {
    const anchor = lifecycleAnchor(surface.package, surface.entry);
    for (const [name, metadata] of Object.entries(surface.exports)) {
      entries.push({
        id: `api:${anchor}:${name}`,
        kind: "api",
        title: name,
        summary: `${surface.package}${surface.entry === "." ? "" : ` ${surface.entry}`} · ${metadata.kind} · ${metadata.lifecycle}.`,
        href: `/guide/lifecycle#${anchor}`,
        keywords: [surface.package, surface.entry, metadata.kind, metadata.lifecycle],
        exact: [name],
      });
    }
  }
  for (const tag of lifecycle.tags) {
    entries.push({
      id: `lifecycle:${tag}`,
      kind: "lifecycle",
      title: tag,
      summary: `Public API lifecycle label: ${tag}.`,
      href: "/guide/lifecycle#lifecycle-tags",
      keywords: ["stability", "upgrade", "public API"],
      exact: [tag],
    });
  }
}

function appendDiagnosticEntries(entries: DocsSearchEntry[]): void {
  for (const diagnostic of buildDiagnosticDocs()) {
    entries.push({
      id: `diagnostic:${diagnostic.source}:${diagnostic.code}`,
      kind: "diagnostic",
      title: `${diagnostic.code} · ${diagnostic.source}`,
      summary: diagnostic.why,
      href: `/guide/errors#${diagnostic.anchor}`,
      keywords: [diagnostic.source, diagnostic.severity, diagnostic.fix],
      exact: [diagnostic.code, `${diagnostic.source}:${diagnostic.code}`],
    });
  }
}

function appendCliEntries(entries: DocsSearchEntry[]): void {
  for (const option of CLI_REFERENCE_OPTIONS) {
    entries.push({
      id: `cli:${option.anchor}`,
      kind: "cli",
      title: option.flag,
      summary: option.description,
      href: `/reference/cli#${option.anchor}`,
      keywords: [option.value, ...option.aliases, option.detail ?? ""].filter(Boolean),
      exact: [option.flag, ...option.aliases],
    });
  }
}

export function createDocsSearchEntries(): DocsSearchEntry[] {
  const entries: DocsSearchEntry[] = [];
  appendRouteEntries(entries);
  appendExampleEntries(entries);
  appendLifecycleEntries(entries);
  appendDiagnosticEntries(entries);
  appendCliEntries(entries);
  return validateDocsSearchEntries(entries);
}

export function validateDocsSearchEntries<Entry extends DocsSearchEntry>(
  entries: Entry[],
): Entry[] {
  const routes: readonly DocsRouteMetadata[] = DOCS_ROUTES;
  const publicRoutes = new Map(
    routes
      .filter((route) => route.index && route.kind === "page")
      .map((route) => [route.path, route] as const),
  );
  // Set<string>, not the inferred union of the known anchors: this is looked up
  // with anchors parsed out of arbitrary hrefs, and Set.has on a literal-union
  // set rejects the very inputs the check exists to reject.
  const cliAnchors = new Set<string>(CLI_REFERENCE_OPTIONS.map((option) => option.anchor));
  const ids = new Set<string>();
  const hrefTitles = new Set<string>();
  for (const entry of entries) {
    if (entry.id.trim() === "" || entry.title.trim() === "" || entry.summary.trim() === "") {
      throw new Error(`Invalid docs search entry ${entry.id || "(missing id)"}: text is required`);
    }
    if (ids.has(entry.id)) throw new Error(`Invalid docs search index: duplicate id ${entry.id}`);
    ids.add(entry.id);
    const hrefTitle = `${entry.href}\u0000${entry.title}`;
    if (hrefTitles.has(hrefTitle)) {
      throw new Error(
        `Invalid docs search index: duplicate href/title ${entry.href} ${entry.title}`,
      );
    }
    hrefTitles.add(hrefTitle);
    if (!entry.href.startsWith("/") || entry.href.startsWith("/__perf/")) {
      throw new Error(`Invalid docs search index: href must be public: ${entry.href}`);
    }
    const hrefParts = entry.href.split("#");
    if (hrefParts.length > 2) {
      throw new Error(`Invalid docs search index: malformed anchor in ${entry.href}`);
    }
    const [path, anchor] = hrefParts;
    const route = publicRoutes.get(path!);
    if (route === undefined) {
      throw new Error(
        `Invalid docs search index: href must target an indexed route: ${entry.href}`,
      );
    }
    if (anchor !== undefined) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(anchor)) {
        throw new Error(`Invalid docs search index: malformed anchor in ${entry.href}`);
      }
      const found =
        route.headings?.some((heading) => heading.id === anchor) === true ||
        (path === "/reference/cli" && cliAnchors.has(anchor));
      if (!found) {
        throw new Error(`Invalid docs search index: missing anchor in ${entry.href}`);
      }
    }
    if (entry.href.includes("/examples/interactions/")) {
      throw new Error(
        `Invalid docs search index: alias href is not public canonical: ${entry.href}`,
      );
    }
  }
  return entries;
}

export function generateDocsSearchProjection(entries: readonly DocsSearchEntry[]): Promise<string> {
  const source = `// Generated by bun scripts/gen-docs-search.ts — do not edit.\nimport type { DocsSearchEntry } from "../search-types.js";\n\nexport const DOCS_SEARCH_INDEX = ${JSON.stringify(entries, null, 2)} as const satisfies readonly DocsSearchEntry[];\n`;
  return formatGeneratedSource(OUTPUT_PATH, source);
}

/**
 * Search projection depends on committed routes, manifest, and lifecycle
 * (static imports). dependsOn attributes check failures to the true cause;
 * write refuses to cascade in-process (module graph would keep stale bindings).
 */
export const docsSearchArtifact = defineArtifact({
  path: OUTPUT_PATH,
  label: "apps/docs/src/lib/generated/search-index.ts",
  regenerateWith: "docs:search:gen",
  dependsOn: [docsRoutesArtifact, manifestArtifact, lifecycleArtifact],
  build: () => generateDocsSearchProjection(createDocsSearchEntries()),
});

export async function generateDocsSearch(check = false): Promise<void> {
  if (check) {
    await docsSearchArtifact.check();
    console.log("docs search index is current");
    return;
  }
  await docsSearchArtifact.write();
  console.log(`wrote ${OUTPUT_PATH}`);
}

if (import.meta.main || import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await docsSearchArtifact.cli();
}
