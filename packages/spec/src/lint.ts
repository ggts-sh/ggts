/**
 * Spec lint — advisories for VALID-but-questionable specs (Hadley lesson 16:
 * "we can produce many plots that don't make sense, yet are grammatically
 * valid"). `lintSpec()` never errors and never blocks: it returns
 * `SpecAdvisory[]` — high value for agent-generated charts, where a
 * grammatically valid spec can still be a meaningless plot.
 *
 * Distinct from the two error tiers (validate()) and from the pipeline's
 * heuristic advisories (@ggts-sh/core `RenderModel.advisories`): lint runs
 * BEFORE any pipeline, on the spec alone (plus inline data or a DataProfile
 * when available — data-dependent rules skip silently without evidence).
 *
 * Rules considered and deliberately ABSENT (documented for auditability):
 *  - dual-axis misuse: the grammar has no dual axes — unrepresentable.
 *  - pie-chart overuse: polar/radial coords exist; a dedicated "prefer bar
 *    over pie" advisory is deferred until usage evidence exists.
 *  - text layer without a label aes: that is a validation ERROR
 *    (`missing-required-channel`), not an advisory.
 *  - transform scale over entirely out-of-domain data: the pipeline handles
 *    it via the `scale-transform-domain` error (explicit limits) / warning
 *    (data), plus the applicable censor count; the lint advisory here fires on
 *    MIXED data (some in-domain, some out), where the silent row-drop is most
 *    surprising.
 *
 * Implementation:
 *  - lint-catalog.ts — pure advisory catalog (re-exported here)
 *  - lint-layer-rules.ts — layer-scoped rules
 *  - lint-scale-rules.ts — scale-level transform-domain-data and
 *    fractional-calendar-years (year+month/12 linear pitfall)
 *
 * Wired into `validate(spec, { lint: true })` (advisories ride the result)
 * and into the `ggts render` CLI (stderr JSON lines, kind "advisory",
 * source "spec-lint").
 */
import type { JSONValue } from "./portability.js";
import type { Aes, ChannelName } from "./schema.js";
import type { FieldEvidenceEntry, FieldEvidenceMap, ValidateOptions } from "./validate-data.js";
import {
  DEFAULT_VALIDATE_LIMITS,
  effectiveChannel,
  resolveFieldEvidence,
} from "./validate-data.js";

import type { LintAdvisoryCode } from "./lint-catalog.js";
import { collectLayerLintAdvisories } from "./lint-layer-rules.js";
import { collectScaleLintAdvisories } from "./lint-scale-rules.js";

export { LINT_CATALOG, type LintAdvisoryCode, type LintCatalogEntry } from "./lint-catalog.js";

/** One lint advisory: never an error, always actionable. */
export interface SpecAdvisory {
  code: LintAdvisoryCode;
  /** JSON pointer into the spec ("" = root). */
  path: string;
  message: string;
  suggestion?: {
    description: string;
    example?: JSONValue;
  };
}

// ---------------------------------------------------------------------------
// Field-type evidence (inline data or DataProfile; absent = rules skip)
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Standalone evidence build (lintSpec without a shared map from validate).
 * Merges options.limits into DEFAULT_VALIDATE_LIMITS the same way validate()
 * does, so callers can raise or lower maxRows/maxBytes and data-aware rules
 * honor the override (skip over-limit; never fabricate a complaint).
 */
function buildEvidence(
  spec: Record<string, unknown>,
  options: ValidateOptions | undefined,
): FieldEvidenceMap | null {
  const limits = { ...DEFAULT_VALIDATE_LIMITS, ...options?.limits };
  const resolved = resolveFieldEvidence(spec, options ?? {}, limits);
  return resolved.status === "ok" ? resolved.fields : null;
}

// ---------------------------------------------------------------------------
// lintSpec
// ---------------------------------------------------------------------------

/**
 * Lint a spec for valid-but-questionable constructs. `options` mirrors
 * validate(): pass `{ profile }` to lint against out-of-band data, or let the
 * spec's inline data provide the evidence; `options.limits` merges over
 * DEFAULT_VALIDATE_LIMITS the same way validate() does. Rules whose evidence
 * is missing (including over-limit inline data) skip silently — lint never
 * fabricates a complaint.
 *
 * When called from validate({ lint: true }), pass `sharedEvidence` so field
 * types/columns are not rebuilt after dataChecks already resolved them.
 */
export function lintSpec(
  spec: unknown,
  options?: ValidateOptions,
  sharedEvidence?: FieldEvidenceMap | null,
): SpecAdvisory[] {
  if (!isRecord(spec) || !Array.isArray(spec["layers"])) return [];
  const evidence = sharedEvidence === undefined ? buildEvidence(spec, options) : sharedEvidence;
  const plotAes = isRecord(spec["aes"]) ? (spec["aes"] as Aes) : undefined;
  const layers = spec["layers"] as unknown[];
  const scales = isRecord(spec["scales"]) ? spec["scales"] : undefined;

  const fieldOf = (
    layerAes: Aes | undefined,
    channel: ChannelName,
  ): { field: string; info: FieldEvidenceEntry } | null => {
    const mapped = effectiveChannel(plotAes, layerAes, channel);
    if (mapped === undefined || !("field" in mapped)) return null;
    const info = evidence?.get(mapped.field);
    if (info === undefined) return null;
    return { field: mapped.field, info };
  };

  return [
    ...collectLayerLintAdvisories({ layers, fieldOf }),
    ...collectScaleLintAdvisories({ layers, scales, fieldOf }),
  ];
}
