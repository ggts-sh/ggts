/**
 * Stage GitHub release notes for package versions that need a release entry.
 *
 * Runs WITHOUT GITHUB_TOKEN. Writes a staging directory that a later
 * script-free workflow step (`gh`/`git` only) consumes to create tags and
 * GitHub releases.
 *
 * Include set:
 *   - every local packages/* version that is already on npm (recovery), and
 *   - every tag listed in just-published.txt from this run's publish step
 *     (covers registry visibility lag after a successful publish).
 *
 * Per-tag target commits: prefer the last commit that introduced that
 * package.json version (so recovery tags do not point at unrelated HEAD work);
 * fall back to HEAD when git history cannot resolve it.
 *
 * Staging layout (RELEASE_STAGING_DIR):
 *   tags.txt        one tag per line, in order
 *   notes/0.md      notes for tags.txt line 0
 *   targets/0.txt   commit SHA for that tag
 *   just-published.txt  (optional input from publish-unpublished)
 *
 * Usage: RELEASE_STAGING_DIR=/tmp/stage bun scripts/stage-github-releases.ts
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  changelogSectionForVersion,
  probeNpmVersions,
  parsePackageReleaseTag,
  planGithubReleaseStaging,
  readPublishedPackageVersions,
  type PackageVersion,
} from "./npm-publish-state.ts";

function notesForPackage(root: string, pkg: PackageVersion): string {
  const tag = `${pkg.name}@${pkg.version}`;
  const changelogPath = join(root, pkg.dir, "CHANGELOG.md");
  if (!existsSync(changelogPath)) return `Release ${tag}`;
  const section = changelogSectionForVersion(readFileSync(changelogPath, "utf8"), pkg.version);
  if (section === null || section.length === 0) return `Release ${tag}`;
  return section;
}

function gitHeadSha(): string {
  const res = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  if (res.status !== 0) throw new Error("git rev-parse HEAD failed");
  return (res.stdout ?? "").trim();
}

/**
 * Last commit that introduced `"version": "<v>"` into this package.json.
 * Falls back to HEAD when the search finds nothing (shallow clone, etc.).
 */
export function commitForPackageVersion(
  pkg: PackageVersion,
  head: string,
  gitLog: (args: string[]) => string | null = defaultGitLog,
): string {
  const needle = `"version": "${pkg.version}"`;
  const sha = gitLog(["log", "-1", "--format=%H", "-S", needle, "--", `${pkg.dir}/package.json`]);
  if (sha !== null && sha.length > 0) return sha;
  return head;
}

function defaultGitLog(args: string[]): string | null {
  const res = spawnSync("git", args, { encoding: "utf8" });
  if (res.status !== 0) return null;
  const out = (res.stdout ?? "").trim();
  return out.length > 0 ? out : null;
}

function readJustPublishedTags(staging: string): Set<string> {
  const path = join(staging, "just-published.txt");
  if (!existsSync(path)) return new Set();
  const keys = new Set<string>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const tag = line.trim();
    if (tag.length === 0) continue;
    const parsed = parsePackageReleaseTag(tag);
    if (parsed === null) continue;
    keys.add(`${parsed.name}@${parsed.version}`);
  }
  return keys;
}

async function main(): Promise<number> {
  const staging = process.env["RELEASE_STAGING_DIR"];
  if (staging === undefined || staging.length === 0) {
    console.error("stage-github-releases: RELEASE_STAGING_DIR is required");
    return 1;
  }

  const root = process.cwd();
  const local = readPublishedPackageVersions(root);
  if (local.length === 0) {
    console.error("stage-github-releases: no published packages under packages/");
    return 1;
  }

  const includeKeys = readJustPublishedTags(staging);
  // Retries: post-publish negative-cache lag after publish-unpublished's 404 probes.
  for await (const { pkg, exists } of probeNpmVersions(local, { retries: 5, retryDelayMs: 2000 })) {
    if (exists) {
      includeKeys.add(`${pkg.name}@${pkg.version}`);
    }
  }

  const entries = planGithubReleaseStaging(local, includeKeys, (pkg) => notesForPackage(root, pkg));
  const head = gitHeadSha();
  const byTag = new Map<string, PackageVersion>(
    local.map((pkg) => [`${pkg.name}@${pkg.version}`, pkg]),
  );

  mkdirSync(join(staging, "notes"), { recursive: true });
  mkdirSync(join(staging, "targets"), { recursive: true });
  const tagLines: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry === undefined) continue;
    writeFileSync(join(staging, "notes", `${String(i)}.md`), entry.notes, "utf8");
    const pkg = byTag.get(entry.tag);
    const target = pkg === undefined ? head : commitForPackageVersion(pkg, head);
    writeFileSync(join(staging, "targets", `${String(i)}.txt`), `${target}\n`, "utf8");
    tagLines.push(entry.tag);
    console.log(`staged ${entry.tag} → ${target}`);
  }
  writeFileSync(
    join(staging, "tags.txt"),
    tagLines.length === 0 ? "" : `${tagLines.join("\n")}\n`,
    "utf8",
  );

  console.log(
    `stage-github-releases: staged ${String(tagLines.length)} release(s) under ${staging}`,
  );
  return 0;
}

if (import.meta.main) {
  try {
    process.exit(await main());
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
