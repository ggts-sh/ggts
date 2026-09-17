/**
 * gen-manifest — generates examples/manifest.ts from the example corpus
 * (plan: "one source, three uses" — the manifest feeds the docs gallery, the
 * VR matrix, and llms-full.txt).
 *
 * Contract per example: examples/<category>/<name>/{spec.ts, Example.svelte,
 * meta.json, data.ts?}. meta.json carries {title, description, tags,
 * docsSection, vrHeight?, vrWidth?, journey?}. Output ordering is stable (codepoint sort by
 * category, then name), ids are collision-checked, and metas are validated —
 * all unit-tested in gen-manifest.test.ts.
 *
 * Usage:
 *   bun scripts/gen-manifest.ts           # (re)write examples/manifest.ts
 *   bun scripts/gen-manifest.ts --check   # exit 1 if the file is stale
 *     (the manifest-current pre-commit hook + CI parity run --check)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { defineArtifact } from "./artifact.ts";
import { buildReactBacklogMarkdown } from "./react-example-backlog.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExampleMeta {
  title: string;
  /** Page subtitle; omit or empty to show no lede (AI-slop deleted, not rewritten). */
  description?: string;
  tags: readonly string[];
  docsSection: string;
  vrHeight?: number;
  vrWidth?: number;
  journey?: ExampleJourney;
}

export interface ExampleReference {
  label: string;
  href: string;
}

export interface ExampleJourney {
  /** Optional modality copy; omit all three to hide the Interaction section. */
  pointer?: string;
  keyboard?: string;
  touch?: string;
  references?: readonly ExampleReference[];
  svelteFirst: boolean;
  fullWidth: boolean;
}

export interface DiscoveredExample extends ExampleMeta {
  /** "<category>/<name>" — the docs route and the VR snapshot key. */
  id: string;
  category: string;
  name: string;
  /** Whether the example ships a data.ts module. */
  hasData: boolean;
  /** Whether the example ships a verified React host (Example.tsx). */
  hasReact: boolean;
}

export class ManifestError extends Error {
  constructor(problems: readonly string[]) {
    super(
      `examples/ corpus is invalid (${problems.length} problem(s)):\n  - ${problems.join("\n  - ")}`,
    );
    this.name = "ManifestError";
  }
}

// ---------------------------------------------------------------------------
// Meta validation (pure — unit-tested)
// ---------------------------------------------------------------------------

const META_KEYS = new Set([
  "title",
  "description",
  "tags",
  "docsSection",
  "vrHeight",
  "vrWidth",
  "journey",
]);
const JOURNEY_KEYS = new Set([
  "pointer",
  "keyboard",
  "touch",
  "references",
  "svelteFirst",
  "fullWidth",
]);
const REFERENCE_KEYS = new Set(["label", "href"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownKeyProblems(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  prefix: string,
): string[] {
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) => `${prefix} has unknown key "${key}"`);
}

function validateJourneyReferences(references: unknown, id: string): string[] {
  if (!Array.isArray(references) || references.length === 0) {
    return [`${id}: meta.json "journey.references" must be a non-empty array when set`];
  }
  const problems: string[] = [];
  for (const [index, reference] of references.entries()) {
    const prefix = `${id}: meta.json "journey.references[${String(index)}]"`;
    if (!isRecord(reference)) {
      problems.push(`${prefix} must be an object`);
      continue;
    }
    problems.push(...unknownKeyProblems(reference, REFERENCE_KEYS, prefix));
    if (typeof reference["label"] !== "string" || reference["label"].trim() === "") {
      problems.push(`${prefix}.label must be a non-empty string`);
    }
    const href = reference["href"];
    if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) {
      problems.push(`${prefix}.href must be a root-relative internal link`);
    }
  }
  return problems;
}

function validateJourney(journey: unknown, id: string): string[] {
  const problems: string[] = [];
  if (!isRecord(journey)) {
    return [`${id}: meta.json "journey" must be an object when present`];
  }
  const j = journey;
  problems.push(...unknownKeyProblems(j, JOURNEY_KEYS, `${id}: meta.json "journey"`));
  for (const key of ["pointer", "keyboard", "touch"] as const) {
    if (j[key] === undefined) continue;
    if (typeof j[key] !== "string" || j[key].trim() === "") {
      problems.push(`${id}: meta.json "journey.${key}" must be a non-empty string when set`);
    }
  }
  for (const key of ["svelteFirst", "fullWidth"] as const) {
    if (typeof j[key] !== "boolean") {
      problems.push(`${id}: meta.json "journey.${key}" must be a boolean`);
    }
  }
  const references = j["references"];
  if (references === undefined) return problems;
  problems.push(...validateJourneyReferences(references, id));
  return problems;
}

/** Validate one parsed meta.json; returns problem strings (empty = valid). */
export function validateMeta(meta: unknown, id: string): string[] {
  const problems: string[] = [];
  if (!isRecord(meta)) {
    return [`${id}: meta.json must be a JSON object`];
  }
  const m = meta;
  problems.push(...unknownKeyProblems(m, META_KEYS, `${id}: meta.json`));
  for (const key of ["title", "docsSection"] as const) {
    const v = m[key];
    if (typeof v !== "string" || v.trim() === "") {
      problems.push(`${id}: meta.json "${key}" must be a non-empty string`);
    }
  }
  // description is optional: omit or "" means no page subtitle (delete-not-rewrite).
  if (m["description"] !== undefined && typeof m["description"] !== "string") {
    problems.push(`${id}: meta.json "description" must be a string when present`);
  }
  const tags = m["tags"];
  if (
    !Array.isArray(tags) ||
    tags.length === 0 ||
    tags.some((t) => typeof t !== "string" || t.trim() === "")
  ) {
    problems.push(`${id}: meta.json "tags" must be a non-empty array of non-empty strings`);
  }
  const vrHeight = m["vrHeight"];
  if (
    vrHeight !== undefined &&
    (typeof vrHeight !== "number" || !Number.isFinite(vrHeight) || vrHeight <= 0)
  ) {
    problems.push(`${id}: meta.json "vrHeight" must be a positive number when present`);
  }
  const vrWidth = m["vrWidth"];
  if (
    vrWidth !== undefined &&
    (typeof vrWidth !== "number" || !Number.isFinite(vrWidth) || vrWidth <= 0)
  ) {
    problems.push(`${id}: meta.json "vrWidth" must be a positive number when present`);
  }
  const journey = m["journey"];
  if (journey !== undefined) problems.push(...validateJourney(journey, id));
  return problems;
}

// ---------------------------------------------------------------------------
// Ordering + collision detection (pure — unit-tested)
// ---------------------------------------------------------------------------

/** Stable, locale-independent ordering: category then name, by codepoint. */
export function sortExamples(examples: readonly DiscoveredExample[]): DiscoveredExample[] {
  return examples.toSorted((a, b) => {
    if (a.category !== b.category) return a.category < b.category ? -1 : 1;
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return 0;
  });
}

/**
 * Detect id collisions. Ids are compared case-insensitively: macOS's
 * case-insensitive filesystem would silently merge "Bar" and "bar" while
 * Linux (CI, the VR container) would not — refuse the ambiguity everywhere.
 */
export function findCollisions(examples: readonly DiscoveredExample[]): string[] {
  const seen = new Map<string, string>();
  const problems: string[] = [];
  for (const ex of examples) {
    const key = ex.id.toLowerCase();
    const prev = seen.get(key);
    if (prev === undefined) {
      seen.set(key, ex.id);
    } else {
      problems.push(`id collision (case-insensitive): "${prev}" vs "${ex.id}"`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Source emission (pure — unit-tested for byte stability)
// ---------------------------------------------------------------------------

/** Serialize the manifest module. Deterministic: same input, same bytes. */
export function buildManifestSource(examples: readonly DiscoveredExample[]): string {
  const collisions = findCollisions(examples);
  if (collisions.length > 0) throw new ManifestError(collisions);
  const sorted = sortExamples(examples);
  const entries = sorted
    .map((ex) => {
      const lines = [
        `    id: ${JSON.stringify(ex.id)},`,
        `    category: ${JSON.stringify(ex.category)},`,
        `    name: ${JSON.stringify(ex.name)},`,
        `    title: ${JSON.stringify(ex.title)},`,
        `    description: ${JSON.stringify(ex.description)},`,
        `    tags: [${ex.tags.map((t) => JSON.stringify(t)).join(", ")}],`,
        `    docsSection: ${JSON.stringify(ex.docsSection)},`,
        ...(ex.vrHeight === undefined ? [] : [`    vrHeight: ${String(ex.vrHeight)},`]),
        ...(ex.vrWidth === undefined ? [] : [`    vrWidth: ${String(ex.vrWidth)},`]),
        ...(ex.journey === undefined
          ? []
          : [
              `    journey: {`,
              ...(ex.journey.pointer === undefined
                ? []
                : [`      pointer: ${JSON.stringify(ex.journey.pointer)},`]),
              ...(ex.journey.keyboard === undefined
                ? []
                : [`      keyboard: ${JSON.stringify(ex.journey.keyboard)},`]),
              ...(ex.journey.touch === undefined
                ? []
                : [`      touch: ${JSON.stringify(ex.journey.touch)},`]),
              ...(ex.journey.references === undefined
                ? []
                : [
                    `      references: [`,
                    ...ex.journey.references.map(
                      (reference) =>
                        `        { label: ${JSON.stringify(reference.label)}, href: ${JSON.stringify(reference.href)} },`,
                    ),
                    `      ],`,
                  ]),
              `      svelteFirst: ${String(ex.journey.svelteFirst)},`,
              `      fullWidth: ${String(ex.journey.fullWidth)},`,
              `    },`,
            ]),
        `    hasData: ${String(ex.hasData)},`,
        `    hasReact: ${String(ex.hasReact)},`,
      ];
      return `  {\n${lines.join("\n")}\n  },`;
    })
    .join("\n");
  return `// GENERATED by scripts/gen-manifest.ts — DO NOT EDIT.
// Regenerate with \`bun run manifest:gen\`; the manifest-current pre-commit
// hook (and CI parity) runs \`bun run manifest:check\`.
//
// One source, three uses: this manifest feeds the docs gallery
// (apps/docs), the VR matrix (tests/visual), and llms-full.txt (M3).

export interface ExampleReference {
  readonly label: string;
  readonly href: string;
}

export interface ExampleJourney {
  readonly pointer?: string;
  readonly keyboard?: string;
  readonly touch?: string;
  readonly references?: readonly ExampleReference[];
  readonly svelteFirst: boolean;
  readonly fullWidth: boolean;
}

export interface ExampleManifestEntry {
  /** "<category>/<name>" — docs route slug and VR snapshot key. */
  readonly id: string;
  readonly category: string;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  /** Gallery grouping header on the docs site. */
  readonly docsSection: string;
  /** VR frame height in px (default 400). */
  readonly vrHeight?: number;
  /** VR frame width in px (default 640). */
  readonly vrWidth?: number;
  /** Optional guided interaction journey for runnable examples. */
  readonly journey?: ExampleJourney;
  /** Whether the example ships a data.ts module. */
  readonly hasData: boolean;
  /** Whether the example ships a verified React host (Example.tsx). */
  readonly hasReact: boolean;
}

export const EXAMPLES: readonly ExampleManifestEntry[] = [
${entries}
];
`;
}

// ---------------------------------------------------------------------------
// Filesystem discovery
// ---------------------------------------------------------------------------

const REQUIRED_FILES = ["spec.ts", "Example.svelte", "meta.json"] as const;

/** Directories under examples/ that are not example categories. */
const NON_CATEGORY = new Set(["node_modules"]);

export function discoverExamples(examplesDir: string): DiscoveredExample[] {
  const problems: string[] = [];
  const examples: DiscoveredExample[] = [];
  const categories = readdirSync(examplesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !NON_CATEGORY.has(e.name) && !e.name.startsWith("."))
    .map((e) => e.name);
  for (const category of categories) {
    const names = readdirSync(join(examplesDir, category), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const name of names) {
      const id = `${category}/${name}`;
      const dir = join(examplesDir, category, name);
      for (const file of REQUIRED_FILES) {
        if (!existsSync(join(dir, file))) problems.push(`${id}: missing ${file}`);
      }
      const metaPath = join(dir, "meta.json");
      if (!existsSync(metaPath)) continue;
      let meta: unknown;
      try {
        meta = JSON.parse(readFileSync(metaPath, "utf8"));
      } catch (error) {
        problems.push(`${id}: meta.json is not valid JSON (${String(error)})`);
        continue;
      }
      const metaProblems = validateMeta(meta, id);
      if (metaProblems.length > 0) {
        problems.push(...metaProblems);
        continue;
      }
      const m = meta as ExampleMeta;
      examples.push({
        id,
        category,
        name,
        title: m.title,
        description: typeof m.description === "string" ? m.description : "",
        tags: m.tags,
        docsSection: m.docsSection,
        ...(m.vrHeight === undefined ? {} : { vrHeight: m.vrHeight }),
        ...(m.vrWidth === undefined ? {} : { vrWidth: m.vrWidth }),
        ...(m.journey === undefined ? {} : { journey: m.journey }),
        hasData: existsSync(join(dir, "data.ts")),
        hasReact: existsSync(join(dir, "Example.tsx")),
      });
    }
  }
  if (problems.length > 0) throw new ManifestError(problems);
  return examples;
}

// ---------------------------------------------------------------------------
// CLI (#783 shared protocol)
// ---------------------------------------------------------------------------

const repoRoot = join(import.meta.dir, "..");
const examplesDir = join(repoRoot, "examples");

/** Shared protocol handle for examples/manifest.ts. */
export const manifestArtifact = defineArtifact({
  path: join(examplesDir, "manifest.ts"),
  label: "examples/manifest.ts",
  regenerateWith: "manifest:gen",
  build: () => buildManifestSource(discoverExamples(examplesDir)),
});

export const reactBacklogArtifact = defineArtifact({
  path: join(examplesDir, "REACT.md"),
  label: "examples/REACT.md",
  regenerateWith: "manifest:gen",
  build: () => buildReactBacklogMarkdown(sortExamples(discoverExamples(examplesDir))),
});

if (import.meta.main) {
  await manifestArtifact.cli();
  await reactBacklogArtifact.cli();
}
