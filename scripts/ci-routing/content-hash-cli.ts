/**
 * Content-hash CLI commands: hash-inputs, write-success-marker, validate-success-marker.
 * Pure hash/marker logic lives in content-hash*.ts; this is argv/env surface.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import {
  CACHEABLE_EXECUTIONS,
  CONTENT_HASH_SCHEMA,
  type CacheableExecution,
  type ExecutionShard,
} from "./content-hash-types";
import {
  parseSuccessMarker,
  serializeSuccessMarker,
  successMarkerPath,
  validateSuccessMarker,
} from "./content-hash-markers";
import { collectGitHeadInputDigests, contentHashCacheKey } from "./content-hash";
import { flagValue, writeGithubOutput } from "./cli-io";

function parseCacheableExecution(raw: string | undefined): CacheableExecution {
  if (raw === undefined || raw.length === 0) {
    throw new Error("--execution <name> is required");
  }
  if (!(CACHEABLE_EXECUTIONS as readonly string[]).includes(raw)) {
    throw new Error(
      `unknown execution "${raw}"; expected one of: ${CACHEABLE_EXECUTIONS.join(", ")}`,
    );
  }
  return raw as CacheableExecution;
}

/**
 * `--shard <index>/<total>` (1-based), matching the vitest / playwright CLI
 * spelling the component jobs already pass through. Absent means unsharded.
 * Fail-closed: a malformed value must not silently degrade to unsharded, or a
 * typo in a matrix leg would make every leg share one marker.
 */
function parseShardFlag(args: string[]): ExecutionShard | undefined {
  const raw = flagValue(args, "--shard");
  if (raw === undefined) return undefined;
  const match = /^(\d+)\/(\d+)$/.exec(raw);
  if (match === null) {
    throw new Error(`--shard must look like <index>/<total> (1-based); got "${raw}"`);
  }
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (total < 1 || index < 1 || index > total) {
    throw new Error(`--shard index must be within 1..total; got "${raw}"`);
  }
  return { index, total };
}

export async function runHashInputsCli(args: string[]): Promise<void> {
  const execution = parseCacheableExecution(flagValue(args, "--execution"));
  const os = flagValue(args, "--os") ?? process.env["RUNNER_OS"] ?? "unknown";
  const containerTag = flagValue(args, "--container-tag");
  const shard = parseShardFlag(args);
  const matrixNode = flagValue(args, "--matrix-node");
  const matrixPm = flagValue(args, "--matrix-pm");
  const matrixPmVersion = flagValue(args, "--matrix-pm-version");
  const matrixSvelte = flagValue(args, "--matrix-svelte");
  const matrixReact = flagValue(args, "--matrix-react");
  const runtimeNodeVersion = flagValue(args, "--runtime-node-version");
  const runtimePmVersion = flagValue(args, "--runtime-pm-version");

  const { hash, paths } = await collectGitHeadInputDigests(execution);
  const matrix =
    matrixNode !== undefined &&
    matrixPm !== undefined &&
    matrixPmVersion !== undefined &&
    matrixSvelte !== undefined &&
    matrixReact !== undefined
      ? {
          node: matrixNode,
          packageManager: matrixPm,
          packageManagerVersion: matrixPmVersion,
          svelte: matrixSvelte,
          react: matrixReact,
        }
      : undefined;

  const runtime =
    runtimeNodeVersion !== undefined &&
    runtimeNodeVersion.length > 0 &&
    runtimePmVersion !== undefined &&
    runtimePmVersion.length > 0
      ? { nodeVersion: runtimeNodeVersion, packageManagerVersion: runtimePmVersion }
      : undefined;

  if (execution === "consumer" && (matrix === undefined || runtime === undefined)) {
    throw new Error(
      "hash-inputs consumer requires --matrix-* and --runtime-node-version / --runtime-pm-version",
    );
  }

  // Absent flags are omitted rather than passed as explicit `undefined`:
  // contentHashCacheKey's optional dimensions are omit-or-provide by contract
  // (exactOptionalPropertyTypes), and each one it sees adds a key segment.
  const cacheKey = contentHashCacheKey({
    execution,
    hash,
    os,
    ...(containerTag === undefined ? {} : { containerTag }),
    ...(shard === undefined ? {} : { shard }),
    ...(matrix === undefined ? {} : { matrix }),
    ...(runtime === undefined ? {} : { runtime }),
  });
  const marker = successMarkerPath(execution, shard);
  const body = [
    `hash=${hash}`,
    `cache_key=${cacheKey}`,
    `marker_path=${marker}`,
    `path_count=${paths.length}`,
    `execution=${execution}`,
  ].join("\n");

  writeGithubOutput(`${body}\n`);
  process.stdout.write(`${body}\n`);
}

export function runWriteSuccessMarkerCli(args: string[]): void {
  const execution = parseCacheableExecution(flagValue(args, "--execution"));
  const hash = flagValue(args, "--hash");
  if (hash === undefined || hash.length === 0) {
    throw new Error("write-success-marker requires --hash <hex>");
  }
  const shard = parseShardFlag(args);
  const path = successMarkerPath(execution, shard);
  const dir = path.slice(0, path.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path,
    serializeSuccessMarker({
      schema: CONTENT_HASH_SCHEMA,
      execution,
      hash,
      ...(shard === undefined ? {} : { shard }),
    }),
    "utf8",
  );
  process.stdout.write(`${path}\n`);
}

export async function runValidateSuccessMarkerCli(args: string[]): Promise<void> {
  const execution = parseCacheableExecution(flagValue(args, "--execution"));
  const hash = flagValue(args, "--hash");
  if (hash === undefined || hash.length === 0) {
    throw new Error("validate-success-marker requires --hash <hex>");
  }
  const shard = parseShardFlag(args);
  const path = successMarkerPath(execution, shard);
  const file = Bun.file(path);
  if (!(await file.exists())) {
    process.stdout.write("hit=false\n");
    writeGithubOutput("hit=false\n");
    return;
  }
  const body = await file.text();
  const marker = parseSuccessMarker(body);
  const ok = validateSuccessMarker(marker, {
    execution,
    hash,
    ...(shard === undefined ? {} : { shard }),
  });
  const line = `hit=${ok ? "true" : "false"}\n`;
  process.stdout.write(line);
  writeGithubOutput(line);
  if (!ok) {
    process.exitCode = 0; // miss is not a failure — caller runs full job
  }
}
