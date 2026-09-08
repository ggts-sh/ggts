/**
 * The core diagnostics surface — render-time errors, warnings, and advisories
 * (M3 error-catalog audit). Error *prose* for pipeline codes lives in
 * @ggts-sh/spec (`PIPELINE_ERROR_CATALOG`, #987); this package re-exports it
 * and owns warnings, advisories, CLI diagnostics, and every emission site.
 * Catalog completeness is primary via typed emission registries
 * (`diagnostics-emission-registry.ts`, #628). Dual-channel rich diagnostics
 * project lean + rich from structured facts in `pipeline/diagnostics-emit.ts`
 * — never by parsing human-readable messages.
 *
 * Large tables:
 * - diagnostics-error-catalog.ts — re-exports PIPELINE_ERROR_CATALOG from spec
 * - diagnostics-warning-catalog.ts — PIPELINE_WARNING_CATALOG
 * - diagnostics-emission-registry.ts — checked catalog↔emission membership
 * This file keeps advisories, CLI diagnostics, and re-exports the public surface.
 *
 * Naming note: `palette-exhausted` appears as BOTH an error and a warning by
 * design (the palette-exhaustion contract): the default `onExhaust: "cycle"`
 * emits the warning; opt-in `onExhaust: "error"` throws the error.
 * `stat-channel-unsupported` is likewise dual-channel: style bindings throw
 * the error; color/fill bindings warn and ignore the mapping (#915 / #1043).
 * `max-marks-exceeded` exists as a PipelineError (renderToSVGString) and a CLI
 * diagnostic (the CLI's own --max-marks check).
 */

export {
  PIPELINE_ERROR_CATALOG,
  type PipelineErrorCatalogEntry,
  type PipelineErrorCode,
} from "./diagnostics-error-catalog.js";
export {
  PIPELINE_WARNING_CATALOG,
  type PipelineWarningCode,
} from "./diagnostics-warning-catalog.js";

import type { PipelineErrorCode } from "./diagnostics-error-catalog.js";
import type { PipelineWarningCode } from "./diagnostics-warning-catalog.js";

/**
 * Advisories (`RenderModel.advisories`, Hadley lesson 12): every heuristic
 * the pipeline takes, as `{ code, path, chosen, howToOverride }` — agents see
 * the guess and can correct it. Distinct from spec-lint advisories
 * (@ggts-sh/spec `lintSpec`), which flag questionable-but-valid SPECS before
 * any pipeline run.
 */
export const ADVISORY_CATALOG = {
  "scale-type-inferred": {
    summary: "A positional scale's type was inferred from the mapped data.",
  },
  "zero-forced": {
    summary: "Bars/areas forced the measure axis to include zero.",
  },
  "scale-baseline-transformed-origin": {
    summary:
      "A bar/col/area/histogram/density measure axis under transform: log10 baselines at the transformed-space origin (semantic 1), since log10 has no semantic-zero image.",
  },
  "bar-x-discretized": {
    summary: "A numeric x on a count-stat bar layer was treated as discrete categories.",
  },
  "bin-default-bins": {
    summary: "The bin stat used its default bin count; set params.binwidth to control it.",
  },
  "smooth-method-inferred": {
    summary: "The smooth stat chose its method (lm vs loess) from the group size.",
  },
  "jitter-seeded": {
    summary: "The jitter position used its default deterministic seed.",
  },
  "stack-align-applied": {
    summary:
      "A stacked area layer auto-aligned its groups onto the shared x grid; groups sampled different x, and a raw stack would render floating bands.",
  },
  "palette-inferred": {
    summary: "A color scale used the edition's default palette/ramp.",
  },
  "canvas-auto": {
    summary:
      "A high-count layer auto-switched to the canvas backend (a11y/copy-SVG tradeoff disclosed).",
  },
  "temporal-year-inferred": {
    summary:
      "A four-digit string field was inferred as calendar years; a discrete override is available.",
  },
  "temporal-inference-ambiguous": {
    summary: "A date-like field remained discrete because multiple date orders matched.",
  },
  "temporal-inference-invalid": {
    summary: "A date-like field remained discrete because whole-column validation failed.",
  },
  "band-labels-wrapped": {
    summary:
      "Long categorical x labels were wrapped onto multiple lines to avoid collisions; pin with scales.x.guide.mode or coordFlip().",
  },
  "band-labels-rotated": {
    summary:
      "Long categorical x labels were rotated to avoid collisions; pin with scales.x.guide.mode/angle, or coordFlip() for horizontal rows.",
  },
  "percent-labels-out-of-range": {
    summary:
      "A continuous scale uses a percent labels format (…%) but its domain is far outside proportion space — ticks/tooltips would print values like 87300%.",
  },
} as const satisfies Record<string, { summary: string }>;

export type AdvisoryCode = keyof typeof ADVISORY_CATALOG;

/** CLI-only diagnostics (`ggts render` stderr JSON lines, exit codes 1–3). */
export const CLI_DIAGNOSTIC_CATALOG = {
  usage: { summary: "Bad flags or arguments (exit 2). --help shows usage." },
  "unreadable-input": { summary: "The spec/data file (or stdin) could not be read (exit 2)." },
  "invalid-json": { summary: "The spec or data file is not valid JSON (exit 2)." },
  "invalid-data-file": {
    summary: "--data must be a JSON object mapping dataset names to inline data (exit 2).",
  },
  "max-marks-exceeded": {
    summary: "The plot renders more marks than --max-marks allows (exit 1).",
  },
  internal: { summary: "An unexpected internal error (exit 1). Please report it." },
} as const satisfies Record<string, { summary: string }>;

export type CLIDiagnosticCode = keyof typeof CLI_DIAGNOSTIC_CATALOG;

/**
 * Every catalogued diagnostic code (error, warning, advisory, CLI).
 * Used on rich `ScaleDiagnostic.code` where dual-channel and multi-channel
 * codes are legal (`palette-exhausted`, `max-marks-exceeded`, …).
 */
export type DiagnosticCode =
  | PipelineErrorCode
  | PipelineWarningCode
  | AdvisoryCode
  | CLIDiagnosticCode;
