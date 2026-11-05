// Component tests: vitest 4 browser mode, Playwright's three browser engines —
// the same harness pattern as the retired spikes/browser suites. Versions are
// pinned together with the CI Playwright container (asserted in CI).
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { coverageBase } from "./vitest.coverage.js";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

import { diagnosticPlaywright } from "./tests/helpers/browser-diagnostics.js";
import { ggplotSsrEndpoint } from "./tests/helpers/ggplot-ssr-endpoint.js";

export default defineConfig({
  plugins: [svelte(), ggplotSsrEndpoint()],
  // One svelte runtime only: without these, vite prebundles the svelte
  // runtime for the component imports while @testing-library/svelte-core
  // loads the source copy -> two runtimes -> effect_orphan errors.
  resolve: { dedupe: ["svelte"] },
  optimizeDeps: { exclude: ["svelte", "@testing-library/svelte-core"] },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/**/*.ssr.test.ts"],
    retry: process.env.CI === "true" ? 1 : 0,
    // Keep per-file isolate (selection-state and friends rely on clean module
    // state). Cap concurrent browser workers in CI so GH-hosted runners do not
    // open dozens of isolated iframes under coverage-v8, which flakes as:
    //   - Failed to fetch dynamically imported module (...test.ts / coverage-v8/browser)
    //   - Cannot connect to the iframe
    // (Storybook vitest-addon CI FAQ; seen on Version Packages #440).
    maxWorkers: process.env.CI === "true" ? 2 : undefined,
    // Opt-in via --coverage. Browser collection runs on Chromium only
    // (v8-over-CDP); invoke with --project chromium so firefox/webkit
    // are not asked to report coverage.
    coverage: {
      ...coverageBase,
      reportsDirectory: "coverage/browser",
      // The codemod is a node-only build tool: it imports svelte/compiler and
      // walks source text, and nothing in a browser component test can reach
      // it. Its own suite lives in the SSR lane (tests/codemod/*.ssr.test.ts),
      // which CI runs without --coverage because coverage-v8 cannot collect
      // under bun there. Leaving it in this denominator would tax the browser
      // threshold with ~400 statements the browser lane can never execute.
      exclude: ["src/lib/codemod/**"],
      // Browser-only gate: keep thresholds on this config (not coverageBase)
      // so the structurally-low SSR report is not blocked. Values sit ≥5pp
      // under current mature browser totals to ratchet regressions without
      // flake. CI runs chromium with --coverage (same thresholds) and uploads lcov.
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
    browser: {
      enabled: true,
      // GGTS_BROWSER_DIAGNOSTICS=1 adds [browser-diag] log lines for issue #1924.
      provider:
        process.env.GGTS_BROWSER_DIAGNOSTICS === "1" ? diagnosticPlaywright() : playwright(),
      headless: true,
      screenshotFailures: true,
      screenshotDirectory: "test-results/screenshots",
      trace: {
        mode: "on-first-retry",
        tracesDir: "test-results/traces",
        screenshots: true,
        snapshots: false,
      },
      instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
    },
  },
});
