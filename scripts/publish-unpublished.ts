/**
 * Publish every package.json version under packages/ that is not yet on npm.
 *
 * Decoupled from changesets/action on purpose. The action is either/or: any
 * leftover `.changeset/*.md` makes it open/update the Version Packages PR and
 * skip publish entirely (job still green). This script always ships whatever
 * is already version-bumped on main, recovering the concurrent-merge race.
 *
 * GitHub releases / tags are intentionally NOT created here. That work lives
 * in a later workflow step that holds GITHUB_TOKEN and runs only `gh`/`git`,
 * so the write credential never enters a process that executes repository
 * code or node_modules (see stage-github-releases.ts + release.yml).
 *
 * Idempotent: if everything is already on npm, exits 0 with no work.
 *
 * Usage: bun scripts/publish-unpublished.ts
 * Requires: built packages (dist/), npm auth (OIDC trusted publishing or token).
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  filterUnpublished,
  npmVersionExists,
  packageReleaseTag,
  readPublishedPackageVersions,
  waitForNpmVersions,
} from "./npm-publish-state.ts";

// npm served 0.43.2 up to ~3 min after `changeset publish` exited 0.
const NPM_VISIBILITY_WAIT = { retries: 40, retryDelayMs: 15_000 };
const NPM_VISIBILITY_WAIT_MIN =
  (NPM_VISIBILITY_WAIT.retries * NPM_VISIBILITY_WAIT.retryDelayMs) / 60_000;

function run(
  command: string,
  args: string[],
  opts: { allowFail?: boolean } = {},
): { status: number; stdout: string; stderr: string } {
  const res = spawnSync(command, args, {
    encoding: "utf8",
    env: process.env,
    cwd: process.cwd(),
  });
  const status = res.status ?? 1;
  const stdout = res.stdout ?? "";
  const stderr = res.stderr ?? "";
  if (stdout.length > 0) process.stdout.write(stdout);
  if (stderr.length > 0) process.stderr.write(stderr);
  if (status !== 0 && opts.allowFail !== true) {
    throw new Error(`${command} ${args.join(" ")} exited ${String(status)}`);
  }
  return { status, stdout, stderr };
}

async function main(): Promise<number> {
  const root = process.cwd();
  const local = readPublishedPackageVersions(root);
  if (local.length === 0) {
    console.error("publish-unpublished: no published packages under packages/");
    return 1;
  }

  const publishedKeys = new Set<string>();
  for (const pkg of local) {
    if (await npmVersionExists(pkg.name, pkg.version)) {
      publishedKeys.add(`${pkg.name}@${pkg.version}`);
    }
  }
  const unpublished = filterUnpublished(local, publishedKeys);
  if (unpublished.length === 0) {
    console.log("publish-unpublished: nothing to do — all package versions are on npm");
    return 0;
  }

  console.log(
    `publish-unpublished: shipping ${String(unpublished.length)} unpublished version(s):`,
  );
  for (const pkg of unpublished) {
    console.log(`  - ${pkg.name}@${pkg.version}`);
  }

  // Lockfile-installed binary — repo policy bans network bunx.
  const changesetBin = join(root, "node_modules/.bin/changeset");
  if (!existsSync(changesetBin)) {
    console.error("publish-unpublished: node_modules/.bin/changeset missing; run bun install");
    return 1;
  }

  const publish = run("bun", [changesetBin, "publish"], { allowFail: true });
  if (publish.status !== 0) {
    console.error(`publish-unpublished: changeset publish exited ${String(publish.status)}`);
    return publish.status;
  }

  // Exit 0 is the success signal: changeset publish exits 1 when any npm
  // publish fails, and v3 no longer prints parseable "New tag:" lines. npm can
  // still take minutes to serve a new version, so wait before staging GitHub
  // releases for it.
  const stillMissing = await waitForNpmVersions(unpublished, NPM_VISIBILITY_WAIT);
  if (stillMissing.length > 0) {
    console.error(
      `publish-unpublished: changeset publish exited 0 but npm still lacks after ${String(NPM_VISIBILITY_WAIT_MIN)} min:\n  - ${stillMissing.join("\n  - ")}`,
    );
    return 1;
  }
  const tags = unpublished.map((pkg) => packageReleaseTag(pkg.name, pkg.version));

  // Hand just-published tags to stage-github-releases so registry lag cannot
  // drop them from the GitHub release list (negative CDN cache after 404 probes).
  const staging = process.env["RELEASE_STAGING_DIR"];
  if (staging !== undefined && staging.length > 0) {
    mkdirSync(staging, { recursive: true });
    writeFileSync(
      join(staging, "just-published.txt"),
      tags.length === 0 ? "" : `${tags.join("\n")}\n`,
      "utf8",
    );
    console.log(
      `publish-unpublished: wrote ${String(tags.length)} just-published tag(s) for staging`,
    );
  }

  console.log(
    `publish-unpublished: published ${String(tags.length)} tag(s); GitHub releases staged next`,
  );
  for (const tag of tags) {
    console.log(`  - ${tag}`);
  }
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
