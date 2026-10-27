/**
 * Characterization + contract tests for CI step-cluster composites extracted
 * from ci.yml (packages-dist download/verify, setup-bun pin, bun-install cache).
 */
import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { loadSupportMatrix } from "./support-matrix.js";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const SETUP_BUN = ".github/actions/ci-setup-bun/action.yml";
const BUN_INSTALL = ".github/actions/ci-bun-install/action.yml";
const DOWNLOAD_DIST = ".github/actions/ci-download-packages-dist/action.yml";
const ASSERT_PW_SYNC = ".github/actions/ci-assert-playwright-version-sync/action.yml";

/** Jobs that assert npm Playwright vs PLAYWRIGHT_CONTAINER_TAG. */
const PLAYWRIGHT_VERSION_SYNC_JOBS = [
  "component-svelte",
  "component-svelte-fx",
  "component-spikes",
  "component-journeys",
] as const;

/** Jobs that download the shared packages-dist artifact. */
const PACKAGES_DIST_CONSUMERS = [
  "consumer-compat",
  "component-svelte",
  // The collect job runs the SSR lane and resolves the config for the coverage
  // merge, so it needs packages/*/dist just as its shards do (issue #1035).
  "component-svelte-coverage",
  "component-svelte-fx",
  "component-spikes",
  "component-journeys",
  "interaction-perf",
] as const;

/** Jobs that run setup-bun (every Linux CI job except pure aggregators that still set it up). */
const SETUP_BUN_JOBS = [
  "detect-changes",
  "packages-dist",
  "checks",
  "unit",
  "compatibility-matrix",
  "consumer-compat",
  "component-svelte",
  "component-svelte-coverage",
  "component-svelte-fx",
  "component-spikes",
  "component-journeys",
  "interaction-perf",
  "build",
  "svelte-check",
  "docs-site",
  "actions-security",
  "bench-smoke",
  "vr-baseline-guard",
  "ci-gate",
] as const;

/** Jobs that use the cache+install composite (not consumer-compat — install without actions/cache). */
const BUN_INSTALL_JOBS = [
  "packages-dist",
  "checks",
  "unit",
  "component-svelte",
  "component-svelte-coverage",
  "component-svelte-fx",
  "component-spikes",
  "component-journeys",
  "interaction-perf",
  "build",
  "svelte-check",
  "docs-site",
  "actions-security",
  "bench-smoke",
] as const;

const CONTAINER_BUN_INSTALL_JOBS = new Set([
  "component-svelte",
  "component-svelte-coverage",
  "component-svelte-fx",
  "component-spikes",
  "component-journeys",
  "interaction-perf",
]);

/** Orchestrator + every reusable domain workflow (issue #392). */
function readCiSurface(): string {
  const dir = join(root, ".github/workflows");
  const files = readdirSync(dir)
    .filter((f) => f === "ci.yml" || (f.startsWith("ci-") && f.endsWith(".yml")))
    .toSorted();
  return files.map((f) => read(`.github/workflows/${f}`)).join("\n");
}

function jobSlice(ci: string, jobId: string): string {
  // Prefer the domain job body (has steps) over the thin orchestrator caller.
  const marker = `  ${jobId}:\n`;
  let start = -1;
  let from = 0;
  while (true) {
    const idx = ci.indexOf(marker, from);
    if (idx === -1) break;
    const window = ci.slice(idx, idx + 800);
    if (window.includes("    steps:") || window.includes("\n    steps:")) {
      start = idx;
      break;
    }
    // reusable caller uses: — keep looking
    from = idx + marker.length;
  }
  if (start === -1) {
    start = ci.indexOf(marker);
  }
  expect(start, `job ${jobId} missing`).toBeGreaterThan(-1);
  const rest = ci.slice(start + 1);
  const next = rest.search(/\n  [a-z0-9_-]+:\n/);
  return next === -1 ? ci.slice(start) : ci.slice(start, start + 1 + next);
}

describe("ci-download-packages-dist composite", () => {
  it("exists with pinned download-artifact and three dist entrypoint checks", () => {
    expect(existsSync(join(root, DOWNLOAD_DIST))).toBe(true);
    const action = read(DOWNLOAD_DIST);
    expect(action).toMatch(/actions\/download-artifact@[0-9a-f]{40}\b/);
    expect(action).toContain("name: packages-dist");
    expect(action).toContain("path: packages");
    expect(action).toContain("packages/spec/dist/index.js");
    expect(action).toContain("packages/core/dist/index.js");
    expect(action).toContain("packages/svelte/dist/index.js");
    expect(action).toContain("shell: bash");
  });

  it("is the sole packages-dist download path for the six consumer jobs", () => {
    const ci = readCiSurface();
    for (const jobId of PACKAGES_DIST_CONSUMERS) {
      const job = jobSlice(ci, jobId);
      expect(job, jobId).toContain("uses: ./.github/actions/ci-download-packages-dist");
      // No inline download-artifact for packages-dist in the job body.
      expect(job, jobId).not.toMatch(
        /download-artifact@[0-9a-f]+[\s\S]{0,120}name:\s*packages-dist/,
      );
    }
    // One use per consumer, and no others: component-svelte is chromium shards
    // plus a coverage-merge collect job, alongside fx / spikes / journeys.
    const uses = ci.match(/uses: \.\/\.github\/actions\/ci-download-packages-dist/g) ?? [];
    expect(uses.length).toBe(PACKAGES_DIST_CONSUMERS.length);
  });
});

describe("ci-setup-bun composite", () => {
  it("exists as setup-bun only (no checkout — local composites need prior checkout)", () => {
    expect(existsSync(join(root, SETUP_BUN))).toBe(true);
    const action = read(SETUP_BUN);
    expect(action).toContain("oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6");
    expect(action).toContain("bun-version:");
    expect(action).toContain(loadSupportMatrix(root).packageManagers.bun);
    expect(action).not.toContain("actions/checkout@");
  });

  it("is used by every CI job that previously inlined setup-bun", () => {
    const ci = readCiSurface();
    for (const jobId of SETUP_BUN_JOBS) {
      const job = jobSlice(ci, jobId);
      expect(job, jobId).toContain("uses: ./.github/actions/ci-setup-bun");
      expect(job, jobId).not.toContain("oven-sh/setup-bun@");
    }
    // Inline setup-bun should be gone from ci.yml (lives in composite only).
    expect(ci).not.toContain("oven-sh/setup-bun@");
  });
});

describe("ci-bun-install composite", () => {
  it("exists with private runner.temp cache + frozen install", () => {
    expect(existsSync(join(root, BUN_INSTALL))).toBe(true);
    const action = read(BUN_INSTALL);
    expect(action).toContain("actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9");
    expect(action).toContain("path: ${{ runner.temp }}/bun-install-cache");
    expect(action).toContain("BUN_INSTALL_CACHE_DIR: ${{ runner.temp }}/bun-install-cache");
    expect(action).toContain("bun install --frozen-lockfile");
    expect(action).not.toContain("path: ~/.bun/install/cache");
    // Host vs container key prefix via input.
    expect(action).toMatch(/cache_key_prefix|cache-key-prefix/);
  });

  it("wires host vs container cache prefixes for the cache+install jobs", () => {
    const ci = readCiSurface();
    for (const jobId of BUN_INSTALL_JOBS) {
      const job = jobSlice(ci, jobId);
      expect(job, jobId).toContain("uses: ./.github/actions/ci-bun-install");
      if (CONTAINER_BUN_INSTALL_JOBS.has(jobId)) {
        expect(job, jobId).toMatch(/cache_key_prefix:\s*bun-container/);
      } else {
        expect(job, jobId).toMatch(/cache_key_prefix:\s*bun\b/);
      }
    }
    // consumer-compat keeps install without actions/cache (matrix OS diversity).
    const consumer = jobSlice(ci, "consumer-compat");
    expect(consumer).not.toContain("uses: ./.github/actions/ci-bun-install");
    expect(consumer).toContain("bun install --frozen-lockfile");
    expect(consumer).toContain("BUN_INSTALL_CACHE_DIR: ${{ runner.temp }}/bun-install-cache");
  });
});

describe("ci-assert-playwright-version-sync composite", () => {
  it("exists with env-indirected inputs and noble tag comparison", () => {
    expect(existsSync(join(root, ASSERT_PW_SYNC))).toBe(true);
    const action = read(ASSERT_PW_SYNC);
    expect(action).toContain("using: composite");
    expect(action).toContain("WORKING_DIRECTORY: ${{ inputs.working_directory }}");
    expect(action).toContain("PACKAGE: ${{ inputs.package }}");
    expect(action).toContain("SCOPE: ${{ inputs.scope }}");
    expect(action).toContain("CONTAINER_TAG: ${{ inputs.container_tag }}");
    expect(action).toContain('expected="v${npm_version}-noble"');
    expect(action).toContain("::error::");
    expect(action).toContain("shell: bash");
    // No external actions — pure assertion step.
    expect(action).not.toMatch(/uses:\s+(?!composite)/);
  });

  it("is the sole playwright version-sync path for the container jobs", () => {
    const ci = readCiSurface();
    for (const jobId of PLAYWRIGHT_VERSION_SYNC_JOBS) {
      const job = jobSlice(ci, jobId);
      expect(job, jobId).toContain("uses: ./.github/actions/ci-assert-playwright-version-sync");
      // No inline require("playwright…") version assertions left in job bodies.
      expect(job, jobId).not.toMatch(
        /require\(["'](?:playwright|@playwright\/test)\/package\.json["']\)/,
      );
    }
    // svelte + svelte-fx + spikes + journeys root + journeys apps/docs (#991).
    const uses = ci.match(/uses: \.\/\.github\/actions\/ci-assert-playwright-version-sync/g) ?? [];
    expect(uses.length).toBe(5);
  });

  it("wires scope/package inputs for svelte, spikes, VR root, and docs components", () => {
    const ci = readCiSurface();
    const svelte = jobSlice(ci, "component-svelte");
    expect(svelte).toMatch(/working_directory:\s*packages\/svelte/);
    expect(svelte).toMatch(/package:\s*playwright/);
    expect(svelte).toMatch(/scope:\s*packages\/svelte/);

    const spikes = jobSlice(ci, "component-spikes");
    expect(spikes).toMatch(/working_directory:\s*spikes\/browser/);
    expect(spikes).toMatch(/package:\s*playwright/);
    expect(spikes).toMatch(/scope:\s*spikes\/browser/);

    const journeys = jobSlice(ci, "component-journeys");
    expect(journeys).toMatch(/working_directory:\s*\./);
    expect(journeys).toMatch(/package:\s*["']@playwright\/test["']/);
    expect(journeys).toMatch(/scope:\s*root @playwright\/test \(VR suite\)/);
    // Docs .svelte harness (issue #991) pins playwright next to @playwright/test.
    expect(journeys).toMatch(/working_directory:\s*apps\/docs/);
    expect(journeys).toMatch(/scope:\s*apps\/docs/);
    expect(journeys).toMatch(/docs component tests \(apps\/docs, chromium\)/);
  });
});

describe("Dependabot covers new CI composites", () => {
  it("lists each composite directory under github-actions", () => {
    const dependabot = read(".github/dependabot.yml");
    for (const dir of [
      '"/.github/actions/ci-content-hash-restore"',
      '"/.github/actions/ci-content-hash-write"',
      '"/.github/actions/ci-setup-bun"',
      '"/.github/actions/ci-bun-install"',
      '"/.github/actions/ci-download-packages-dist"',
      '"/.github/actions/ci-assert-playwright-version-sync"',
    ]) {
      expect(dependabot).toContain(dir);
    }
  });
});
