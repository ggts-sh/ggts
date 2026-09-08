import { describe, expect, it } from "bun:test";
import { ciJob, read, readCiSurface, suiteArgs } from "./test-helpers";

describe("R0 release wiring — CI lanes", () => {
  it("runs benchmark unit tests in CI (not on git push hooks)", () => {
    const ci = readCiSurface();
    // CI collects lcov for Codecov. Package tests are CI-only — pre-push was
    // nuked so agents can push without re-running the full unit suite locally.
    expect(ci).toContain("packages/spec packages/core packages/cli benchmarks scripts tests/evals");
    expect(ci).toContain("--coverage-reporter=lcov");
    expect(ci).toContain("coverage/unit");
    expect(ci).toContain("codecov/codecov-action@");
    expect(ci).toContain("flags: unit");
    expect(ci).toContain("flags: svelte");
    expect(read("codecov.yml")).toContain("component_id: packages-spec");
    // packages-cli badge goes "unknown" when no unit test loads packages/cli/src
    // (bin smoke tests spawn a subprocess that imports @ggsvelte/core only).
    expect(read("codecov.yml")).toContain("component_id: packages-cli");
    expect(read("packages/cli/tests/cli-surface.test.ts")).toContain('from "../src/index.ts"');
    expect(read(".pre-commit-config.yaml")).not.toContain("bun test packages/spec");
    expect(read(".pre-commit-config.yaml")).not.toContain("pre-push");
  });

  it("runs every root `bun test` suite in the CI unit job (issue #720)", () => {
    // The root `test` script is the canonical suite list. Anything present there
    // but absent from ci-unit.yml is a local-only suite that merges green.
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    const rootSuites = suiteArgs(pkg.scripts["test"] ?? "");
    expect(rootSuites).toContain("packages/spec");
    expect(rootSuites).toContain("scripts");
    expect(rootSuites).not.toContain("workers/playground-api");

    // Folded (`run: >`) scalar — collapse whitespace, then take the single
    // coverage invocation up to the next step. Anchored on `--coverage` so the
    // job's display name ("unit (bun test spec + core)") cannot match instead.
    const unit = read(".github/workflows/ci-unit.yml").replaceAll(/\s+/g, " ");
    const invocations = unit.match(/bun test --coverage/g) ?? [];
    expect(invocations.length, "ci-unit.yml has exactly one coverage bun test").toBe(1);
    const start = unit.indexOf("bun test --coverage");
    const end = unit.indexOf(" - name: Upload unit coverage", start);
    expect(end, "ci-unit.yml uploads unit coverage after bun test").toBeGreaterThan(start);
    const ciSuites = suiteArgs(unit.slice(start, end));

    for (const suite of rootSuites) {
      expect(ciSuites, `ci-unit.yml runs ${suite}`).toContain(suite);
    }
  });

  it("typechecks scripts/ci-routing inside `bun run check` (issue #734)", () => {
    // Same gap as the worker (#725), one directory further in: scripts/** is in
    // the root tsconfig.json only so oxlint --type-aware has type information,
    // and tsc has never been run on it. ci-routing decides which jobs CI runs,
    // so it is the slice where a silent type error costs the most.
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["check:scripts-ci-routing"]).toContain("tsc -p scripts/ci-routing");
    // Chained into `check`, which ci-unit.yml runs and `build` re-enters.
    expect(pkg.scripts["check"]).toContain("bun run check:scripts-ci-routing");
    // Whole-line: `bun run check:pages-links` &c must not satisfy this.
    expect(read(".github/workflows/ci-unit.yml")).toMatch(/^\s*run: bun run check$/mu);

    const project = read("scripts/ci-routing/tsconfig.json");
    // Base strictness is the point — the gate is worthless under looser options.
    expect(project).toContain('"extends"');
    expect(project).toContain("tsconfig.base.json");
    // Assert on the include list, not the whole file — `extends` legitimately
    // escapes upwards to the repo root.
    const include = /"include"\s*:\s*\[[^\]]*\]/u.exec(project)?.[0] ?? "";
    // Every .ts in the directory, tests included: the suites are where the
    // module's contracts are asserted, so leaving them out would half-check it.
    expect(include, "tsconfig includes the directory's .ts files").toContain('"./**/*.ts"');
    // Scoped to this directory only, so the routing gate keeps failing on its own
    // terms — scripts/tsconfig.json now covers this code as well, and a narrow
    // project that cannot be skipped past is the point of keeping both.
    expect(include, "include stays inside scripts/ci-routing").not.toContain("..");
    expect(include).not.toContain("apps/");
  });

  it("typechecks the whole scripts tree inside `bun run check` (issue #734)", () => {
    // Closes the gap #725 and #737 each took a slice of: scripts/** sat in the
    // root tsconfig.json only so oxlint --type-aware had type information, and
    // tsc was never run on it. Type-aware lint rules are a strict subset of tsc
    // diagnostics, so 103 assignability, optionality and index-signature errors
    // stood unseen — including a null-deref in the sakura G1 render assertion
    // and two CSP assertions naming build modes that were deleted.
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    // Right-boundary anchored throughout: "check:scripts" is a prefix of the
    // sibling "check:scripts-ci-routing", so a plain toContain passes on the
    // routing gate alone and this whole assertion goes vacuous.
    expect(pkg.scripts["check:scripts"]).toMatch(/tsc -p scripts(?![\w./-])/u);
    // Chained into `check`, which ci-unit.yml runs and `build` re-enters.
    expect(pkg.scripts["check"]).toMatch(/bun run check:scripts(?![\w:-])/u);
    // Whole-line: `bun run check:pages-links` &c must not satisfy this.
    expect(read(".github/workflows/ci-unit.yml")).toMatch(/^\s*run: bun run check$/mu);

    const project = read("scripts/tsconfig.json");
    // Base strictness is the point — the gate is worthless under looser options,
    // and relaxing them for this tree was the option #734 rejected.
    expect(project).toContain('"extends"');
    expect(project).toContain("tsconfig.base.json");
    // compilerOptions only — the surrounding comment names these flags to explain
    // why they are inherited, and prose must not satisfy or fail the assertion.
    const options = /"compilerOptions"\s*:\s*\{[^}]*\}/u.exec(project)?.[0] ?? "";
    expect(options, "scripts/tsconfig.json declares compilerOptions").not.toBe("");
    for (const relaxed of [
      "noPropertyAccessFromIndexSignature",
      "exactOptionalPropertyTypes",
      "noUncheckedIndexedAccess",
      "strict",
    ]) {
      expect(options, `scripts/tsconfig.json must not re-open ${relaxed}`).not.toContain(relaxed);
    }
    // Assert on the include list, not the whole file — `extends` legitimately
    // escapes upwards to the repo root.
    const include = /"include"\s*:\s*\[[^\]]*\]/u.exec(project)?.[0] ?? "";
    // The whole tree, tests included: the suites are where these scripts'
    // contracts are asserted, and 70 of the 103 errors were in them.
    expect(include, "tsconfig includes the tree's .ts files").toContain('"./**/*.ts"');
  });

  it("checks packed links in CI and the Cloudflare Pages deployment", () => {
    expect(readCiSurface()).toContain("bun run check:pages-links");
    expect(read(".github/workflows/cloudflare-pages.yml")).toContain("bun run build:cloudflare");
    expect(read("package.json")).toContain("check:pages-links");
  });

  it("runs the Playwright interaction performance gate with benchmark budgets", () => {
    const ci = readCiSurface();
    const bench = read(".github/workflows/bench.yml");
    // Browser surface: svelte (chromium) + svelte-fx (firefox/webkit) + spikes.
    // Journeys is docs_journeys-routed.
    const svelteJob = ciJob(ci, "component-svelte");
    const svelteFxJob = ciJob(ci, "component-svelte-fx");
    const spikesJob = ciJob(ci, "component-spikes");
    const journeysJob = ciJob(ci, "component-journeys");
    const interactionPerfJob = ciJob(ci, "interaction-perf");
    // Container jobs pull the prebaked ci-runner image (Playwright + unzip),
    // not the raw upstream Playwright image. The tag still tracks the matrix
    // (see scripts/support-matrix.test.ts).
    expect(ci).toContain("playwright_container_tag: v1.61.1-noble");
    expect(ci).toMatch(
      /ci-runner:\$\{\{ inputs\.playwright_container_tag \}\}|ci-runner:v1\.61\.1-noble/,
    );
    expect(ci).toContain("HOME: /root");
    // Package browser shards download packages/*/dist (issue #241); no monorepo rebuild.
    // Download+verify lives in ci-download-packages-dist (pin + entrypoint checks).
    for (const job of [svelteJob, svelteFxJob, spikesJob]) {
      expect(job).toContain("uses: ./.github/actions/ci-download-packages-dist");
      expect(job).toContain("packages-dist");
      expect(job).not.toContain("run: bun run build\n");
    }
    expect(svelteJob).toContain("working-directory: packages/svelte");
    expect(read(".github/workflows/ci-component-svelte.yml")).toContain(
      "working-directory: packages/react",
    );
    expect(svelteJob).toContain("--project chromium");
    expect(svelteJob).not.toContain("--project firefox");
    expect(svelteFxJob).toContain("working-directory: packages/svelte");
    expect(svelteFxJob).toContain("--project firefox");
    expect(svelteFxJob).toContain("--project webkit");
    expect(svelteFxJob).not.toContain("--coverage");
    expect(svelteFxJob).toContain("HOME: /root");
    expect(spikesJob).toContain("working-directory: spikes/browser");
    // Journeys: docs_journeys routing + full non-pixel inventory; may build docs site.
    expect(read(".github/workflows/ci.yml")).toContain("docs_journeys == 'true'");
    expect(journeysJob).toContain("uses: ./.github/actions/ci-download-packages-dist");
    expect(journeysJob).toContain("packages-dist");
    expect(journeysJob).toContain("bun run build:docs");
    expect(journeysJob).not.toContain("bun run test:interaction-perf");
    expect(journeysJob).toContain("--grep-invert 'visual contract'");
    expect(journeysJob).toContain("--project journeys");
    expect(read("tests/visual/playwright.config.ts")).toContain('name: "journeys"');
    expect(read("tests/visual/playwright.config.ts")).toContain("timeout: 60_000");
    expect(read("tests/visual/playwright.config.ts")).toContain("docs-shell");
    expect(read("tests/visual/playwright.config.ts")).toContain("docs-home-gallery");
    expect(read("tests/visual/playwright.config.ts")).toContain("docs-progressive-search");
    expect(read("tests/visual/playwright.config.ts")).toContain("docs-themes");
    expect(read("tests/visual/playwright.config.ts")).toContain("interaction-accessibility");
    expect(read("tests/visual/playwright.config.ts")).not.toContain("playground");
    // ci-gate: package component = svelte+svelte-fx+spikes; docs_journeys is independent.
    expect(ci).toContain("COMPONENT_SVELTE_RES");
    expect(ci).toContain("COMPONENT_SVELTE_FX_RES");
    expect(ci).toContain("COMPONENT_SPIKES_RES");
    expect(ci).toContain("DOCS_JOURNEYS_RES");
    expect(ci).toContain("DOCS_JOURNEYS_REQ");
    expect(ci).toContain("docs_journeys:");
    expect(interactionPerfJob).toContain("bun run test:interaction-perf");
    // Independent of component shards so it does not serialize the critical path;
    // still path-gated and informational (hard gate remains on run-bench).
    expect(interactionPerfJob).not.toContain("needs: [component]");
    expect(interactionPerfJob).toContain("informational");
    expect(read(".github/workflows/ci.yml")).toContain("interaction_perf == 'true'");
    expect(interactionPerfJob).toContain("uses: ./.github/actions/ci-download-packages-dist");
    expect(interactionPerfJob).toContain("packages-dist");
    expect(bench).toContain("ghcr.io/ljodea/ggsvelte/ci-runner:v1.61.1-noble");
    expect(bench).toContain("bun run test:interaction-perf");
    expect(read("package.json")).toContain('"test:interaction-perf"');
    expect(read("tests/performance/interaction.spec.ts")).toContain("/__perf/interaction-100k");
    expect(read("apps/docs/src/routes/__perf/interaction-100k/+page.svelte")).toContain(
      "length: 100_000",
    );
  });

  it("shares packages/*/dist via a packages-dist producer job (issue #241)", () => {
    const ci = readCiSurface();
    const producerJob = ciJob(ci, "packages-dist");
    expect(producerJob).toContain("packages_dist == 'true'");
    expect(producerJob).toContain("if-no-files-found: error");
    expect(producerJob).toContain("packages/spec/dist");
    expect(producerJob).toContain("packages/core/dist");
    expect(producerJob).toContain("packages/compose/dist");
    expect(producerJob).toContain("packages/svelte/dist");
    expect(producerJob).toContain("packages/react/dist");
    expect(producerJob).toContain("packages/cli/dist");
    expect(producerJob).toContain("run: bun run build");
    // Consumers download instead of rebuilding packages (via composite).
    const consumerJob = ciJob(ci, "consumer-compat");
    expect(consumerJob).toContain("uses: ./.github/actions/ci-download-packages-dist");
    expect(consumerJob).toContain("packages-dist");
    expect(consumerJob).not.toContain("run: bun run build");
    // Unit and bench-smoke keep the cheaper bun run check path (Codex plan review).
    const unitJob = ciJob(ci, "unit");
    expect(unitJob).toContain("bun run check");
    expect(unitJob).not.toContain("download-artifact");
  });

  it("content-hash skips scheduled jobs via physical execution keys (issue #245)", () => {
    const ci = readCiSurface();
    const restore = read(".github/actions/ci-content-hash-restore/action.yml");
    const write = read(".github/actions/ci-content-hash-write/action.yml");

    // Protocol lives in composites (single source of truth).
    expect(restore).toContain("hash-inputs");
    expect(restore).toContain("validate-success-marker");
    expect(restore).toContain("shell: bash");
    // The cached path is whatever hash-inputs computed, not a fixed name:
    // sharded executions get one marker per matrix leg (issue #1035), so a
    // hardcoded `.ci-content-hash/<execution>.ok` would cache the wrong file.
    expect(restore).toContain("path: ${{ steps.compute.outputs.marker_path }}");
    // Exact key only — no restore-keys on the success-marker cache step.
    const markerCache = restore.slice(
      restore.indexOf("id: marker_cache"),
      restore.indexOf("validate-success-marker"),
    );
    expect(markerCache).toContain("key:");
    expect(markerCache).not.toContain("restore-keys:");
    expect(write).toContain("write-success-marker");
    expect(write).toContain("shell: bash");

    // detect-changes exports bypass covering force-all / lockfile / ci.yml / router / actions.
    const detect = ciJob(ci, "detect-changes");
    expect(detect).toContain("bypass_content_cache:");
    // Job driver lives in scripts/ci-routing/detect-changes.ts (issue #393).
    expect(detect).toContain("scripts/ci-routing.ts detect-changes");
    expect(detect).not.toContain("emit-github-output");

    // packages-dist keeps its specialized dist-payload protocol (not the marker composite).
    const producerJob = ciJob(ci, "packages-dist");
    expect(producerJob).toContain("hash-inputs --execution packages_dist");
    expect(producerJob).toContain(".packages-dist-cache");
    expect(producerJob).toContain("steps.restore_dist.outputs.hit != 'true'");
    expect(producerJob).toContain("stage content-hash cache payload");
    const distCacheStep = producerJob.slice(
      producerJob.indexOf("restore packages-dist content-hash cache"),
      producerJob.indexOf("materialize packages/*/dist from content-hash cache"),
    );
    expect(distCacheStep).toContain("key: ${{ steps.content_hash.outputs.cache_key }}");
    expect(distCacheStep).not.toContain("restore-keys:");
    expect(producerJob).not.toContain("ci-content-hash-restore");

    const unitJob = ciJob(ci, "unit");
    expect(unitJob).toContain("uses: ./.github/actions/ci-content-hash-restore");
    expect(unitJob).toContain("uses: ./.github/actions/ci-content-hash-write");
    expect(unitJob).toContain("execution: unit");
    expect(unitJob).toContain("steps.content_hash.outputs.hit != 'true'");
    expect(unitJob).toContain("bypass_content_cache");
    expect(unitJob).toContain("CI_DISABLE_CONTENT_HASH");

    // Distinct physical keys for component shards (Codex P1).
    for (const [job, execution] of [
      ["component-svelte", "component_svelte"],
      ["component-svelte-fx", "component_svelte_fx"],
      ["component-spikes", "component_spikes"],
      ["component-journeys", "component_journeys"],
    ] as const) {
      const slice = ciJob(ci, job);
      expect(slice.length).toBeGreaterThan(0);
      expect(slice).toContain("uses: ./.github/actions/ci-content-hash-restore");
      expect(slice).toContain(`execution: ${execution}`);
      expect(slice).toContain("container_tag:");
    }

    // Sharded executions (issue #1035) must not let one matrix leg's success
    // green-cache a failing sibling. Two shapes are valid, and each component
    // execution must use exactly one of them:
    //   - self-marking: the leg writes its own per-shard marker (--shard I/N)
    //   - collect-marked: a downstream job that `needs` every leg writes the
    //     single unsharded marker once they have all passed
    for (const [job, execution] of [
      ["component-svelte-fx", "component_svelte_fx"],
      ["component-journeys", "component_journeys"],
    ] as const) {
      const slice = ciJob(ci, job);
      expect(slice, job).toContain("matrix:");
      expect(slice, job).toContain("uses: ./.github/actions/ci-content-hash-write");
      // Both the restore and the write must carry the leg identity, or the
      // legs would share one marker.
      const shardArgs = slice.match(/shard: \$\{\{ matrix\.shard }}\/\d+/g) ?? [];
      expect(shardArgs.length, `${execution} passes shard to restore and write`).toBe(2);
      // The CLI shard and the marker shard must agree.
      expect(slice, job).toContain("--shard=${{ matrix.shard }}");
    }

    // component-svelte is collect-marked: shards emit blob reports and write no
    // marker; the collect job merges them, gates coverage, and marks success.
    const svelteShards = ciJob(ci, "component-svelte");
    expect(svelteShards).toContain("matrix:");
    expect(svelteShards).toContain("--reporter=blob");
    expect(svelteShards).not.toContain("uses: ./.github/actions/ci-content-hash-write");
    // vitest writes blob reports to `.vitest-reports/`, and upload-artifact's
    // glob skips dotfiles unless told otherwise — without this the upload finds
    // nothing, fails on `if-no-files-found: error`, and the collect job is
    // skipped for want of blobs. Cost one CI round on PR #1036.
    expect(svelteShards).toContain("include-hidden-files: true");
    const svelteCollect = ciJob(ci, "component-svelte-coverage");
    expect(svelteCollect.length).toBeGreaterThan(0);
    expect(svelteCollect).toContain("needs: component-svelte");
    expect(svelteCollect).toContain("--merge-reports");
    expect(svelteCollect).toContain("uses: ./.github/actions/ci-content-hash-write");
    expect(svelteCollect).toContain("execution: component_svelte");

    // Consumer: runtime resolution stays in the job; matrix dims pass into restore composite.
    const consumerJob = ciJob(ci, "consumer-compat");
    expect(consumerJob).toContain("uses: ./.github/actions/ci-content-hash-restore");
    expect(consumerJob).toContain("execution: consumer");
    expect(consumerJob).toContain("matrix_node:");
    expect(consumerJob).toContain("matrix_pm:");
    expect(consumerJob).toContain("matrix_svelte:");
    expect(consumerJob).toContain("runtime_node_version:");
    expect(consumerJob).toContain("runtime_pm_version:");
    expect(consumerJob).toContain("node -v");
    expect(consumerJob).toContain("uses: ./.github/actions/ci-content-hash-write");

    // Marker jobs share the composite (not only unit). Split build keeps
    // independent content-hash executions so docs_site can cache-hit alone.
    for (const jobId of ["build", "svelte-check", "docs-site", "actions-security", "bench-smoke"]) {
      const slice = ciJob(ci, jobId);
      expect(slice.length, jobId).toBeGreaterThan(0);
      expect(slice).toContain("uses: ./.github/actions/ci-content-hash-restore");
      expect(slice).toContain("uses: ./.github/actions/ci-content-hash-write");
    }
    expect(ci).toContain("execution: svelte_check");
    expect(ci).toContain("execution: docs_site");
    // Concurrent: neither svelte-check nor docs-site waits on build.
    const orch = read(".github/workflows/ci.yml");
    const svelteOrch = orch.slice(orch.indexOf("  svelte-check:"), orch.indexOf("  docs-site:"));
    const docsOrch = orch.slice(orch.indexOf("  docs-site:"), orch.indexOf("  actions-security:"));
    expect(svelteOrch).toContain("needs: detect-changes");
    expect(svelteOrch).not.toContain("needs: [build");
    expect(docsOrch).toContain("needs: detect-changes");
    const docsSiteJob = ciJob(ci, "docs-site");
    expect(docsSiteJob).toContain("bun run build:docs");
    expect(docsSiteJob).toContain("bun run check:pages-links");
    // build job must still generate apps/docs/.svelte-kit before type-aware
    // (docs tsconfig extends it); sync used to come free via monlithic check:docs.
    const buildJob = ciJob(ci, "build");
    const syncAt = buildJob.indexOf("svelte-kit sync");
    const typeAwareAt = buildJob.indexOf("lint:type-aware");
    expect(syncAt).toBeGreaterThan(-1);
    expect(typeAwareAt).toBeGreaterThan(syncAt);

    // actions-security scans composites after extraction (zizmor path scope).
    const actionsSecurity = ciJob(ci, "actions-security");
    expect(actionsSecurity).toMatch(/zizmor==1\.26\.1 \.github\/workflows \.github\/actions/);

    // Router modules document invalidation + schema + composite recipe inputs.
    // Implementation lives under scripts/ci-routing/; the root file re-exports.
    const routing = read("scripts/ci-routing.ts");
    const contentHash = read("scripts/ci-routing/content-hash.ts");
    const contentHashTypes = read("scripts/ci-routing/content-hash-types.ts");
    const contentHashInputs = read("scripts/ci-routing/content-hash-inputs.ts");
    // Implementation lives in ci-routing/plan.ts + patterns.ts; the facade re-exports.
    const pathRouting = read("scripts/ci-routing/plan.ts");
    expect(routing).toContain("CONTENT_HASH_SCHEMA");
    expect(routing).toContain("JOB_CONTENT_INPUTS");
    expect(contentHashTypes).toContain("CONTENT_HASH_SCHEMA");
    expect(contentHashInputs).toContain("JOB_CONTENT_INPUTS");
    expect(contentHashInputs).toContain(".github/actions/**");
    expect(contentHash).toContain("CI_DISABLE_CONTENT_HASH");
    expect(pathRouting).toContain("ci_actions");
    expect(read("scripts/ci-routing/content-hash.ts")).toContain("bypass_content_cache");
    expect(read("CONTRIBUTING.md")).toContain("content-hash");
  });

  it("enforces retained memory on path-routed bench-smoke CI jobs", () => {
    const ci = readCiSurface();
    expect(ci).toContain("bun run bench:memory:check");
    expect(ci).toContain("bench_smoke == 'true'");
  });

  it("path-routes CI jobs through scripts/ci-routing.ts and a ci-gate aggregator", () => {
    const ci = readCiSurface();
    // ci.yml and vr-compare both delegate path routing to the detect-changes
    // driver (shared resolveRouteInputs base resolution — issue #415).
    expect(ci).toContain("scripts/ci-routing.ts detect-changes");
    expect(ci).toContain("  detect-changes:");
    expect(ci).toContain("  ci-gate:");
    expect(ci).toContain("ci-gate (required aggregator)");
    expect(ci).toContain("DETECT_RESULT");
    // Fifteen routing outputs must stay wired for branch protection / needs.
    for (const out of [
      "checks:",
      "unit:",
      "component:",
      "consumer:",
      "build:",
      "svelte_check:",
      "docs_site:",
      "actions_security:",
      "bench_smoke:",
      "interaction_perf:",
      "packages_dist:",
      "vr:",
      "pages:",
      "docs_journeys:",
      "bypass_content_cache:",
    ]) {
      expect(ci, out).toContain(`      ${out}`);
    }
    // Checks job is pre-commit stage only (format/lint/guards). Heavy analysis
    // lives on dedicated CI jobs — never reintroduced via hook-stage pre-push.
    expect(ci).not.toContain("hook-stage pre-push");
    expect(ci).toContain("pre-commit run --all-files --show-diff-on-failure");
    expect(ci).toContain("bun run lint:type-aware");
    expect(ci).toContain("bun run knip");
    expect(read(".pre-commit-config.yaml")).not.toContain("pre-push");
    const vrCompare = read(".github/workflows/vr-compare.yml");
    // Shared base-resolution with ci.yml (issue #415) — no inline force-all bash.
    expect(vrCompare).toContain("scripts/ci-routing.ts detect-changes");
    expect(vrCompare).not.toContain("emit-github-output");
    expect(vrCompare).not.toContain('zero="0000000000000000000000000000000000000000"');
  });
});
