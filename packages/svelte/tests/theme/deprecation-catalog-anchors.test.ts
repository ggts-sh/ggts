/**
 * Test 13: every DEPRECATION_DIAGNOSTIC_CATALOG docUrl anchor resolves against
 * the rendered upgrading guide. The deprecation-wiring test only walks JSDoc;
 * this guards the runtime docUrl anchors that ship on live advisories.
 *
 * Runs under the root bun test suite (scripts + package tests) via a thin
 * re-export in scripts/ — actually this file is under packages/svelte/tests
 * and runs with vitest. Anchor resolution needs the guide renderer from
 * scripts/, so the authoritative check lives in scripts/deprecation-catalog-anchors.test.ts.
 */
import { describe, expect, it } from "vitest";

import { deprecatedPropDiagnostic } from "../../src/lib/diagnostics/deprecation.js";

describe("deprecation diagnostic docUrl shape", () => {
  it("theme advisory points at the upgrading guide compose-theme anchor", () => {
    const d = deprecatedPropDiagnostic({
      prop: "theme",
      since: "0.11.0",
      removeIn: "0.13.0",
      suggestions: ["use <ThemeDark />"],
      anchor: "compose-the-theme-as-a-child-layer",
    });
    expect(d.docUrl).toBe("https://ggts.sh/guide/upgrading#compose-the-theme-as-a-child-layer");
  });
});
