/**
 * Changeset visibility check — in-repo changeset-bot equivalent.
 *
 * Changesets only records PRs that add a `.changeset/*.md` file; a PR without
 * one merges silently and never reaches the CHANGELOG or a version bump
 * (release PR #45 shipped ~200 PRs with 4 changelog entries). This script
 * classifies a PR so the workflow can leave a sticky comment — and fail when
 * a changeset would pollute Version Packages for docs/examples-only work.
 *
 * Verdicts:
 * - `changeset-present` — has a changeset and touches shipped package code
 * - `missing` — touches shipped package code, no changeset (advisory only)
 * - `not-needed` — no shipped package code, no changeset
 * - `unwarranted` — **adds** a changeset but no shipped package code (blocks merge)
 *
 * Missing stays non-blocking: internal-only package changes are common and
 * forcing empty changesets is worse than an ignorable comment. Unwarranted
 * blocks: docs/examples/script-only changesets have repeatedly bumped
 * cli/core/spec/svelte with notes that change nothing consumers import.
 *
 * Pure **edits** of already-queued `.changeset/*.md` files (e.g. promoting
 * patch → minor on a pending entry) do not introduce a new release note and
 * are not `unwarranted`. Only status A/R/C (add/rename/copy) count as
 * introducing a changeset; the workflow feeds `git diff --name-status`.
 */

import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type PublishedPackage = {
  /** Repo-relative package dir, e.g. "packages/core". */
  dir: string;
  name: string;
  /** npm `files` entries — the dirs/files that ship in the tarball. */
  shipped: string[];
};

export type Verdict = "changeset-present" | "not-needed" | "missing" | "unwarranted";

export type Decision = {
  verdict: Verdict;
  /** Published files the PR touches (set for `missing`; empty otherwise). */
  touched: string[];
};

/**
 * Read the npm-published workspace packages from packages/*. Published means
 * no `"private": true`; `shipped` mirrors the npm `files` field (the entries
 * that actually reach the tarball — directories and root-level files alike).
 */
export function discoverPublishedPackages(root: string): PublishedPackage[] {
  const packages: PublishedPackage[] = [];
  for (const entry of readdirSync(join(root, "packages"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(root, "packages", entry.name, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name?: string;
      private?: boolean;
      files?: string[];
    };
    if (manifest.private === true || typeof manifest.name !== "string") continue;
    packages.push({
      dir: `packages/${entry.name}`,
      name: manifest.name,
      shipped: manifest.files ?? [],
    });
  }
  return packages.toSorted((a, b) => a.dir.localeCompare(b.dir));
}

/** Hidden marker the workflow greps for to find/update its own comment. */
export const COMMENT_MARKER = "<!-- ggsvelte-changeset-check -->";

const LISTING_CAP = 10;

export function renderComment(decision: Decision): string {
  if (decision.verdict === "changeset-present") {
    return `${COMMENT_MARKER}\n✅ **Changeset detected.** This PR's changes will appear in the next Version Packages PR and CHANGELOG.\n`;
  }
  if (decision.verdict === "not-needed") {
    return `${COMMENT_MARKER}\n**No changeset needed.** This PR does not touch npm-published package code.\n`;
  }
  if (decision.verdict === "unwarranted") {
    return [
      COMMENT_MARKER,
      "🚫 **Changeset not allowed here.** This PR adds a `.changeset/*.md` file",
      "but does **not** change any npm-published package surface.",
      "",
      "Docs site, examples, scripts, tests, and CI-only paths must not carry a",
      "changeset — they pollute the next Version Packages PR and bump",
      "`@ggts-sh/core` / `@ggts-sh/spec` / `@ggts-sh/svelte` /",
      "`@ggts-sh/cli` / `@ggts-sh/skill` (fixed lockstep) with notes that do",
      "not change what consumers install.",
      "",
      "**Fix:** delete the `.changeset/*.md` file(s) from this PR.",
      "",
      "Add a changeset only when the diff touches a published package's",
      "`files` entries (or its `package.json`) — same rule as",
      "`scripts/changeset-check.ts`. The packaged agent skill under",
      "`packages/skill/` *does* ship and may warrant a patch.",
      "",
      "This check **blocks** merging until the unwarranted changeset is removed.",
      "",
    ].join("\n");
  }
  const shown = decision.touched.slice(0, LISTING_CAP).map((f) => `- \`${f}\``);
  const rest = decision.touched.length - LISTING_CAP;
  if (rest > 0) {
    shown.push(`- …and ${rest} more`);
  }
  return [
    COMMENT_MARKER,
    "⚠️ **No changeset found**, but this PR changes npm-published code:",
    "",
    ...shown,
    "",
    "Without a changeset this PR will publish silently: no CHANGELOG entry, no",
    "version-bump influence (see how release PR #45 covered ~200 PRs with 4",
    "entries). If consumers should hear about this change, add one:",
    "",
    "```sh",
    "bun changeset",
    "```",
    "",
    "This check does **not block** merging for a missing changeset — internal-only",
    "or not-worth-announcing package changes can ignore it. A changeset on a",
    "docs/examples-only PR *does* block (verdict `unwarranted`).",
    "",
  ].join("\n");
}

function isChangesetFile(path: string): boolean {
  return /^\.changeset\/(?!README\.md$)[^/]+\.md$/.test(path);
}

/** One row from `git diff --name-status` (or a bare path for tests). */
export type DiffEntry = {
  /** First letter of git status: A, M, D, R, C, … */
  status: string;
  path: string;
};

/**
 * Parse a `git diff --name-status` line, or a bare path.
 *
 * Bare paths (no tab) are treated as **added** so unit tests and older
 * callers keep the strict "changeset without package code = unwarranted"
 * behaviour. The workflow feeds real name-status lines so pure edits of
 * existing changesets can pass.
 */
export function parseNameStatusLine(line: string): DiffEntry | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  if (!trimmed.includes("\t")) {
    return { status: "A", path: trimmed };
  }
  const parts = trimmed.split("\t");
  const statusField = parts[0];
  if (statusField === undefined || statusField.length === 0) return null;
  const kind = statusField[0]!;
  // R100 / C50: path is the destination (last column).
  if ((kind === "R" || kind === "C") && parts.length >= 3 && parts[2] !== undefined) {
    return { status: kind, path: parts[2] };
  }
  const path = parts[1];
  if (path === undefined || path.length === 0) return null;
  return { status: kind, path };
}

/** True when this diff row *introduces* a pending changeset entry. */
function introducesChangeset(entry: DiffEntry): boolean {
  if (!isChangesetFile(entry.path)) return false;
  // A = new file; R/C = moved/copied into .changeset/. Pure M/D do not
  // queue a new release note — they reclassify or drop an existing one.
  return entry.status === "A" || entry.status === "R" || entry.status === "C";
}

function isShippedPath(path: string, pkg: PublishedPackage): boolean {
  if (path === `${pkg.dir}/package.json`) return true;
  // npm always packs README (and LICENSE) at the package root even when they
  // are omitted from the `files` field — the package page is the front door.
  if (path === `${pkg.dir}/README.md` || path === `${pkg.dir}/LICENSE`) return true;
  // Colocated test files live under src/ but are not part of the consumer
  // surface a changelog entry describes.
  if (/\.(test|spec)\.[jt]sx?$/.test(path)) return false;
  // `files` mixes directories (dist, references) and root-level files
  // (@ggts-sh/skill: files=["SKILL.md","references"]). Match both: exact
  // file entries, and directory entries as path prefixes.
  if (
    pkg.shipped.some(
      (entry) => path === `${pkg.dir}/${entry}` || path.startsWith(`${pkg.dir}/${entry}/`),
    )
  ) {
    return true;
  }
  // Packages that publish compiled dist (not source) still change consumers
  // via src/. dist/ is usually gitignored, so git diffs never list it —
  // map src/ → shipped surface when files lists dist but not src.
  // (@ggts-sh/svelte: files=["dist","bin"]; build = svelte-package
  // -i src/lib -o dist.)
  if (
    pkg.shipped.includes("dist") &&
    !pkg.shipped.includes("src") &&
    path.startsWith(`${pkg.dir}/src/`)
  ) {
    return true;
  }
  return false;
}

/**
 * Classify a PR diff. Accepts bare paths (tests / legacy) or
 * `status\\tpath` name-status lines from the workflow.
 */
export function decideChangesetComment(
  changedFiles: string[],
  packages: PublishedPackage[],
): Decision {
  const entries = changedFiles
    .map((line) => parseNameStatusLine(line))
    .filter((entry): entry is DiffEntry => entry !== null);
  const hasChangeset = entries.some((entry) => introducesChangeset(entry));
  const touched = entries
    .map((entry) => entry.path)
    .filter((path) => packages.some((pkg) => isShippedPath(path, pkg)));
  if (hasChangeset) {
    if (touched.length > 0) {
      return { verdict: "changeset-present", touched: [] };
    }
    return { verdict: "unwarranted", touched: [] };
  }
  if (touched.length > 0) {
    return { verdict: "missing", touched };
  }
  return { verdict: "not-needed", touched: [] };
}

async function readStdinLines(): Promise<string[]> {
  const text = await new Response(Bun.stdin.stream()).text();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function runEmitCli(args: string[]): Promise<void> {
  const bodyOutIndex = args.indexOf("--body-out");
  const bodyOut = bodyOutIndex === -1 ? undefined : args[bodyOutIndex + 1];
  if (!args.includes("--stdin") || bodyOut === undefined) {
    throw new Error("usage: changeset-check.ts emit --stdin --body-out <path>");
  }
  const files = await readStdinLines();
  const decision = decideChangesetComment(files, discoverPublishedPackages(process.cwd()));
  writeFileSync(bodyOut, renderComment(decision));
  const outputs = `verdict=${decision.verdict}\n`;
  const githubOutput = process.env["GITHUB_OUTPUT"];
  if (typeof githubOutput === "string" && githubOutput.length > 0) {
    appendFileSync(githubOutput, outputs);
  }
  process.stdout.write(outputs);
}

if (import.meta.main) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd !== "emit") {
    console.error("usage: changeset-check.ts emit --stdin --body-out <path>");
    process.exit(1);
  }
  await runEmitCli(rest);
}
