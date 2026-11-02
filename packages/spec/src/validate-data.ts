/**
 * Tier-2 validation public contract and re-exports.
 *
 * Plan: "Tier-2 accepts inline data OR a defined DataProfile". Runs when
 * validate() receives an options argument.
 *
 * Implementation is split:
 *  - validate-data-evidence.ts — FieldEvidenceMap construction + effectiveChannel
 *  - validate-data-checks.ts — dataChecks orchestrator (evidence → walk → checkers)
 *  - validate-data-checks-layer.ts — geom/stat rules + field walk + channel collection
 *  - validate-data-checks-temporal.ts — shared temporalDecisionForField memoization
 *  - validate-data-checks-position.ts — pre-evidence temporal config + x/y scale types
 *  - validate-data-checks-color.ts — color/fill scale types + manual domain/range
 *  - validate-data-checks-color-temporal.ts — temporal censor recovery lattice
 *  - validate-data-checks-style.ts — shape/linetype + size/linewidth/alpha (finite + numeric modules)
 *
 * Style and color scale checks use per-layer evidenceForUse like position
 * (#609 / #844) so multi-table same-name fields keep independent type views.
 *
 * Checks:
 *  - field existence: every { field } channel must name an available field
 *    (with a did-you-mean suggestion against the available names);
 *  - all-null columns (inline data only) are tier-2 errors;
 *  - { stat } channels must name a column the layer's stat generates
 *    (identity generates none; count generates "count");
 *  - scale/type compatibility: scales.*.type "time" needs temporal fields,
 *    "log"/"linear" refuse nominal/ordinal fields, color/fill "sequential"
 *    needs quantitative fields.
 *
 * Input limits (DEFAULT_VALIDATE_LIMITS — documented, overridable): agent-
 * facing validation must not be resource-abusable. Over-limit inputs get a
 * `validation-limit` diagnostic and the data-aware checks are skipped;
 * diagnostics themselves are capped by maxDiagnostics (enforced in validate()).
 */
import type { JSONValue } from "./portability.js";

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

/** Field type vocabulary shared with agents (Vega-Lite-compatible names). */
export type ProfileFieldType = "quantitative" | "temporal" | "ordinal" | "nominal";

export interface DataProfileField {
  name: string;
  type: ProfileFieldType;
  /** Optional example values (used in error messages, never validated). */
  examples?: JSONValue[];
}

/** A description of out-of-band data, for validating specs without the data. */
export interface DataProfile {
  fields: DataProfileField[];
  rowCount?: number;
}

/** Documented input limits for validate(). */
export interface ValidateLimits {
  /** Max inline-data rows examined (default 100_000). */
  maxRows: number;
  /** Max estimated inline-data bytes examined (default 20 MB). */
  maxBytes: number;
  /** Max JSON nesting depth of the spec (default 32). */
  maxDepth: number;
  /** Max diagnostics returned per run (default 100). */
  maxDiagnostics: number;
}

export const DEFAULT_VALIDATE_LIMITS: ValidateLimits = {
  maxRows: 100_000,
  maxBytes: 20 * 1024 * 1024,
  maxDepth: 32,
  maxDiagnostics: 100,
};

export interface ValidateOptions {
  /** Describe out-of-band data instead of inlining it. Wins over inline data. */
  profile?: DataProfile;
  /** Override the documented input limits. */
  limits?: Partial<ValidateLimits>;
  /** Also run lintSpec() and attach its advisories to the result (lint.ts). */
  lint?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers owned by the public contract surface
// ---------------------------------------------------------------------------

/** Depth of a JSON-ish value, short-circuiting at `cap + 1`. */
export function jsonDepth(value: unknown, cap: number): number {
  if (typeof value !== "object" || value === null) return 0;
  let max = 0;
  const entries = Array.isArray(value) ? value : Object.values(value);
  for (const child of entries) {
    const d = jsonDepth(child, cap - 1);
    if (d >= cap) return d + 1; // short-circuit: already too deep
    if (d > max) max = d;
  }
  return max + 1;
}

// ---------------------------------------------------------------------------
// Focused modules (re-exported so internal imports stay on this barrel)
// ---------------------------------------------------------------------------

export {
  effectiveChannel,
  resolveLayerFieldEvidence,
  type FieldEvidenceEntry,
  type FieldEvidenceMap,
} from "./validate-data-evidence.js";

export { dataChecks, STAT_COLUMNS } from "./validate-data-checks.js";
