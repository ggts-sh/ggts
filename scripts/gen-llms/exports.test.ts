/**
 * Public export surface of the gen-llms facade: the documented runtime export
 * set is split-safe — moving implementation below the facade must not change
 * what callers can import. The namespace is loaded with a dynamic import on
 * purpose: only a namespace object enumerates the real runtime export set;
 * a static named import would hide accidental export drift.
 */
import { describe, expect, it } from "bun:test";

describe("public export surface (split-safe)", () => {
  it("exposes exactly the documented runtime export set from gen-llms", async () => {
    const mod = await import("../gen-llms.ts");
    const expected = [
      "AGENTS_MD",
      "FACETS_COORDINATES_MD",
      "GETTING_STARTED_MD",
      "INTERACTIONS_MD",
      "INTERACTION_REFERENCE_INDEX",
      "INTERACTION_REFERENCE_MD",
      "PRODUCTION_MD",
      "SCALES_GUIDES_MD",
      "STATISTICS_POSITIONS_MD",
      "TEMPORAL_SCALES_MD",
      "UPGRADING_MD",
      "buildAdvisoriesMd",
      "buildDiagnosticDocs",
      "buildErrorsMd",
      "buildLifecycleMd",
      "buildLlmsFull",
      "buildLlmsIndex",
      "docsDiscoveryFacts",
      "extractMarkdownHeadings",
      "guidePages",
      "markdownOutsideFences",
      "pruneSpecData",
      "renderMarkdown",
    ].toSorted();
    expect(Object.keys(mod).toSorted()).toEqual(expected);
  });
});
