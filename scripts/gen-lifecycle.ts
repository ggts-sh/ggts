/**
 * gen-lifecycle — generates lifecycle.json from the packages' public index
 * files (Hadley lesson 13: lifecycle tags on every public export).
 *
 * Tag sources, in precedence order:
 *   1. a trailing `// @lifecycle <tag>` comment on a name inside an export
 *      brace list;
 *   2. a `/** @lifecycle <tag> *\/` JSDoc comment immediately before an
 *      export statement (applies to every name in that statement);
 *   3. the file default declared as `// @lifecycle-default <tag>` in the
 *      file's header comment (required — a file without one is an error).
 *
 * Tags (meanings documented in CONTRIBUTING.md): "experimental",
 * "stable-intent", "stable", "superseded". stable-intent covers the agent
 * core path (PortableSpec / normalize / validate / renderToSVGString /
 * GGPlot and their direct result contracts) plus recommended Svelte
 * composition children (Geom* shells and grammar children from #659).
 * Everything else defaults to experimental until deliberately promoted.
 *
 * Usage:
 *   bun scripts/gen-lifecycle.ts           # (re)write lifecycle.json
 *   bun scripts/gen-lifecycle.ts --check   # exit 1 if the file is stale
 *     (gen-lifecycle.test.ts also asserts staleness in CI)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { defineArtifact } from "./artifact.ts";

export const LIFECYCLE_TAGS = ["experimental", "stable-intent", "stable", "superseded"] as const;
export type LifecycleTag = (typeof LIFECYCLE_TAGS)[number];

/** The index files defining each package's public surface. */
export const SURFACES: readonly { pkg: string; entry: string; file: string }[] = [
  { pkg: "@ggsvelte/spec", entry: ".", file: "packages/spec/src/index.ts" },
  { pkg: "@ggsvelte/spec", entry: "./portable", file: "packages/spec/src/portable-entry.ts" },
  { pkg: "@ggsvelte/core", entry: ".", file: "packages/core/src/index.ts" },
  { pkg: "@ggsvelte/core", entry: "./interaction", file: "packages/core/src/interaction-entry.ts" },
  { pkg: "@ggsvelte/core", entry: "./data", file: "packages/core/src/data/index.ts" },
  { pkg: "@ggsvelte/core", entry: "./render", file: "packages/core/src/render-entry.ts" },
  { pkg: "@ggsvelte/core", entry: "./headless", file: "packages/core/src/headless-entry.ts" },
  {
    pkg: "@ggsvelte/core",
    entry: "./headless/register",
    file: "packages/core/src/headless-register-entry.ts",
  },
  { pkg: "@ggsvelte/core", entry: "./temporal", file: "packages/core/src/temporal-entry.ts" },
  { pkg: "@ggsvelte/core", entry: "./dom", file: "packages/core/src/dom/index.ts" },
  { pkg: "@ggsvelte/core", entry: "./svg-live", file: "packages/core/src/svg-live/index.ts" },
  { pkg: "@ggsvelte/compose", entry: ".", file: "packages/compose/src/index.ts" },
  { pkg: "@ggsvelte/svelte", entry: ".", file: "packages/svelte/src/lib/index.ts" },
  { pkg: "@ggsvelte/react", entry: ".", file: "packages/react/src/index.ts" },
  { pkg: "@ggsvelte/cli", entry: ".", file: "packages/cli/src/index.ts" },
];

export class LifecycleError extends Error {
  constructor(problems: readonly string[]) {
    super(`lifecycle extraction failed:\n  - ${problems.join("\n  - ")}`);
    this.name = "LifecycleError";
  }
}

export interface ExtractedExport {
  name: string;
  kind: "value" | "type";
  lifecycle: LifecycleTag;
}

function isTag(s: string): s is LifecycleTag {
  return (LIFECYCLE_TAGS as readonly string[]).includes(s);
}

/** Parse one brace-list entry ("Name", "A as B", "default as X") + its tag. */
function parseEntry(
  entry: string,
  rawLine: string,
  nameTagRaw: string | undefined,
  stmtTag: LifecycleTag,
  kind: "value" | "type",
  file: string,
): { export: ExtractedExport } | { problem: string } {
  if (entry.startsWith("type ")) {
    kind = "type";
    entry = entry.slice(5);
  }
  const asMatch = /(?:^|\s)as\s+(\w+)$/.exec(entry);
  const name = asMatch?.[1] ?? entry;
  if (!/^\w+$/.test(name)) {
    return { problem: `${file}: cannot parse export entry "${rawLine.trim()}"` };
  }
  let tag = stmtTag;
  if (nameTagRaw !== undefined) {
    if (!isTag(nameTagRaw)) {
      return { problem: `${file}: unknown lifecycle tag "${nameTagRaw}" on "${name}"` };
    }
    tag = nameTagRaw;
  }
  return { export: { name, kind, lifecycle: tag } };
}

function parseExportStatement(
  match: RegExpMatchArray,
  fileDefault: LifecycleTag,
  file: string,
  out: ExtractedExport[],
  problems: string[],
): void {
  const stmtTagRaw = match[2];
  if (stmtTagRaw !== undefined && !isTag(stmtTagRaw)) {
    problems.push(`${file}: unknown statement lifecycle tag "${stmtTagRaw}"`);
    return;
  }
  const stmtTag: LifecycleTag = stmtTagRaw ?? fileDefault;
  const kind: "value" | "type" = match[3] === undefined ? "value" : "type";
  for (const rawLine of match[4]!.split("\n")) {
    const nameTag = /\/\/ @lifecycle ([a-z-]+)/.exec(rawLine);
    const cleaned = rawLine
      .replace(/\/\/.*$/, "")
      .trim()
      .replace(/,$/, "")
      .trim();
    if (cleaned === "") continue;
    const entries = cleaned
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry !== "");
    if (nameTag !== null && entries.length > 1) {
      problems.push(
        `${file}: a trailing @lifecycle tag on a multi-name line is ambiguous: "${rawLine.trim()}"`,
      );
      continue;
    }
    for (const entry of entries) {
      const parsed = parseEntry(entry, rawLine, nameTag?.[1], stmtTag, kind, file);
      if ("problem" in parsed) problems.push(parsed.problem);
      else out.push(parsed.export);
    }
  }
}

/**
 * Extract exports + lifecycle tags from one index-file source (pure —
 * unit-tested). Only re-export statement forms are allowed in index files;
 * anything else that exports is an error, so nothing can dodge tagging.
 */
export function extractExports(source: string, file: string): ExtractedExport[] {
  const problems: string[] = [];
  const defaultMatch = /\/\/ @lifecycle-default ([a-z-]+)/.exec(source);
  if (defaultMatch === null) {
    throw new LifecycleError([`${file}: missing "// @lifecycle-default <tag>" header marker`]);
  }
  const fileDefault = defaultMatch[1]!;
  if (!isTag(fileDefault)) {
    throw new LifecycleError([`${file}: unknown default lifecycle tag "${fileDefault}"`]);
  }

  const out: ExtractedExport[] = [];
  // Statement matcher: optional preceding one-line JSDoc marker (EXACT form
  // "/** @lifecycle x */" — anything looser can swallow preceding statements
  // through prose comments), then `export [type] { ... } [from "..."];`
  const stmt =
    /(\/\*\* @lifecycle ([a-z-]+) \*\/\s*)?export (type )?\{([^}]*)\}(\s*from\s*"[^"]+")?;/g;
  for (const m of source.matchAll(stmt)) {
    parseExportStatement(m, fileDefault, file, out, problems);
  }
  // Safety: any export form the statement matcher does not cover (declarations,
  // star re-exports, default exports) must not appear in an index file.
  const stripped = source.replaceAll(stmt, "").replaceAll(/\/\*[^]*?\*\//g, "");
  for (const line of stripped.split("\n")) {
    const t = line.trim();
    if (t.startsWith("//")) continue;
    if (/^export\b/.test(t)) {
      problems.push(`${file}: unsupported export form for lifecycle tagging: "${t}"`);
    }
  }
  if (out.length === 0) problems.push(`${file}: no exports found`);
  const seen = new Map<string, "value" | "type">();
  for (const e of out) {
    const prev = seen.get(e.name);
    if (prev === e.kind) problems.push(`${file}: duplicate export "${e.name}"`);
    seen.set(e.name, e.kind);
  }
  if (problems.length > 0) throw new LifecycleError(problems);
  return out.toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Assemble the lifecycle.json document (deterministic). */
export function buildLifecycleDocument(read: (file: string) => string): Record<string, unknown> {
  const surfaces: Record<string, unknown>[] = [];
  for (const surface of SURFACES) {
    const exports = extractExports(read(surface.file), surface.file);
    surfaces.push({
      package: surface.pkg,
      entry: surface.entry,
      source: surface.file,
      exports: Object.fromEntries(
        exports.map((e) => [e.name, { kind: e.kind, lifecycle: e.lifecycle }]),
      ),
    });
  }
  return {
    $comment:
      "GENERATED by scripts/gen-lifecycle.ts — do not edit. Regenerate with `bun run lifecycle:gen`. Tag meanings: CONTRIBUTING.md (Lifecycle policy).",
    tags: LIFECYCLE_TAGS,
    surfaces,
  };
}

export function lifecycleJSON(read: (file: string) => string): string {
  return JSON.stringify(buildLifecycleDocument(read), null, 2) + "\n";
}

const repoRoot = join(import.meta.dir, "..");

/** Shared protocol handle for lifecycle.json (#783). */
export const lifecycleArtifact = defineArtifact({
  path: join(repoRoot, "lifecycle.json"),
  label: "lifecycle.json",
  regenerateWith: "lifecycle:gen",
  build: () => lifecycleJSON((file) => readFileSync(join(repoRoot, file), "utf8")),
});

if (import.meta.main) await lifecycleArtifact.cli();
