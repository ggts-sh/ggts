/**
 * Provenance for gallery preview PNGs (#746).
 *
 * A present, projection-consistent PNG can still be stale: example sources
 * changed and nobody recaptured. Capture writes provenance; gen --check
 * verifies it. Gen never writes provenance (that would silence the gate).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";

import type { ExampleManifestEntry } from "../examples/manifest.js";

export const PROVENANCE_VERSION = 1 as const;
export const PROVENANCE_FILENAME = "provenance.json";

/** Same mapping as `canonicalPreviewFilename` in gen-gallery-previews (kept local to avoid import cycles). */
function previewFilename(id: string): string {
  return `${id.replaceAll("/", "-")}-light.png`;
}

/** Files ignored while walking an example directory (OS junk only). */
const EXCLUDED_BASENAMES = new Set([".DS_Store", "Thumbs.db"]);

export interface ProvenanceEntry {
  readonly filename: string;
  readonly sourceSha256: string;
  readonly pngSha256: string;
}

export interface GalleryPreviewProvenance {
  readonly version: typeof PROVENANCE_VERSION;
  readonly entries: Readonly<Record<string, ProvenanceEntry>>;
}

export function provenancePath(previewsDir: string): string {
  return join(previewsDir, PROVENANCE_FILENAME);
}

export function pngDigest(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isExcluded(name: string): boolean {
  return EXCLUDED_BASENAMES.has(name) || name.startsWith(".");
}

/** Sorted relative paths of every regular file under `dir` (recursive). */
export function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) throw new Error(`example source directory missing: ${dir}`);
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const name of readdirSync(current).toSorted()) {
      if (isExcluded(name)) continue;
      const full = join(current, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!st.isFile()) continue;
      out.push(relative(dir, full).split(sep).join("/"));
    }
  };
  walk(dir);
  return out.toSorted();
}

type DependencyScope = "shared" | "package" | "all";

function scanExampleSource(
  exampleDir: string,
  examplesRoot: string,
  scope: DependencyScope,
  onFile?: (relativePath: string, bytes: Buffer) => void,
): { shared: string[]; packages: string[] } {
  const ownRoot = resolve(exampleDir);
  const ownPrefix = ownRoot + sep;
  const examplesPrefix = resolve(examplesRoot) + sep;
  const repoRoot = resolve(examplesRoot, "..");
  const dataRoot = resolve(repoRoot, "packages/core/src/data");
  const dataPrefix = dataRoot + sep;
  const shared = new Set<string>();
  const packages = new Set<string>();
  const importRe = /from\s+["'](\.\.[^"']+)["']/g;

  for (const rel of listSourceFiles(exampleDir)) {
    const bytes = readFileSync(join(exampleDir, rel));
    onFile?.(rel, bytes);
    for (const match of bytes.toString("utf8").matchAll(importRe)) {
      const spec = match[1];
      if (spec === undefined) continue;
      const resolved = resolve(exampleDir, dirname(rel), spec);
      const isShared =
        scope !== "package" &&
        resolved.startsWith(examplesPrefix) &&
        resolved !== ownRoot &&
        !resolved.startsWith(ownPrefix);
      const isPackage =
        scope !== "shared" && (resolved === dataRoot || resolved.startsWith(dataPrefix));
      if (!isShared && !isPackage) continue;

      const candidates = [resolved];
      if (resolved.endsWith(".js")) candidates.push(resolved.slice(0, -3) + ".ts");
      for (const candidate of candidates) {
        if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
        if (isShared) shared.add(relative(examplesRoot, candidate).split(sep).join("/"));
        if (isPackage) packages.add(relative(repoRoot, candidate).split(sep).join("/"));
        break;
      }
    }
  }

  shared.delete("define.ts");
  shared.delete("define.js");
  return { shared: [...shared].toSorted(), packages: [...packages].toSorted() };
}

/**
 * Relative imports that escape the example dir into other `examples/` files
 * (e.g. `../../rng.js`). `define.js` is validation-only and excluded.
 */
export function sharedExampleSourcePaths(exampleDir: string, examplesRoot: string): string[] {
  return scanExampleSource(exampleDir, examplesRoot, "shared").shared;
}

/**
 * Repo-relative paths of `@ggts-sh/core/data` teaching tables imported from
 * an example (e.g. `packages/core/src/data/chocolate-bars.ts`). Hashed so
 * gallery provenance notices package-data edits that change rendered previews.
 */
export function packageDataSourcePaths(exampleDir: string, examplesRoot: string): string[] {
  return scanExampleSource(exampleDir, examplesRoot, "package").packages;
}

/**
 * Deterministic sha256 over the whole example directory tree plus any
 * in-repo shared sources it imports (sorted path labels, raw bytes).
 */
export function exampleSourceDigest(examplesRoot: string, exampleId: string): string {
  const exampleDir = join(examplesRoot, ...exampleId.split("/"));
  const repoRoot = resolve(examplesRoot, "..");
  const hash = createHash("sha256");
  const sources = scanExampleSource(exampleDir, examplesRoot, "all", (rel, bytes) => {
    hash.update(rel);
    hash.update("\0");
    hash.update(bytes);
    hash.update("\0");
  });
  for (const shared of sources.shared) {
    hash.update(`shared:${shared}`);
    hash.update("\0");
    hash.update(readFileSync(join(examplesRoot, shared)));
    hash.update("\0");
  }
  for (const pkg of sources.packages) {
    hash.update(`pkg:${pkg}`);
    hash.update("\0");
    hash.update(readFileSync(join(repoRoot, pkg)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function emptyProvenance(): GalleryPreviewProvenance {
  return { version: PROVENANCE_VERSION, entries: {} };
}

export function loadProvenance(path: string): GalleryPreviewProvenance {
  if (!existsSync(path)) {
    throw new Error(
      `Missing gallery preview provenance: ${PROVENANCE_FILENAME}. Capture previews with bun run gallery:previews:capture, then bun run gallery:previews:gen.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Gallery preview provenance is not valid JSON`, {
      cause: error,
    });
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("Gallery preview provenance must be an object");
  }
  const record = parsed as { version?: unknown; entries?: unknown };
  if (record.version !== PROVENANCE_VERSION) {
    throw new Error(
      `Gallery preview provenance version unsupported (got ${String(record.version)}, want ${String(PROVENANCE_VERSION)})`,
    );
  }
  if (
    record.entries === null ||
    typeof record.entries !== "object" ||
    Array.isArray(record.entries)
  ) {
    throw new TypeError("Gallery preview provenance.entries must be an object");
  }
  const entries: Record<string, ProvenanceEntry> = {};
  for (const [id, value] of Object.entries(record.entries as Record<string, unknown>)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`Gallery preview provenance entry invalid: ${id}`);
    }
    const entry = value as {
      filename?: unknown;
      sourceSha256?: unknown;
      pngSha256?: unknown;
    };
    if (
      typeof entry.filename !== "string" ||
      typeof entry.sourceSha256 !== "string" ||
      typeof entry.pngSha256 !== "string"
    ) {
      throw new TypeError(`Gallery preview provenance entry incomplete: ${id}`);
    }
    entries[id] = {
      filename: entry.filename,
      sourceSha256: entry.sourceSha256,
      pngSha256: entry.pngSha256,
    };
  }
  return { version: PROVENANCE_VERSION, entries };
}

export function serializeProvenance(provenance: GalleryPreviewProvenance): string {
  const ids = Object.keys(provenance.entries).toSorted();
  const entries: Record<string, ProvenanceEntry> = {};
  for (const id of ids) {
    const entry = provenance.entries[id];
    if (entry === undefined) continue;
    entries[id] = entry;
  }
  return `${JSON.stringify({ version: PROVENANCE_VERSION, entries }, null, 2)}\n`;
}

export function writeProvenance(path: string, provenance: GalleryPreviewProvenance): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeProvenance(provenance));
}

/** Merge one example's capture into provenance (preserves other ids). */
export function upsertProvenanceEntry(
  provenance: GalleryPreviewProvenance,
  id: string,
  entry: ProvenanceEntry,
): GalleryPreviewProvenance {
  return {
    version: PROVENANCE_VERSION,
    entries: { ...provenance.entries, [id]: entry },
  };
}

/**
 * Drop provenance entries whose ids are not in `keepIds` (deleted examples).
 * Does not rewrite digests for remaining entries — closed-set hygiene only.
 */
export function pruneProvenanceToIds(
  provenance: GalleryPreviewProvenance,
  keepIds: ReadonlySet<string>,
): GalleryPreviewProvenance {
  const entries: Record<string, ProvenanceEntry> = {};
  for (const [id, entry] of Object.entries(provenance.entries)) {
    if (keepIds.has(id)) entries[id] = entry;
  }
  return { version: PROVENANCE_VERSION, entries };
}

export interface ProvenanceCheckContext {
  readonly examplesRoot: string;
  readonly previewsDir: string;
  readonly entries: readonly ExampleManifestEntry[];
  readonly provenance: GalleryPreviewProvenance;
}

/**
 * Verify provenance covers the closed EXAMPLE set, source digests match,
 * PNG digests match on disk, and filenames match the canonical mapping.
 * Aggregates every drift into one error (issue acceptance: name id(s)).
 */
export function assertPreviewProvenance(ctx: ProvenanceCheckContext): void {
  const problems: string[] = [];
  const expectedIds = new Set(ctx.entries.map((entry) => entry.id));
  const recordedIds = new Set(Object.keys(ctx.provenance.entries));

  for (const id of recordedIds) {
    if (!expectedIds.has(id)) {
      problems.push(`${id}: unexpected provenance entry (not in example manifest)`);
    }
  }

  for (const entry of ctx.entries) {
    const recorded = ctx.provenance.entries[entry.id];
    const filename = previewFilename(entry.id);
    if (recorded === undefined) {
      problems.push(`${entry.id}: missing provenance entry`);
      continue;
    }
    if (recorded.filename !== filename) {
      problems.push(`${entry.id}: provenance filename ${recorded.filename} !== ${filename}`);
    }
    let sourceSha: string;
    try {
      sourceSha = exampleSourceDigest(ctx.examplesRoot, entry.id);
    } catch (error) {
      problems.push(`${entry.id}: cannot hash sources (${String(error)})`);
      continue;
    }
    if (sourceSha !== recorded.sourceSha256) {
      problems.push(
        `${entry.id}: source files changed since capture (run bun run gallery:previews:capture then bun run gallery:previews:gen)`,
      );
    }
    const pngPath = join(ctx.previewsDir, filename);
    if (!existsSync(pngPath)) {
      problems.push(`${entry.id}: missing preview PNG ${filename}`);
      continue;
    }
    const pngSha = pngDigest(pngPath);
    if (pngSha !== recorded.pngSha256) {
      problems.push(`${entry.id}: preview PNG bytes do not match provenance (recapture required)`);
    }
  }

  if (problems.length === 0) return;
  throw new Error(
    `Stale or incomplete gallery preview provenance (${String(problems.length)}):\n${problems.map((line) => `  - ${line}`).join("\n")}`,
  );
}

/**
 * Build a provenance entry for a just-captured (or already-on-disk) preview.
 * Used by capture after screenshot; also used for one-off seeding in this PR.
 */
export function provenanceEntryFor(
  examplesRoot: string,
  previewsDir: string,
  exampleId: string,
): ProvenanceEntry {
  const filename = previewFilename(exampleId);
  const pngPath = join(previewsDir, filename);
  if (!existsSync(pngPath)) {
    throw new Error(`Missing gallery preview PNG for provenance: ${filename}`);
  }
  return {
    filename,
    sourceSha256: exampleSourceDigest(examplesRoot, exampleId),
    pngSha256: pngDigest(pngPath),
  };
}
