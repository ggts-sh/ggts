/**
 * Content-hash job input path tables and matching (issue #245).
 * Identity types: content-hash-types.ts. Hash/markers/git: siblings.
 */
import { matchPathPattern } from "./routing";
import type { CacheableExecution } from "./content-hash-types";

const UNIVERSAL_CONTENT_INPUTS: readonly string[] = [
  ".github/workflows/ci.yml",
  // Domain job bodies live in reusable workflows (issue #392).
  ".github/workflows/ci-*.yml",
  // Composite actions hold the success-marker protocol after extraction from ci.yml.
  ".github/actions/**",
  "scripts/ci-routing.ts",
  "scripts/ci-routing/**",
  "bun.lock",
  "package.json",
  "tsconfig.json",
  "tsconfig.base.json",
  "bunfig.toml",
];

/**
 * Docs app + every script that can change svelte-check / vite docs-site
 * outcomes (generators, $scripts imports, pages-link / metadata gates).
 * Shared so the three post-split jobs cannot false-green on omitted inputs.
 */
const DOCS_SURFACE_CONTENT_INPUTS: readonly string[] = [
  "apps/docs/**",
  "examples/**",
  "lifecycle.json",
  // apps/docs package.json build/check invoke these generators.
  "scripts/gen-docs-routes.ts",
  "scripts/docs-route-inventory.ts",
  "scripts/docs-route-inventory-pages.ts",
  "scripts/docs-route-inventory-reference.ts",
  "scripts/docs-route-inventory.test.ts",
  "scripts/gen-docs-search.ts",
  "scripts/gen-docs-search.test.ts",
  "scripts/gen-gallery-previews.ts",
  "scripts/gen-gallery-previews.test.ts",
  "scripts/gallery-preview-provenance.ts",
  "scripts/gallery-preview-provenance.test.ts",
  "scripts/check-docs-metadata.ts",
  "scripts/check-pages-links.ts",
  // build/check --check generators; build runs docs-csp after vite.
  "scripts/gen-benchmark-charts.ts",
  "scripts/benchmark-charts/**",
  "scripts/gen-theme-static-shells.ts",
  "scripts/docs-csp.ts",
  // $scripts imports used by docs routes / layout (typecheck + published site).
  "scripts/gen-llms.ts",
  "scripts/llms-diagnostic-docs.ts",
  "scripts/llms-lifecycle-docs.ts",
  "scripts/llms-guide-content.ts",
  "scripts/llms-guide/**",
  "scripts/llms-markdown.ts",
  "scripts/gen-llms/**",
  "scripts/docs-seo.ts",
  "scripts/docs-seo-image.ts",
  "scripts/docs-seo.test.ts",
  "scripts/gen-og-home.ts",
  "scripts/docs-breadcrumbs.ts",
  "scripts/diagnostic-docs.ts",
  "scripts/cli-docs.ts",
  "scripts/guide-code-contract.ts",
  "scripts/agent-quickstart.ts",
  "scripts/quickstart.ts",
  "scripts/quickstart/**",
  "scripts/highlight-code.ts",
  "scripts/highlight-code.test.ts",
  "scripts/deployment-artifact.ts",
  "scripts/deployment-smoke.ts",
  "scripts/deployment-smoke-cli.ts",
];

/**
 * Conservative content inputs per physical execution.
 * Patterns use the same matcher as path routing (no negation). Prefer broad
 * trees over incomplete maps that could false-green.
 */
export const JOB_CONTENT_INPUTS: Record<CacheableExecution, readonly string[]> = {
  packages_dist: [
    ...UNIVERSAL_CONTENT_INPUTS,
    "packages/spec/**",
    "packages/core/**",
    "packages/compose/**",
    "packages/svelte/**",
    "packages/react/**",
    "packages/cli/**",
  ],
  unit: [
    ...UNIVERSAL_CONTENT_INPUTS,
    "packages/spec/**",
    "packages/core/**",
    "packages/compose/**",
    "packages/svelte/**",
    "packages/react/**",
    "packages/cli/**",
    "benchmarks/**",
    "scripts/**",
    "tests/evals/**",
    // workers/** (when present) run in the unit suite.
    "workers/**",
    "docs/accessibility/**",
    ".github/ISSUE_TEMPLATE/**",
    ".github/DISCUSSION_TEMPLATE/**",
    ".changeset/**",
    "packages/skill/**",
    "lifecycle.json",
    "apps/docs/**",
    "examples/**",
    ".github/workflows/**",
    // scripts/actionlint.test.ts asserts self-hosted labels against this file.
    ".github/actionlint.yaml",
    "support-matrix.json",
    ".oxlintrc.json",
    ".oxfmtrc.json",
    ".markdownlint-cli2.jsonc",
    "knip.jsonc",
    ".pre-commit-config.yaml",
    // scripts/readme-showcase.test.ts + package-readme.test.ts contract npm
    // and GitHub front-door snippets.
    "README.md",
    "packages/spec/README.md",
    "packages/core/README.md",
    "packages/compose/README.md",
    "packages/svelte/README.md",
    "packages/react/README.md",
    "packages/cli/README.md",
    "packages/skill/README.md",
  ],
  // Package build + knip + type-aware + publint + examples tsc (no vite docs site).
  // apps/docs stays hashed: knip + oxlint --type-aware still cover the docs app,
  // and routing still schedules build for docsSurface changes (Codex P2).
  build: [
    ...UNIVERSAL_CONTENT_INPUTS,
    "packages/spec/**",
    "packages/core/**",
    "packages/compose/**",
    "packages/svelte/**",
    "packages/react/**",
    "packages/cli/**",
    "apps/docs/**",
    "examples/**",
    // check:scripts-ci-routing tsc covers scripts/ci-routing/** (#734); the
    // rest of scripts/** is still type-aware lint + knip only.
    "scripts/**",
    "tests/evals/**",
    // build re-enters `bun run check` plus repo-wide type-aware lint + knip.
    "workers/**",
    "packages/skill/**",
    "lifecycle.json",
    "support-matrix.json",
    ".oxlintrc.json",
    ".oxfmtrc.json",
    ".markdownlint-cli2.jsonc",
    "knip.jsonc",
    ".pre-commit-config.yaml",
    ".github/workflows/**",
  ],
  // svelte-check for packages/svelte + apps/docs (generators + check).
  svelte_check: [
    ...UNIVERSAL_CONTENT_INPUTS,
    "packages/spec/**",
    "packages/core/**",
    "packages/compose/**",
    "packages/svelte/**",
    "packages/cli/**",
    ...DOCS_SURFACE_CONTENT_INPUTS,
  ],
  // Full vite adapter-static docs site + packed pages-link gate.
  docs_site: [
    ...UNIVERSAL_CONTENT_INPUTS,
    "packages/spec/**",
    "packages/core/**",
    "packages/compose/**",
    "packages/svelte/**",
    "packages/cli/**",
    ...DOCS_SURFACE_CONTENT_INPUTS,
  ],
  actions_security: [
    ...UNIVERSAL_CONTENT_INPUTS,
    ".github/workflows/**",
    ".github/actionlint.yaml",
    "scripts/actionlint.ts",
    "scripts/actionlint.test.ts",
  ],
  bench_smoke: [
    ...UNIVERSAL_CONTENT_INPUTS,
    "benchmarks/**",
    "packages/spec/**",
    "packages/core/**",
    "packages/compose/**",
    "packages/svelte/**",
    "packages/react/**",
    "packages/cli/**",
  ],
  interaction_perf: [
    ...UNIVERSAL_CONTENT_INPUTS,
    "tests/performance/**",
    "apps/docs/src/routes/__perf/**",
    "benchmarks/interaction-budgets.json",
    "packages/spec/**",
    "packages/core/**",
    "packages/compose/**",
    "packages/svelte/**",
    "packages/cli/**",
    "apps/docs/**",
    "examples/**",
  ],
  component_svelte: [
    ...UNIVERSAL_CONTENT_INPUTS,
    "packages/spec/**",
    "packages/core/**",
    "packages/compose/**",
    "packages/svelte/**",
    "packages/react/**",
    "packages/cli/**",
    "packages/skill/**",
  ],
  // Same inputs as component_svelte (shared packages/svelte tree); distinct
  // execution key so chromium+coverage and firefox+webkit cache independently.
  component_svelte_fx: [
    ...UNIVERSAL_CONTENT_INPUTS,
    "packages/spec/**",
    "packages/core/**",
    "packages/compose/**",
    "packages/svelte/**",
    "packages/react/**",
    "packages/cli/**",
    "packages/skill/**",
  ],
  component_spikes: [
    ...UNIVERSAL_CONTENT_INPUTS,
    "packages/spec/**",
    "packages/core/**",
    "packages/compose/**",
    "packages/svelte/**",
    "packages/cli/**",
    "spikes/**",
  ],
  component_journeys: [
    ...UNIVERSAL_CONTENT_INPUTS,
    "packages/spec/**",
    "packages/core/**",
    "packages/compose/**",
    "packages/svelte/**",
    "packages/cli/**",
    "apps/docs/**",
    "examples/**",
    "tests/visual/**",
    "packages/skill/**",
    "lifecycle.json",
    // Docs generators that schedule docs_journeys must bust this cache
    // (Codex P2: content-only scripts were omitting gen-docs-search / gallery).
    "scripts/gen-llms.ts",
    "scripts/llms-diagnostic-docs.ts",
    "scripts/llms-lifecycle-docs.ts",
    "scripts/gen-llms/**",
    "scripts/llms-markdown.ts",
    // llms-markdown imports highlight-code for fenced-block HTML; hash it or
    // a highlight-only change can cache-hit and skip docs journeys (Codex P2).
    "scripts/highlight-code.ts",
    "scripts/highlight-code.test.ts",
    "scripts/llms-guide-content.ts",
    "scripts/llms-guide/**",
    "scripts/docs-seo.ts",
    "scripts/docs-seo-image.ts",
    "scripts/docs-seo.test.ts",
    "scripts/gen-og-home.ts",
    "scripts/docs-breadcrumbs.ts",
    "scripts/diagnostic-docs.ts",
    "scripts/cli-docs.ts",
    "scripts/guide-code-contract.ts",
    "scripts/agent-quickstart.ts",
    "scripts/gen-docs-search.ts",
    "scripts/gen-docs-search.test.ts",
    "scripts/gen-gallery-previews.ts",
    "scripts/gen-gallery-previews.test.ts",
    "scripts/gallery-preview-provenance.ts",
    "scripts/gallery-preview-provenance.test.ts",
    "scripts/gen-benchmark-charts.ts",
    "scripts/benchmark-charts/**",
    "scripts/gen-theme-static-shells.ts",
    "scripts/cloudflare-pages-config.test.ts",
    "scripts/deployment-artifact.ts",
    "scripts/deployment-artifact.test.ts",
    "scripts/deployment-smoke.ts",
    "scripts/deployment-smoke-cli.ts",
    "scripts/deployment-smoke.test.ts",
    "scripts/quickstart.ts",
    "scripts/quickstart/**",
    "scripts/gen-manifest.ts",
    "scripts/gen-lifecycle.ts",
  ],
  consumer: [
    ...UNIVERSAL_CONTENT_INPUTS,
    "packages/spec/**",
    "packages/core/**",
    "packages/compose/**",
    "packages/svelte/**",
    "packages/react/**",
    "packages/skill/**",
    "packages/cli/**",
    "scripts/consumer-compat.ts",
    "scripts/consumer-compat-plan.ts",
    "scripts/consumer-compat-fixture.ts",
    "scripts/consumer-compat-react-fixture.ts",
    "scripts/consumer-compat-skill.ts",
    "scripts/consumer-compat-skill.test.ts",
    "scripts/consumer-compat.test.ts",
    "scripts/guide-code-contract.ts",
    "scripts/agent-quickstart.ts",
    "scripts/quickstart.ts",
    "scripts/quickstart/**",
    "scripts/quickstart-timing.ts",
    "scripts/quickstart-timing.test.ts",
    "scripts/support-matrix.ts",
    "scripts/support-matrix.test.ts",
    "support-matrix.json",
  ],
};

export function listJobContentPaths(
  execution: CacheableExecution,
  allPaths: readonly string[],
): string[] {
  const patterns = JOB_CONTENT_INPUTS[execution];
  const matched = new Set<string>();
  for (const raw of allPaths) {
    const file = raw.replaceAll("\\", "/").replace(/^\.\//, "");
    if (!file || file === ".") continue;
    for (const pattern of patterns) {
      if (matchPathPattern(pattern, file)) {
        matched.add(file);
        break;
      }
    }
  }
  return [...matched].toSorted();
}
