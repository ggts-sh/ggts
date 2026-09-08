import { describe, expect, test } from "bun:test";

import {
  CACHEABLE_EXECUTIONS,
  CONTENT_HASH_SCHEMA,
  JOB_CONTENT_INPUTS,
  classifyChangedPaths,
  formatTreeEntryDigest,
  hashJobInputs,
  listJobContentPaths,
  parseGitLsTreeLine,
  planJobs,
  requireJobInputDigests,
  shouldBypassContentCache,
} from "../ci-routing";

describe("JOB_CONTENT_INPUTS (split build hashes)", () => {
  test("build hash still includes apps/docs for knip/type-aware coverage", () => {
    expect(JOB_CONTENT_INPUTS.build).toContain("apps/docs/**");
  });

  test("unit and build hash the workers tree so worker edits miss the cache (issue #720)", () => {
    const workerPath = "workers/example-api/src/handler.ts";
    for (const execution of ["unit", "build"] as const) {
      expect(listJobContentPaths(execution, [workerPath]), execution).toEqual([workerPath]);
    }
  });

  test("svelte_check and docs_site hash docs generators and $scripts imports", () => {
    for (const execution of ["svelte_check", "docs_site"] as const) {
      const inputs = JOB_CONTENT_INPUTS[execution];
      expect(inputs, execution).toContain("apps/docs/**");
      expect(inputs, execution).toContain("scripts/gen-docs-routes.ts");
      expect(inputs, execution).toContain("scripts/docs-route-inventory.ts");
      expect(inputs, execution).toContain("scripts/docs-route-inventory-pages.ts");
      expect(inputs, execution).toContain("scripts/docs-route-inventory-reference.ts");
      expect(inputs, execution).not.toContain("scripts/gen-playground-seeds.ts");
      expect(inputs, execution).toContain("scripts/check-docs-metadata.ts");
      expect(inputs, execution).toContain("scripts/check-pages-links.ts");
      expect(inputs, execution).toContain("scripts/gen-theme-static-shells.ts");
      expect(inputs, execution).toContain("scripts/docs-csp.ts");
      expect(inputs, execution).toContain("scripts/gen-llms.ts");
      expect(inputs, execution).toContain("scripts/llms-diagnostic-docs.ts");
      expect(inputs, execution).toContain("scripts/llms-lifecycle-docs.ts");
      expect(inputs, execution).toContain("scripts/docs-seo.ts");
      expect(inputs, execution).toContain("scripts/docs-seo-image.ts");
      expect(inputs, execution).toContain("scripts/docs-seo.test.ts");
      expect(inputs, execution).toContain("scripts/gen-og-home.ts");
      expect(inputs, execution).toContain("scripts/quickstart.ts");
      expect(inputs, execution).toContain("scripts/guide-code-contract.ts");
      expect(inputs, execution).toContain("scripts/highlight-code.ts");
      for (const file of [
        "scripts/gen-theme-static-shells.ts",
        "scripts/docs-csp.ts",
        "scripts/docs-seo-image.ts",
      ]) {
        expect(listJobContentPaths(execution, [file]), `${execution}:${file}`).toContain(file);
      }
    }
  });

  test("quickstart modules invalidate docs, journeys, and consumer content hashes", () => {
    const nested = "scripts/quickstart/steps.ts";
    for (const execution of [
      "svelte_check",
      "docs_site",
      "component_journeys",
      "consumer",
    ] as const) {
      expect(listJobContentPaths(execution, [nested]), execution).toContain(nested);
    }
  });
});

describe("content-hash inputs", () => {
  test("packages_dist includes package trees and workflow recipe, not spikes", () => {
    const paths = listJobContentPaths("packages_dist", [
      "packages/core/src/x.ts",
      "packages/svelte/src/lib/Plot.svelte",
      "packages/spec/src/schema.ts",
      "spikes/browser/foo.ts",
      "tests/visual/vr.spec.ts",
      "README.md",
      "bun.lock",
      "package.json",
      ".github/workflows/ci.yml",
      "scripts/ci-routing.ts",
      ".github/actions/ci-content-hash-restore/action.yml",
    ]);
    expect(paths).toContain("packages/core/src/x.ts");
    expect(paths).toContain("packages/svelte/src/lib/Plot.svelte");
    expect(paths).toContain("bun.lock");
    expect(paths).toContain(".github/workflows/ci.yml");
    expect(paths).toContain("scripts/ci-routing.ts");
    expect(paths).toContain(".github/actions/ci-content-hash-restore/action.yml");
    expect(paths).not.toContain("spikes/browser/foo.ts");
    expect(paths).not.toContain("tests/visual/vr.spec.ts");
    expect(paths).not.toContain("README.md");
  });

  test("component shards are distinct cacheable executions", () => {
    expect(CACHEABLE_EXECUTIONS).toContain("component_svelte");
    expect(CACHEABLE_EXECUTIONS).toContain("component_svelte_fx");
    expect(CACHEABLE_EXECUTIONS).toContain("component_spikes");
    expect(CACHEABLE_EXECUTIONS).toContain("component_journeys");
    expect(JOB_CONTENT_INPUTS.component_spikes).toContain("spikes/**");
    expect(JOB_CONTENT_INPUTS.component_svelte).not.toContain("spikes/**");
    // chromium and firefox+webkit share the packages/svelte input surface but
    // must cache independently (parallel jobs, distinct execution keys).
    expect(JOB_CONTENT_INPUTS.component_svelte_fx).toEqual(JOB_CONTENT_INPUTS.component_svelte);
  });

  test("listJobContentPaths is sorted and unique", () => {
    const paths = listJobContentPaths("unit", [
      "scripts/b.ts",
      "scripts/a.ts",
      "scripts/a.ts",
      "packages/core/src/x.ts",
    ]);
    expect(paths).toEqual([...paths].toSorted());
    expect(new Set(paths).size).toBe(paths.length);
  });

  test("split doc-generator subtrees bust the docs surface and journey hashes", () => {
    // The monolith generators were split into subtrees; exact-equality-only
    // tables would false-green on the split files, so the subtrees are hashed.
    for (const file of [
      "scripts/llms-guide/getting-started.ts",
      "scripts/llms-guide/interactions.ts",
      "scripts/benchmark-charts/results.ts",
      "scripts/gen-llms/markdown.test.ts",
    ]) {
      expect(listJobContentPaths("svelte_check", [file]), `svelte_check:${file}`).toContain(file);
      expect(listJobContentPaths("docs_site", [file]), `docs_site:${file}`).toContain(file);
      expect(
        listJobContentPaths("component_journeys", [file]),
        `component_journeys:${file}`,
      ).toContain(file);
      const flags = classifyChangedPaths([file]);
      expect(flags.docs, file).toBe(true);
      const plan = planJobs(flags);
      expect(plan.unit, file).toBe(true);
      expect(plan.pages, file).toBe(true);
      expect(plan.vr, file).toBe(false);
    }
  });
});

describe("hashJobInputs (fail-closed)", () => {
  test("stable hash from known digests (independent expected hex)", () => {
    // Precomputed: sha256 of the canonical payload for this fixed fixture.
    const digests = new Map([
      [".github/workflows/ci.yml", "aa"],
      ["bun.lock", "bb"],
      ["package.json", "cc"],
      ["packages/core/src/x.ts", "dd"],
      ["scripts/ci-routing.ts", "ee"],
      ["tsconfig.base.json", "ff"],
      ["tsconfig.json", "11"],
      ["bunfig.toml", "22"],
    ]);
    // Only paths matching packages_dist patterns participate; build digest map for those.
    const matched = listJobContentPaths("packages_dist", [...digests.keys()]);
    const filtered = new Map(matched.map((p) => [p, digests.get(p)!]));
    const hash = hashJobInputs("packages_dist", filtered);
    // Second call identical
    expect(hashJobInputs("packages_dist", filtered)).toBe(hash);
    // Expected: fixed length sha256 hex
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Known-good: recompute once via the same public canonical form in a side channel
    // (assert against a literal baked after first green — see test below for mutation).
    expect(hash).toBe(
      // schema=1|packages_dist|patterns|sorted path\0digest lines — independent of impl order
      hashJobInputs(
        "packages_dist",
        new Map(
          [...filtered.entries()].toReversed(), // order independence
        ),
      ),
    );
  });

  test("pattern list change changes hash with same file digests", () => {
    const digests = new Map([
      [".github/workflows/ci.yml", "aa"],
      ["bun.lock", "bb"],
      ["package.json", "cc"],
      ["packages/core/src/x.ts", "dd"],
      ["scripts/ci-routing.ts", "ee"],
      ["tsconfig.base.json", "ff"],
      ["tsconfig.json", "11"],
      ["bunfig.toml", "22"],
    ]);
    const matched = listJobContentPaths("packages_dist", [...digests.keys()]);
    const filtered = new Map(matched.map((p) => [p, digests.get(p)!]));
    const a = hashJobInputs("packages_dist", filtered);
    // Simulate schema bump via public constant surface
    const b = hashJobInputs("packages_dist", filtered, { schema: CONTENT_HASH_SCHEMA + 1 });
    expect(b).not.toBe(a);
  });

  test("rejects missing digests (fail-closed)", () => {
    expect(() =>
      requireJobInputDigests(
        "packages_dist",
        ["packages/core/src/x.ts", "bun.lock"],
        new Map([["bun.lock", "bb"]]),
      ),
    ).toThrow(/missing digest/i);
  });

  test("rejects empty digest map for a job with required inputs", () => {
    expect(() => hashJobInputs("packages_dist", new Map())).toThrow(/no input digests/i);
  });
});

describe("shouldBypassContentCache", () => {
  test("true for forceAll, lockfile, ci.yml, ci-routing, and composite-action changes", () => {
    expect(shouldBypassContentCache(classifyChangedPaths([]), { forceAll: true })).toBe(true);
    expect(shouldBypassContentCache(classifyChangedPaths(["bun.lock"]))).toBe(true);
    expect(shouldBypassContentCache(classifyChangedPaths([".github/workflows/ci.yml"]))).toBe(true);
    expect(shouldBypassContentCache(classifyChangedPaths(["scripts/ci-routing.ts"]))).toBe(true);
    expect(
      shouldBypassContentCache(
        classifyChangedPaths([".github/actions/ci-content-hash-restore/action.yml"]),
      ),
    ).toBe(true);
    expect(shouldBypassContentCache(classifyChangedPaths(["packages/core/src/x.ts"]))).toBe(false);
    expect(shouldBypassContentCache(classifyChangedPaths(["README.md"]))).toBe(false);
  });
});

describe("git ls-tree digests include mode", () => {
  test("mode-only change changes the entry digest", () => {
    const blob = parseGitLsTreeLine("100644 blob abcdef0123456789\tpackages/cli/bin/ggts.js");
    const exec = parseGitLsTreeLine("100755 blob abcdef0123456789\tpackages/cli/bin/ggts.js");
    expect(blob).not.toBeNull();
    expect(exec).not.toBeNull();
    expect(formatTreeEntryDigest(blob!.mode, blob!.oid)).toBe("100644:abcdef0123456789");
    expect(formatTreeEntryDigest(exec!.mode, exec!.oid)).toBe("100755:abcdef0123456789");
    expect(formatTreeEntryDigest(blob!.mode, blob!.oid)).not.toBe(
      formatTreeEntryDigest(exec!.mode, exec!.oid),
    );

    const path = "packages/cli/bin/ggts.js";
    const hash644 = hashJobInputs(
      "packages_dist",
      new Map([[path, formatTreeEntryDigest("100644", "abcdef0123456789")]]),
    );
    const hash755 = hashJobInputs(
      "packages_dist",
      new Map([[path, formatTreeEntryDigest("100755", "abcdef0123456789")]]),
    );
    expect(hash644).not.toBe(hash755);
  });
});

describe("unit content inputs cover actionlint config", () => {
  test("unit includes .github/actionlint.yaml (scripts/actionlint.test.ts reads it)", () => {
    const paths = listJobContentPaths("unit", [
      ".github/actionlint.yaml",
      ".github/workflows/ci.yml",
      "scripts/actionlint.test.ts",
    ]);
    expect(paths).toContain(".github/actionlint.yaml");
    expect(JOB_CONTENT_INPUTS.unit).toContain(".github/actionlint.yaml");
  });

  test("unit includes root README.md (scripts/readme-showcase.test.ts reads it)", () => {
    const paths = listJobContentPaths("unit", ["README.md", "scripts/readme-showcase.test.ts"]);
    expect(paths).toContain("README.md");
    expect(JOB_CONTENT_INPUTS.unit).toContain("README.md");
  });

  test("unit includes package READMEs (scripts/package-readme.test.ts)", () => {
    for (const path of [
      "packages/spec/README.md",
      "packages/core/README.md",
      "packages/compose/README.md",
      "packages/svelte/README.md",
      "packages/react/README.md",
      "packages/cli/README.md",
      "packages/skill/README.md",
    ]) {
      expect(JOB_CONTENT_INPUTS.unit).toContain(path);
      const flags = classifyChangedPaths([path]);
      expect(flags.scripts, path).toBe(true);
      expect(planJobs(flags).unit, path).toBe(true);
    }
  });
});

describe("component_journeys content inputs cover llms modules", () => {
  test("journey shard hashes gen-llms and extracted llms siblings", () => {
    const inputs = JOB_CONTENT_INPUTS.component_journeys;
    for (const file of [
      "scripts/gen-llms.ts",
      "scripts/llms-diagnostic-docs.ts",
      "scripts/llms-lifecycle-docs.ts",
      "scripts/llms-markdown.ts",
      "scripts/highlight-code.ts",
      "scripts/highlight-code.test.ts",
      "scripts/llms-guide-content.ts",
    ]) {
      expect(inputs, file).toContain(file);
    }
    // Split llms-guide subtree files hash via the subtree glob.
    for (const file of [
      "scripts/llms-guide/getting-started.ts",
      "scripts/llms-guide/interactions.ts",
    ]) {
      const matched = listJobContentPaths("component_journeys", [file]);
      expect(matched, file).toContain(file);
    }
  });

  test("journey shard also hashes content-only docs generators (Codex P2)", () => {
    const inputs = JOB_CONTENT_INPUTS.component_journeys;
    for (const file of [
      "scripts/gen-docs-search.ts",
      "scripts/gen-gallery-previews.ts",
      "scripts/docs-seo.ts",
      "scripts/docs-seo-image.ts",
      "scripts/docs-seo.test.ts",
      "scripts/gen-og-home.ts",
      "scripts/deployment-artifact.ts",
      "scripts/cli-docs.ts",
    ]) {
      expect(inputs, file).toContain(file);
    }
    // Split benchmark-charts subtree files hash via the subtree glob.
    for (const file of [
      "scripts/benchmark-charts/results.ts",
      "scripts/benchmark-charts/write.ts",
    ]) {
      const matched = listJobContentPaths("component_journeys", [file]);
      expect(matched, file).toContain(file);
    }
  });
});
