/**
 * Catalog-driven guide sections: each built page must cover its source
 * catalog (errors, advisories, lifecycle, quickstart embed, temporal,
 * production support matrix, interactions) — zero manual upkeep, the pages
 * cannot drift from the catalogs they document.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ADVISORY_CATALOG, CLI_DIAGNOSTIC_CATALOG, PIPELINE_WARNING_CATALOG } from "@ggsvelte/core";
import { ERROR_CATALOG, LINT_CATALOG, PIPELINE_ERROR_CATALOG } from "@ggsvelte/spec";
import { INTERACTION_DIAGNOSTIC_CATALOG } from "../../packages/svelte/src/lib/interaction/interaction.ts";
import { QUICKSTART_PAGE_SVELTE, SAKURA_STEPS } from "../quickstart.ts";
import {
  buildAdvisoriesMd,
  buildDiagnosticDocs,
  buildErrorsMd,
  buildLifecycleMd,
  GETTING_STARTED_MD,
  INTERACTION_REFERENCE_INDEX,
  INTERACTION_REFERENCE_MD,
  INTERACTIONS_MD,
  PRODUCTION_MD,
  renderMarkdown,
  STATISTICS_POSITIONS_MD,
  TEMPORAL_SCALES_MD,
  UPGRADING_MD,
  type LifecycleDoc,
} from "../gen-llms.ts";

const lifecycle = JSON.parse(
  readFileSync(join(import.meta.dir, "..", "..", "lifecycle.json"), "utf8"),
) as LifecycleDoc;

describe("guide sections cover their catalogs", () => {
  it("errors page presents every source-qualified diagnostic with stable anchors", () => {
    const entries = buildDiagnosticDocs();
    const expectedCount =
      Object.keys(ERROR_CATALOG).length +
      Object.keys(PIPELINE_ERROR_CATALOG).length +
      Object.keys(PIPELINE_WARNING_CATALOG).length +
      Object.keys(INTERACTION_DIAGNOSTIC_CATALOG).length +
      Object.keys(CLI_DIAGNOSTIC_CATALOG).length;
    expect(entries).toHaveLength(expectedCount);
    expect(new Set(entries.map((entry) => `${entry.source}:${entry.code}`)).size).toBe(
      expectedCount,
    );
    expect(
      entries.find((entry) => entry.source === "validation" && entry.code === "unknown-field"),
    ).toMatchObject({ anchor: "unknown-field", severity: "error", consequence: "blocked" });
    expect(
      entries.find((entry) => entry.source === "pipeline" && entry.code === "unknown-field"),
    ).toMatchObject({
      anchor: "unknown-field-pipeline",
      severity: "error",
      consequence: "blocked",
    });
    expect(
      entries.find((entry) => entry.source === "warning" && entry.code === "palette-exhausted"),
    ).toMatchObject({ anchor: "palette-exhausted-warning", consequence: "degraded" });
    expect(
      entries.find((entry) => entry.source === "cli" && entry.code === "max-marks-exceeded"),
    ).toMatchObject({ anchor: "max-marks-exceeded-cli", consequence: "blocked" });

    const html = renderMarkdown(buildErrorsMd());
    for (const entry of entries) {
      expect(html).toContain(`id="${entry.anchor}"`);
      expect(entry.whatFailed).not.toBe("");
      expect(entry.why).not.toBe("");
      expect(entry.fix).not.toBe("");
    }
    expect(buildErrorsMd()).toContain("## Quickstart troubleshooting");
    expect(buildErrorsMd()).toContain("Minimal illustration — copy only the relevant fragment");
  });

  it("advisories page names every lint + heuristic code", () => {
    const md = buildAdvisoriesMd();
    for (const code of Object.keys(LINT_CATALOG)) expect(md).toContain(`\`${code}\``);
    for (const code of Object.keys(ADVISORY_CATALOG)) expect(md).toContain(`\`${code}\``);
  });

  it("lifecycle page covers every surface and the stable-intent set", () => {
    const md = buildLifecycleMd(lifecycle);
    for (const s of lifecycle.surfaces) expect(md).toContain(s.package);
    expect(md).toContain("`normalize`");
    expect(md).toContain("stable-intent");
    expect(md).toContain("edition: 2");
    expect(md).not.toContain("stamps `edition: 1`");
  });

  it("carries the exact complete SvelteKit page", () => {
    expect(GETTING_STARTED_MD).toContain(QUICKSTART_PAGE_SVELTE);
    expect(GETTING_STARTED_MD.match(/```svelte complete/g)).toHaveLength(2);
    expect(QUICKSTART_PAGE_SVELTE).toContain("GeomPoint");
    expect(QUICKSTART_PAGE_SVELTE).toContain("GGPlot");
    expect(QUICKSTART_PAGE_SVELTE).toContain("ScaleXContinuous");
    expect(QUICKSTART_PAGE_SVELTE).toContain("Labs");
    expect(QUICKSTART_PAGE_SVELTE).toContain('import { kyotoSakura } from "@ggsvelte/core/data"');
    expect(QUICKSTART_PAGE_SVELTE).toContain('aes={{ x: "year", y: "bloomDate" }}');
    // ariaLabel is production polish; the basic plot stays bare.
    expect(QUICKSTART_PAGE_SVELTE).not.toMatch(/ariaLabel=/);
    expect(QUICKSTART_PAGE_SVELTE).not.toMatch(/\bwidth=/);
    expect(QUICKSTART_PAGE_SVELTE).not.toMatch(/\bheight=/);
  });

  it("leads with install, PortableSpec, and the validate loop", () => {
    const order = [
      "## Choose your surface",
      "## React",
      "## Svelte",
      "## The PortableSpec contract",
      "## The validate loop",
    ];
    let previous = -1;
    for (const heading of order) {
      const at = GETTING_STARTED_MD.indexOf(heading);
      expect(at, `missing ${heading}`).toBeGreaterThan(previous);
      previous = at;
    }
    expect(GETTING_STARTED_MD).toContain("renderToSVGString");
    expect(GETTING_STARTED_MD).toContain("ggts render");

    // Progressive walkthrough step titles stay out of the published guide.
    for (const step of SAKURA_STEPS) {
      expect(GETTING_STARTED_MD).not.toContain(step.title);
    }
  });

  it("documents zero-config years, strict temporal overrides, and inspection", () => {
    expect(TEMPORAL_SCALES_MD).toContain('year: "1835"');
    expect(TEMPORAL_SCALES_MD).toContain("without preprocessing");
    expect(TEMPORAL_SCALES_MD).toContain("scaleDecisions");
    expect(TEMPORAL_SCALES_MD).toContain('.scaleXDate({ parse: "dmy" })');
    expect(TEMPORAL_SCALES_MD).toContain("scale_x_discrete()");
  });

  it("documents multi-part SF labels: MultiPoint per point, LineString vertex mean", () => {
    // #809 phase 5: MultiPoint emits one label per finite point (not a single mean).
    // LineString still uses the vertex mean. The guide must not contradict itself.
    expect(STATISTICS_POSITIONS_MD).toContain("### SF text labels");
    expect(STATISTICS_POSITIONS_MD).toContain("one label per part");
    expect(STATISTICS_POSITIONS_MD).toContain("LineString uses the vertex mean");
    expect(STATISTICS_POSITIONS_MD).not.toContain("MultiPoint/LineString use the vertex mean");
  });

  it("documents the machine-checked packed-consumer support contract", () => {
    type SupportMatrix = {
      node: { range: string };
      svelte: { range: string; current: string };
      packageManagers: { npm: string; pnpm: string; bun: string };
      browsers: { playwright: string };
    };
    const supportMatrix = JSON.parse(
      readFileSync(join(import.meta.dir, "..", "..", "support-matrix.json"), "utf8"),
    ) as SupportMatrix;
    expect(PRODUCTION_MD).toContain(`Node.js \`${supportMatrix.node.range}\``);
    expect(PRODUCTION_MD).toContain(`Svelte \`${supportMatrix.svelte.range}\``);
    expect(PRODUCTION_MD).toContain(`current ${supportMatrix.svelte.current}`);
    expect(PRODUCTION_MD).toContain(`npm ${supportMatrix.packageManagers.npm}`);
    expect(PRODUCTION_MD).toContain(`pnpm ${supportMatrix.packageManagers.pnpm}`);
    expect(PRODUCTION_MD).toContain(`Bun ${supportMatrix.packageManagers.bun}`);
    expect(PRODUCTION_MD).toContain(`Playwright ${supportMatrix.browsers.playwright}`);
    expect(PRODUCTION_MD).toContain("support-matrix.json");
  });

  it("documents the complete interaction capability and event contracts", () => {
    expect(INTERACTIONS_MD).toContain("private to one chart");
    expect(INTERACTIONS_MD).toContain("createPlotInteraction");
    expect(INTERACTIONS_MD).toContain("stable semantic scope");
    expect(INTERACTIONS_MD).toContain("required, stable semantic scope");
    expect(INTERACTIONS_MD).toContain("Controlled plots never infer channel names");
    expect(INTERACTIONS_MD).toContain("reconcileKeys");
    expect(INTERACTIONS_MD).toContain("without retraining scales");
    expect(INTERACTIONS_MD).toContain("/examples/interactions/inspection");
    expect(INTERACTIONS_MD).toContain("/examples/interaction/linked-views");
    expect(INTERACTIONS_MD).not.toContain("/playground");
    expect(INTERACTIONS_MD).toContain('<Inspect mode="x" pin maxDistance={24} />');
    expect(INTERACTIONS_MD).toContain('select={{ type: "interval", mode: "xy",');
    expect(INTERACTIONS_MD).toContain('identity: "id"');
    expect(INTERACTIONS_MD).toContain("oninspect");
    expect(INTERACTIONS_MD).toContain("onselect");
    expect(INTERACTIONS_MD).toContain("oninteraction");
    expect(INTERACTIONS_MD).toContain('phase: "clear"');
    expect(INTERACTIONS_MD).toContain('type: "zoom"');
    expect(INTERACTIONS_MD).toContain("INTERACTION_INTERVAL_FACET_UNSUPPORTED");
  });

  it("publishes a dedicated interaction capability and event reference", () => {
    for (const term of [
      "inspect",
      "point selection",
      "interval selection",
      "zoom",
      "legendfocus",
      "tool",
      "oninspect",
      "onselect",
      "onzoom",
      "onlegendfocus",
      "oninteraction",
      "ondiagnostic",
    ]) {
      expect(INTERACTION_REFERENCE_MD.toLowerCase()).toContain(term);
    }
    expect(INTERACTION_REFERENCE_MD).toContain("INTERACTION_TOOL_UNAVAILABLE");
    expect(INTERACTION_REFERENCE_MD).toContain("chart-local");
    expect(INTERACTION_REFERENCE_MD).toContain("PlotInteractionController");
    expect(INTERACTION_REFERENCE_MD).toContain("required");
    expect(INTERACTION_REFERENCE_MD).toContain("feedback");
    expect(INTERACTION_REFERENCE_MD).toContain("Do not mutate the controller inside");
    const html = renderMarkdown(INTERACTION_REFERENCE_MD);
    for (const diagnostic of Object.values(INTERACTION_DIAGNOSTIC_CATALOG)) {
      const fragment = diagnostic.docUrl.split("#")[1];
      expect(diagnostic.docUrl).toContain("/guide/interaction-reference#");
      expect(html).toContain(`id="${fragment}"`);
    }
  });

  it("exposes an exact searchable interaction index", () => {
    expect(INTERACTION_REFERENCE_INDEX.map((entry) => entry.id)).toEqual([
      "static-default",
      "inspect",
      "point-selection",
      "interval-selection",
      "zoom",
      "legend-focus",
      "legend-filter",
      "controlled-tool",
      "shared-controller",
      "identity",
      "events",
      "diagnostics",
      "accessibility",
    ]);
    for (const entry of INTERACTION_REFERENCE_INDEX) {
      expect(entry.summary.length).toBeGreaterThan(20);
      expect(entry.href).toStartWith("/guide/interaction-reference#");
    }
  });

  it("provides a rolling upgrading guide with a stable per-transition anchor", () => {
    // One section per release transition; changesets link these anchors, so
    // heading ids must come from the same renderer the docs site uses.
    expect(UPGRADING_MD).toContain("## 0.1 to 0.2");
    expect(renderMarkdown(UPGRADING_MD)).toContain('id="0-1-to-0-2"');
  });

  it("keeps mapped style migration guidance on the release that owns it", () => {
    const styleMigration = UPGRADING_MD.indexOf(
      "### Map style semantics instead of precomputing outputs",
    );
    expect(UPGRADING_MD).toContain("## 0.7 to 0.8");
    expect(renderMarkdown(UPGRADING_MD)).toContain('id="0-7-to-0-8"');
    expect(styleMigration).toBeGreaterThan(UPGRADING_MD.indexOf("## 0.7 to 0.8"));
    expect(styleMigration).toBeLessThan(UPGRADING_MD.indexOf("## 0.6 to 0.7"));
    expect(UPGRADING_MD).toContain("Before 0.8, applications commonly precomputed a point radius");
  });

  it("keeps generic color/fill migration guidance on the release that owns it", () => {
    const colorMigration = UPGRADING_MD.indexOf("### Choose explicit color/fill families");
    expect(UPGRADING_MD).toContain("## 0.6 to 0.7");
    expect(renderMarkdown(UPGRADING_MD)).toContain('id="0-6-to-0-7"');
    expect(colorMigration).toBeGreaterThan(UPGRADING_MD.indexOf("## 0.6 to 0.7"));
    expect(colorMigration).toBeLessThan(UPGRADING_MD.indexOf("## 0.5 to 0.6"));
    expect(UPGRADING_MD).toContain("Before 0.7, an explicit continuous color domain");
  });

  it("keeps palette-purge migration guidance on the release that owns it", () => {
    // 0.29 dropped Tableau 10 / season / stone; 0.28 dropped spreadsheet +
    // Accent/Paired/gdocs multi-hue. H3 anchors stay stable for changesets;
    // version ownership must not slide the wrong transition.
    const tableauPurge = UPGRADING_MD.indexOf(
      "### Removed Tableau 10, Summer, Winter, and stone schemes",
    );
    const accentPurge = UPGRADING_MD.indexOf(
      "### Removed Accent, Paired, Grey, Google Docs, and Tableau multi-hue schemes",
    );
    const spreadsheetPurge = UPGRADING_MD.indexOf(
      "### Removed spreadsheet, Highcharts, and extra Stata schemes and themes",
    );
    expect(UPGRADING_MD).toContain("## 0.28 to 0.29");
    expect(UPGRADING_MD).toContain("## 0.27 to 0.28");
    expect(renderMarkdown(UPGRADING_MD)).toContain('id="0-28-to-0-29"');
    expect(renderMarkdown(UPGRADING_MD)).toContain('id="0-27-to-0-28"');
    expect(tableauPurge).toBeGreaterThan(UPGRADING_MD.indexOf("## 0.28 to 0.29"));
    expect(tableauPurge).toBeLessThan(UPGRADING_MD.indexOf("## 0.27 to 0.28"));
    expect(spreadsheetPurge).toBeGreaterThan(UPGRADING_MD.indexOf("## 0.27 to 0.28"));
    expect(accentPurge).toBeGreaterThan(spreadsheetPurge);
    expect(accentPurge).toBeLessThan(UPGRADING_MD.indexOf("## 0.26 to 0.27"));
  });

  it("states the 0.1→0.2 upgrade contract: additive, controller optional", () => {
    expect(UPGRADING_MD).toContain("No source changes are required");
    // Controller adoption is optional — both APIs remain supported.
    expect(UPGRADING_MD).toContain("createPlotInteraction");
    expect(UPGRADING_MD).toContain("optional");
    // Deprecated aliases predate 0.2; guidance stays on this page.
    expect(UPGRADING_MD).toContain("`BrushSelection` → `IntervalSelection`");
    expect(UPGRADING_MD).toContain("`TooltipContext` → `PlotInspectionChange`");
    expect(UPGRADING_MD).toContain("`ZoomDomains` → `ReadonlyZoomDomains`");
    expect(UPGRADING_MD).toContain("deprecated since 0.1.0");
    expect(UPGRADING_MD).toContain("# Upgrade guide");
    expect(UPGRADING_MD).not.toContain("migrating-pre-0-1");
  });
});
