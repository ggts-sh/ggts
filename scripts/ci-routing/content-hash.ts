/**
 * Content-hash skip (issue #245) — decide when a *scheduled* job may
 * early-exit success after restoring a validated success marker.
 *
 * Path routing (./routing) decides whether a job is scheduled. This module
 * owns hashing, cache keys, and git digest collection.
 *
 * - Hashes are fail-closed: every matched input path must have a digest.
 * - Expanding JOB_CONTENT_INPUTS changes the patterns string inside the digest
 *   and invalidates old caches.
 * - `bypass_content_cache` is true under force-all or lockfile / ci.yml /
 *   ci-routing / composite-action changes (recipe identity). Path routing may
 *   still skip product jobs for pure CI plumbing; bypass only matters when a
 *   job is scheduled.
 * - Invalidation: bump CONTENT_HASH_SCHEMA, edit a matched input, change
 *   JOB_CONTENT_INPUTS patterns, or set repo variable CI_DISABLE_CONTENT_HASH=1.
 *
 * Path tables: content-hash-inputs.ts. Markers: content-hash-markers.ts.
 * Identity: content-hash-types.ts.
 */
import { createHash } from "node:crypto";

import { type ChangeFlags, type PlanOptions } from "./routing";
import {
  CONTENT_HASH_SCHEMA,
  formatShardKeyPart,
  type CacheableExecution,
  type ExecutionShard,
} from "./content-hash-types";
import { JOB_CONTENT_INPUTS, listJobContentPaths } from "./content-hash-inputs";

export type HashJobInputsOptions = {
  /** Override schema (tests only). Production always uses CONTENT_HASH_SCHEMA. */
  schema?: number;
};

/**
 * Fail-closed content hash. `digests` must be non-empty and is hashed as-is
 * (caller filters via listJobContentPaths + requireJobInputDigests).
 */
export function hashJobInputs(
  execution: CacheableExecution,
  digests: ReadonlyMap<string, string>,
  options: HashJobInputsOptions = {},
): string {
  if (digests.size === 0) {
    throw new Error(`hashJobInputs(${execution}): no input digests`);
  }
  const schema = options.schema ?? CONTENT_HASH_SCHEMA;
  const patterns = JOB_CONTENT_INPUTS[execution];
  const lines: string[] = [
    `schema=${schema}`,
    `execution=${execution}`,
    `patterns=${patterns.join("\0")}`,
  ];
  const paths = [...digests.keys()].toSorted();
  for (const path of paths) {
    const digest = digests.get(path);
    if (digest === undefined || digest.length === 0) {
      throw new Error(`hashJobInputs(${execution}): missing digest for ${path}`);
    }
    lines.push(`${path}\0${digest}`);
  }
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

/**
 * Fail-closed filter: every path in `requiredPaths` must have a non-empty digest.
 */
export function requireJobInputDigests(
  execution: CacheableExecution,
  requiredPaths: readonly string[],
  digests: ReadonlyMap<string, string>,
): Map<string, string> {
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const path of requiredPaths) {
    const digest = digests.get(path);
    if (digest === undefined || digest.length === 0) {
      missing.push(path);
      continue;
    }
    out.set(path, digest);
  }
  if (missing.length > 0) {
    throw new Error(
      `requireJobInputDigests(${execution}): missing digest for ${missing.join(", ")}`,
    );
  }
  return out;
}

export function shouldBypassContentCache(changes: ChangeFlags, options: PlanOptions = {}): boolean {
  if (options.forceAll === true) return true;
  return changes.lockfile || changes.ci_workflow || changes.ci_routing || changes.ci_actions;
}

export type ContentHashCacheKeyInput = {
  execution: CacheableExecution;
  hash: string;
  os: string;
  /** Fan-out leg for sharded component executions. */
  shard?: ExecutionShard;
  /** Extra dimensions for matrixed jobs (consumer). */
  matrix?: {
    node: string;
    packageManager: string;
    packageManagerVersion: string;
    svelte: string;
    react: string;
  };
  /**
   * Resolved toolchain versions after setup-node / setup-bun (consumer).
   * Matrix majors alone are not enough: Node/npm patch bumps must miss cache.
   */
  runtime?: {
    nodeVersion: string;
    packageManagerVersion: string;
  };
  /** Playwright / container pin when relevant. */
  containerTag?: string;
};

export function contentHashCacheKey(input: ContentHashCacheKeyInput): string {
  const parts = [`ggsvelte-ch-v${CONTENT_HASH_SCHEMA}`, input.execution, sanitizeKeyPart(input.os)];
  if (input.containerTag !== undefined && input.containerTag.length > 0) {
    parts.push(sanitizeKeyPart(input.containerTag));
  }
  if (input.shard !== undefined) {
    parts.push(formatShardKeyPart(input.shard));
  }
  if (input.matrix !== undefined) {
    parts.push(
      `node${sanitizeKeyPart(input.matrix.node)}`,
      sanitizeKeyPart(input.matrix.packageManager),
      `pm${sanitizeKeyPart(input.matrix.packageManagerVersion)}`,
      `svelte${sanitizeKeyPart(input.matrix.svelte)}`,
      `react${sanitizeKeyPart(input.matrix.react)}`,
    );
  }
  if (input.runtime !== undefined) {
    parts.push(
      `runtime-node${sanitizeKeyPart(input.runtime.nodeVersion)}`,
      `runtime-pm${sanitizeKeyPart(input.runtime.packageManagerVersion)}`,
    );
  }
  parts.push(input.hash);
  return parts.join("-");
}

function sanitizeKeyPart(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]+/g, "");
}

/** Parse one `git ls-tree -r` line into mode/type/oid/path. */
export function parseGitLsTreeLine(
  line: string,
): { mode: string; type: string; oid: string; path: string } | null {
  if (line.length === 0) return null;
  // <mode> <type> <oid>\t<path>
  const tab = line.indexOf("\t");
  if (tab < 0) return null;
  const meta = line.slice(0, tab);
  const path = line.slice(tab + 1);
  const parts = meta.split(" ");
  if (parts.length < 3) return null;
  const mode = parts[0];
  const type = parts[1];
  const oid = parts[2];
  if (
    mode === undefined ||
    type === undefined ||
    oid === undefined ||
    oid.length === 0 ||
    path.length === 0
  ) {
    return null;
  }
  return { mode, type, oid, path };
}

/**
 * Tree-entry digest includes mode so executable-bit flips miss the cache
 * (blob OID alone is unchanged on mode-only edits).
 */
export function formatTreeEntryDigest(mode: string, oid: string): string {
  return `${mode}:${oid}`;
}

/**
 * Playwright container jobs may run as root while the checkout is owned by
 * the Actions runner user — git then refuses `ls-tree` with "dubious ownership".
 * Mark the worktree safe before hashing (idempotent).
 *
 * Do not discover the path via `git rev-parse`: that command is itself rejected
 * under dubious ownership (empty topOut → no-op → ls-tree still fails). Use
 * process.cwd() and GITHUB_WORKSPACE instead.
 */
async function ensureGitSafeDirectory(): Promise<void> {
  const dirs = new Set<string>();
  const cwd = process.cwd();
  if (cwd.length > 0) dirs.add(cwd);
  const workspace = process.env["GITHUB_WORKSPACE"];
  if (workspace !== undefined && workspace.length > 0) dirs.add(workspace);

  for (const dir of dirs) {
    const mark = Bun.spawn(["git", "config", "--global", "--add", "safe.directory", dir], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await mark.exited;
  }
}

/**
 * Collect blob digests for HEAD via `git ls-tree -r`. Fail-closed on git errors
 * or missing digests for matched paths. Digests are `mode:oid` (not oid alone).
 */
export async function collectGitHeadInputDigests(
  execution: CacheableExecution,
): Promise<{ paths: string[]; digests: Map<string, string>; hash: string }> {
  await ensureGitSafeDirectory();
  const proc = Bun.spawn(["git", "ls-tree", "-r", "HEAD"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`git ls-tree failed (exit ${code}): ${stderr.trim()}`);
  }

  const allDigests = new Map<string, string>();
  for (const line of stdout.split(/\r?\n/)) {
    const entry = parseGitLsTreeLine(line);
    if (entry === null) continue;
    if (entry.type !== "blob") continue;
    allDigests.set(entry.path, formatTreeEntryDigest(entry.mode, entry.oid));
  }

  const paths = listJobContentPaths(execution, [...allDigests.keys()]);
  if (paths.length === 0) {
    throw new Error(`collectGitHeadInputDigests(${execution}): no paths matched content inputs`);
  }
  const digests = requireJobInputDigests(execution, paths, allDigests);
  const hash = hashJobInputs(execution, digests);
  return { paths, digests, hash };
}
