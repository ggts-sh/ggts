/**
 * #987 — one prose source for every dual-channel diagnostic code.
 * Validation (ERROR_CATALOG) and pipeline (PIPELINE_ERROR_CATALOG) may both
 * emit the same code, but summary/fix must not drift. Lives under scripts/
 * so both package catalogs are visible without inverting the layering.
 */
import { describe, expect, it } from "bun:test";

import { PIPELINE_ERROR_CATALOG } from "@ggts-sh/core";
import { ERROR_CATALOG } from "@ggts-sh/spec";

const validationCodes = new Set(Object.keys(ERROR_CATALOG));
const pipelineCodes = new Set(Object.keys(PIPELINE_ERROR_CATALOG));
const dualCodes = [...validationCodes].filter((code) => pipelineCodes.has(code)).toSorted();

describe("dual-channel error catalog prose (#987)", () => {
  it("lists the dual codes that share a prose source", () => {
    // Permanent membership check: add codes here only when both catalogs emit them.
    expect(dualCodes).toEqual([
      "all-null-column",
      "bin-center-and-boundary",
      "channel-type-mismatch",
      "color-manual-domain-range",
      "computed-y-mapped",
      "coord-fixed-free-scales",
      "facet-form-ambiguous",
      "facet-form-missing",
      "guide-aesthetic-incompatible",
      "manual-fun-required",
      "ribbon-orientation-ambiguous",
      "rule-both-axes",
      "rule-form-ambiguous",
      "rule-form-missing",
      "scale-type-transform-conflict",
      "unknown-field",
      "unknown-stat-column",
      "unsupported-geom-aesthetic",
    ]);
  });

  it("keeps identical summary and fix for every dual code", () => {
    const drift: string[] = [];
    for (const code of dualCodes) {
      const validation = ERROR_CATALOG[code as keyof typeof ERROR_CATALOG];
      const pipeline = PIPELINE_ERROR_CATALOG[code as keyof typeof PIPELINE_ERROR_CATALOG];
      if (validation.summary !== pipeline.summary || validation.fix !== pipeline.fix) {
        drift.push(code);
      }
    }
    expect(drift).toEqual([]);
  });

  it("uses color-manual-domain-range for manual color domain/range faults", () => {
    expect(validationCodes.has("scale-manual-domain-range")).toBe(false);
    expect(pipelineCodes.has("scale-manual-domain-range")).toBe(false);
    expect(validationCodes.has("color-manual-domain-range")).toBe(true);
    expect(pipelineCodes.has("color-manual-domain-range")).toBe(true);
  });
});
