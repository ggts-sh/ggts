/**
 * Loud gate: every non-private package under packages/ must have its
 * package.json version present on npm. Fails the Release job when
 * changesets/action skipped publish because a concurrent merge left a leftover
 * changeset (see npm-publish-state.ts).
 *
 * Usage: bun scripts/assert-npm-published.ts
 * Exit 0 = all on npm; exit 1 = drift (or registry error).
 */

import {
  filterUnpublished,
  formatUnpublishedFailure,
  probeNpmVersions,
  readPublishedPackageVersions,
} from "./npm-publish-state.ts";

async function main(): Promise<number> {
  const root = process.cwd();
  const local = readPublishedPackageVersions(root);
  if (local.length === 0) {
    console.error("assert-npm-published: no published packages found under packages/");
    return 1;
  }

  const publishedKeys = new Set<string>();
  // Retries + cache-bust: same run may have 404-probed these URLs before
  // publish, and a negative CDN cache can still be warm.
  for await (const { pkg, exists } of probeNpmVersions(local, { retries: 5, retryDelayMs: 2000 })) {
    if (exists) {
      publishedKeys.add(`${pkg.name}@${pkg.version}`);
      console.log(`ok  ${pkg.name}@${pkg.version}`);
    } else {
      console.log(`MISS ${pkg.name}@${pkg.version}`);
    }
  }

  const unpublished = filterUnpublished(local, publishedKeys);
  if (unpublished.length === 0) {
    console.log(`assert-npm-published: all ${String(local.length)} package versions are on npm`);
    return 0;
  }

  console.error(formatUnpublishedFailure(unpublished));
  return 1;
}

if (import.meta.main) {
  process.exit(await main());
}
