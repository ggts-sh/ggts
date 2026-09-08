/**
 * CI path routing — static pattern tables.
 *
 * - DOCS_CONTENT_ONLY_PATHS: apps/docs paths that change published text without
 *   chart-frame pixels (fail-closed allowlist).
 * - DOCS_CONTENT_SCRIPT_PATTERNS: exact-equality Set membership — every entry
 *   must be a literal repo path (globs are inert here). Split content
 *   generators and their co-located unit tests are enumerated explicitly.
 * - LANE_PATTERNS: path patterns per change lane. `**` = this dir or any
 *   descendant; matched by matchPathPattern (see match.ts).
 */
import type { ChangeLane } from "./types";

/**
 * Docs paths that change published text/structure without chart-frame pixels.
 * Fail-closed: any other `apps/docs/**` path is treated as render-relevant.
 */
export const DOCS_CONTENT_ONLY_PATHS: readonly string[] = [
  "apps/docs/src/lib/catalog/guide.ts",
  "apps/docs/src/lib/catalog/docs-tasks.ts",
  "apps/docs/src/lib/catalog/gallery.ts",
  "apps/docs/src/lib/catalog/themes.ts",
  "apps/docs/src/lib/guide.ts",
  "apps/docs/src/lib/generated/search-index.ts",
  "apps/docs/src/lib/generated/routes.ts",
  // Split from routes.ts: sidebar labels only (no pixels).
  "apps/docs/src/lib/generated/guide-navigation.ts",
  "apps/docs/src/lib/generated/gallery-previews.ts",
];

/**
 * Script generators listed here for documentation / isDocsContentOnlyPath consumers.
 * For `scripts/**` paths this list has no routing effect: `isDocsRenderPath` only
 * returns true for `apps/docs/**` and screenshot baselines (see that function).
 * Keep membership aligned with LANE_PATTERNS.docs content generators when useful
 * for vr-baseline-guard and future tightening; do not treat absence as "render".
 *
 * Exact-equality Set: entries are literal paths, never globs — split subtrees
 * (scripts/llms-guide/**, scripts/gen-llms/** tests) must be enumerated file
 * by file.
 */
export const DOCS_CONTENT_SCRIPT_PATTERNS: readonly string[] = [
  "scripts/gen-llms.ts",
  "scripts/llms-diagnostic-docs.ts",
  "scripts/llms-lifecycle-docs.ts",
  "scripts/gen-llms/markdown.test.ts",
  "scripts/gen-llms/guide-content.test.ts",
  "scripts/gen-llms/prune-spec-data.test.ts",
  "scripts/gen-llms/surfaces.test.ts",
  "scripts/gen-llms/exports.test.ts",
  "scripts/llms-markdown.ts",
  "scripts/llms-guide-content.ts",
  // sakura-lesson.test.ts split units (content-only unit tests next to the
  // quickstart generators).
  "scripts/quickstart/fold.test.ts",
  "scripts/quickstart/axis.test.ts",
  "scripts/quickstart/annotations.test.ts",
  "scripts/quickstart/trend.test.ts",
  "scripts/quickstart/epochs.test.ts",
  "scripts/quickstart/layout.test.ts",
  // llms-guide-content.ts split units (guide text, no chart-frame pixels).
  "scripts/llms-guide/getting-started.ts",
  "scripts/llms-guide/statistics-transforms.ts",
  "scripts/llms-guide/statistics-positions.ts",
  "scripts/llms-guide/statistics-summaries.ts",
  "scripts/llms-guide/scales-guides.ts",
  "scripts/llms-guide/facets-coordinates.ts",
  "scripts/llms-guide/production.ts",
  "scripts/llms-guide/temporal-scales.ts",
  "scripts/llms-guide/interactions.ts",
  "scripts/llms-guide/interaction-reference.ts",
  "scripts/llms-guide/upgrading-current.ts",
  "scripts/llms-guide/upgrading-legacy-1.ts",
  "scripts/llms-guide/upgrading-legacy-2.ts",
  "scripts/llms-guide/upgrading-legacy-3.ts",
  "scripts/llms-guide/upgrading.ts",
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
  "scripts/cloudflare-pages-config.test.ts",
  "scripts/deployment-artifact.ts",
  "scripts/deployment-artifact.test.ts",
  "scripts/deployment-smoke.ts",
  "scripts/deployment-smoke-cli.ts",
  "scripts/deployment-smoke.test.ts",
  "lifecycle.json",
];

/** Path patterns per change lane. `**` = this dir or any descendant. */
export const LANE_PATTERNS: Record<ChangeLane, readonly string[]> = {
  spec: ["packages/spec/**"],
  core: ["packages/core/**"],
  cli: ["packages/cli/**"],
  svelte: ["packages/svelte/**", "packages/skill/**", "packages/compose/**", "packages/react/**"],
  docs: [
    "apps/docs/**",
    // Docs app imports `$scripts/gen-llms` and ships lifecycle-driven guide content.
    "scripts/gen-llms.ts",
    "scripts/llms-diagnostic-docs.ts",
    "scripts/llms-lifecycle-docs.ts",
    "scripts/gen-llms.test.ts",
    "scripts/gen-llms/**",
    "scripts/llms-markdown.ts",
    "scripts/highlight-code.ts",
    "scripts/highlight-code.test.ts",
    "scripts/llms-guide-content.ts",
    "scripts/llms-guide/**",
    "scripts/docs-seo.ts",
    "scripts/docs-seo-image.ts",
    "scripts/docs-seo.test.ts",
    "scripts/gen-og-home.ts",
    "scripts/docs-breadcrumbs.ts",
    "scripts/docs-breadcrumbs.test.ts",
    "scripts/diagnostic-docs.ts",
    "scripts/quickstart.ts",
    "scripts/quickstart/**",
    "scripts/cli-docs.ts",
    "scripts/guide-code-contract.ts",
    "scripts/agent-quickstart.ts",
    "scripts/gen-docs-search.ts",
    "scripts/gen-docs-search.test.ts",
    "scripts/gen-gallery-previews.ts",
    "scripts/gen-gallery-previews.test.ts",
    "scripts/gallery-preview-provenance.ts",
    "scripts/gallery-preview-provenance.test.ts",
    // apps/docs package.json build/check invoke these — must schedule svelte_check + docs_site
    // after the monlith split (Codex P2: pure scripts/** no longer runs vite docs).
    "scripts/gen-docs-routes.ts",
    "scripts/gen-docs-routes.test.ts",
    // Shared inventory imported by gen-docs-routes / check-docs-metadata /
    // deployment-artifact (Codex P2: inventory-only PRs were scripts-lane only).
    "scripts/docs-route-inventory.ts",
    "scripts/docs-route-inventory-pages.ts",
    "scripts/docs-route-inventory-reference.ts",
    "scripts/docs-route-inventory.test.ts",
    "scripts/check-docs-metadata.ts",
    "scripts/check-docs-metadata.test.ts",
    "scripts/check-pages-links.ts",
    "scripts/check-pages-links.test.ts",
    // Homepage benchmark charts (build/check run gen-benchmark-charts --check).
    "scripts/gen-benchmark-charts.ts",
    "scripts/benchmark-charts/**",
    // Themes/palettes shell externalization (HTML shrink).
    "scripts/gen-theme-static-shells.ts",
    "scripts/docs-html-shell-external.test.ts",
    "scripts/docs-csp.ts",
    "scripts/docs-csp.test.ts",
    // Deployment generators and smoke contracts change the published artifact.
    "scripts/cloudflare-pages-config.test.ts",
    "scripts/deployment-artifact.ts",
    "scripts/deployment-artifact.test.ts",
    "scripts/deployment-smoke.ts",
    "scripts/deployment-smoke-cli.ts",
    "scripts/deployment-smoke.test.ts",
    // Public gallery previews are materialized from canonical light baselines.
    "tests/visual/__screenshots__/**",
    "lifecycle.json",
  ],
  // Filled by classifyChangedPaths using content-only allowlists (fail-closed).
  docs_render: [],
  examples: ["examples/**"],
  benchmarks: ["benchmarks/**"],
  scripts: [
    "scripts/**",
    "lifecycle.json",
    // Unit suite validates manual-AT evidence + community forms + Changesets config.
    "docs/accessibility/manual-at/**",
    ".github/ISSUE_TEMPLATE/**",
    ".github/DISCUSSION_TEMPLATE/**",
    ".changeset/**",
    // readme-showcase + package-readme tests read these as contract inputs.
    "README.md",
    "packages/spec/README.md",
    "packages/core/README.md",
    "packages/compose/README.md",
    "packages/svelte/README.md",
    "packages/react/README.md",
    "packages/cli/README.md",
    "packages/skill/README.md",
  ],
  // Cloudflare workers (when present). Own bun tests + type-aware lint/knip.
  // Nothing under workers/** renders charts, so no browser/docs surface.
  workers: ["workers/**"],
  evals: ["tests/evals/**"],
  workflows: [
    ".github/workflows/**",
    ".github/actionlint.yaml",
    // Only the actions-security job runs the real actionlint runner against workflows.
    "scripts/actionlint.ts",
    "scripts/actionlint.test.ts",
  ],
  // Orchestrator + every reusable domain workflow called from it.
  ci_workflow: [".github/workflows/ci.yml", ".github/workflows/ci-*.yml"],
  ci_routing: ["scripts/ci-routing.ts", "scripts/ci-routing/**"],
  // Local composite actions used by ci.yml (content-hash restore/write). A change
  // here is a CI recipe change: bypass content-hash caches, schedule
  // actions_security — but do not product-force VR/component/consumer.
  ci_actions: [".github/actions/**"],
  visual: ["tests/visual/**"],
  performance: [
    "tests/performance/**",
    // Direct inputs to the Playwright interaction-perf job.
    "apps/docs/src/routes/__perf/**",
    "benchmarks/interaction-budgets.json",
  ],
  spikes: ["spikes/**"],
  // Packed-consumer harness (not the whole scripts/ tree — matrix is expensive).
  consumer_tools: [
    "scripts/consumer-compat.ts",
    "scripts/consumer-compat-plan.ts",
    "scripts/consumer-compat-fixture.ts",
    "scripts/consumer-compat-react-fixture.ts",
    "scripts/consumer-compat-skill.ts",
    "scripts/consumer-compat-skill.test.ts",
    "scripts/consumer-compat.test.ts",
    // Packed fixture snippets live here; consumer-compat imports them.
    "scripts/guide-code-contract.ts",
    "scripts/agent-quickstart.ts",
    "scripts/quickstart.ts",
    "scripts/quickstart/**",
    "scripts/quickstart-timing.ts",
    "scripts/quickstart-timing.test.ts",
    "scripts/support-matrix.ts",
    "scripts/support-matrix.test.ts",
  ],
  lockfile: [
    "bun.lock",
    "package.json",
    "tsconfig.json",
    "tsconfig.base.json",
    "knip.jsonc",
    ".pre-commit-config.yaml",
    "bunfig.toml",
    "support-matrix.json",
    ".oxlintrc.json",
    ".oxfmtrc.json",
    ".markdownlint-cli2.jsonc",
  ],
  markdown: ["**/*.md", "**/*.mdx"],
};
