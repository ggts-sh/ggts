/**
 * Comparison-table version lockstep (README + docs homepage).
 *
 * Package manifests are the version source of truth. The "Why ggts?"
 * tables cite that version; after every Version Packages PR they must match
 * the just-bumped package.json, not a hand-edited leftover.
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  readLockstepVersion,
  syncReadmeApiStability,
  syncComparisonVersions,
  checkComparisonVersions,
} from "./sync-comparison-versions.ts";

const ROOT = join(import.meta.dir, "..");

const SAMPLE_README = `# ggts

## Why ggts?

| Capability                                 | ggts  | SveltePlot           | LayerCake            |
| ------------------------------------------ | --------- | -------------------- | -------------------- |
| **Bundle size** (min+gzip, 1k scatter app) | ⚠️ 138 KB | ✅ 109 KB            | ✅ 41 KB             |
| **API stability**                          | ⚠️ v0.30  | ⚠️ v0.14             | ✅ v10               |
| **Headless server-side SVG** (no DOM)      | ✅        | ❌ empty shell       | ⚠️ opt-in \`ssr\` flag |
`;

describe("syncReadmeApiStability", () => {
  it("replaces only the ggts API-stability cell with the full released version", () => {
    const out = syncReadmeApiStability(SAMPLE_README, "0.32.0");
    // Preserve trailing padding before the next column pipe.
    expect(out).toContain(
      "| **API stability**                          | ⚠️ v0.32.0  | ⚠️ v0.14             | ✅ v10               |",
    );
    // Peer cells and other rows are untouched.
    expect(out).toContain(
      "| **Bundle size** (min+gzip, 1k scatter app) | ⚠️ 138 KB | ✅ 109 KB            | ✅ 41 KB             |",
    );
    expect(out).toContain("⚠️ v0.14");
    expect(out).toContain("✅ v10");
    expect(out).not.toContain("⚠️ v0.30");
  });

  it("is a no-op when the README already cites the given version", () => {
    const once = syncReadmeApiStability(SAMPLE_README, "0.32.0");
    expect(syncReadmeApiStability(once, "0.32.0")).toBe(once);
  });

  it("throws when the API stability row is missing or malformed", () => {
    expect(() => syncReadmeApiStability("# bare", "0.32.0")).toThrow(/API stability/);
    expect(() => syncReadmeApiStability(SAMPLE_README, "not-a-version")).toThrow(/semver/);
  });

  it("accepts a different-length version string (1.0.0 vs 0.32.0)", () => {
    // Width change is why write mode runs prettier after the rewrite.
    const out = syncReadmeApiStability(SAMPLE_README, "1.0.0");
    expect(out).toMatch(/\|\s*\*\*API stability\*\*\s*\|\s*⚠️ v1\.0\.0\s*\|/);
    expect(out).not.toContain("⚠️ v0.30");
  });
});

describe("live comparison tables match the published lockstep version", () => {
  const version = readLockstepVersion(ROOT);

  it("reads a real lockstep semver from packages/svelte", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    // Lockstep: every published package shares this version.
    for (const pkg of ["spec", "core", "svelte", "cli", "skill"] as const) {
      const manifest = JSON.parse(
        readFileSync(join(ROOT, "packages", pkg, "package.json"), "utf8"),
      ) as { version: string };
      expect(manifest.version, `@ggts-sh/${pkg}`).toBe(version);
    }
  });

  it("README API-stability cell cites that version", () => {
    const readme = readFileSync(join(ROOT, "README.md"), "utf8");
    // Same version → rewrite is a no-op (padding preserved). Check path uses a
    // version-presence regex so prettier column padding is not part of the gate.
    expect(syncReadmeApiStability(readme, version)).toBe(readme);
    expect(readme).toMatch(
      new RegExp(
        String.raw`\|\s*\*\*API stability\*\*\s*\|\s*⚠️ v${version.replaceAll(".", String.raw`\.`)}\s*\|`,
      ),
    );
  });

  it("release version sync preserves a benchmark measured on an older version", () => {
    const root = mkdtempSync(join(tmpdir(), "ggts-comparison-"));
    try {
      mkdirSync(join(root, "packages/svelte"), { recursive: true });
      mkdirSync(join(root, "apps/docs/src/lib/generated"), { recursive: true });
      writeFileSync(
        join(root, "packages/svelte/package.json"),
        JSON.stringify({ version: "1.0.0" }),
      );
      writeFileSync(join(root, "README.md"), syncReadmeApiStability(SAMPLE_README, "1.0.0"));
      const projection = join(root, "apps/docs/src/lib/generated/benchmark-charts.ts");
      const old = 'export const BENCHMARK_VERSIONS = { ggts: "0.42.0" };';
      writeFileSync(projection, old);
      expect(syncComparisonVersions(root).readmeChanged).toBe(false);
      expect(() => {
        checkComparisonVersions(root);
      }).not.toThrow();
      expect(readFileSync(projection, "utf8")).toBe(old);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("README bundle-size cell matches the rounded docs projection", () => {
    const readme = readFileSync(join(ROOT, "README.md"), "utf8");
    const proj = readFileSync(
      join(ROOT, "apps/docs/src/lib/generated/benchmark-charts.ts"),
      "utf8",
    );
    const core = /coreKb:\s*([0-9]+(?:\.[0-9]+)?)/.exec(proj);
    const svelte = /svelteKb:\s*([0-9]+(?:\.[0-9]+)?)/.exec(proj);
    expect(core).not.toBeNull();
    expect(svelte).not.toBeNull();
    const coreKB = Math.round(Number(core![1]));
    const svelteKB = Math.round(Number(svelte![1]));
    expect(readme).toMatch(
      new RegExp(
        String.raw`\|\s*\*\*Bundle size\*\* \(min\+gzip, scatter import graph\)\s*\|\s*${String(coreKB)} KB core SVG / ${String(svelteKB)} KB Svelte\s*\|`,
      ),
    );
  });
});

describe("release wiring auto-bumps comparison tables on Version Packages", () => {
  it("root package.json version script runs changeset version then the sync", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    // changesets/action `version-script:` replaces `changeset version`; the custom
    // script must call it, then rewrite README + docs projection.
    expect(pkg.scripts["version"]).toMatch(/changeset version/);
    expect(pkg.scripts["version"]).toContain("sync-comparison-versions");
    expect(pkg.scripts["comparison:versions:check"]).toContain(
      "sync-comparison-versions.ts --check",
    );
    // Drift must fail the same check chain CI unit already runs.
    expect(pkg.scripts["check"]).toContain("comparison:versions:check");
  });

  it("release.yml passes the version script to changesets/action", () => {
    const yml = readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8");
    const stepAt = yml.indexOf("changesets — open/update Version Packages PR");
    expect(stepAt).toBeGreaterThan(-1);
    const nextStep = yml.indexOf("\n      - ", stepAt + 1);
    const step = nextStep === -1 ? yml.slice(stepAt) : yml.slice(stepAt, nextStep);
    expect(step).toContain("changesets/action@");
    // Custom version-script input (action v2) — not the default bare `changeset version`.
    expect(step).toMatch(/version-script:\s*bun run version/);
    expect(step).not.toMatch(/^\s+version:\s/m);
  });
});
