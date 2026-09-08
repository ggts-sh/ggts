/**
 * Canonical diagnostics emission (#628).
 *
 * Emitters pass structured facts once; lean warning/advisory text and rich
 * `scaleDiagnostics` are projected from those facts. Evidence is never recovered
 * by parsing human-readable messages. Dedup identity and evidence bounds live
 * here so every dual-channel path shares one contract.
 */
import type { Advisory, PipelineWarning } from "./types-advisory.js";
import type { ScaleDiagnostic } from "./types-scale-diagnostics.js";

const DOCS = "https://ggts.sh/guide/errors";

/** Max sample values attached to rich diagnostic evidence. */
export const DIAGNOSTIC_EVIDENCE_VALUE_LIMIT = 5;

/** Bound evidence samples to the central limit (full count stays on failedCount). */
export function boundEvidenceValues<T>(
  values: readonly T[],
  limit: number = DIAGNOSTIC_EVIDENCE_VALUE_LIMIT,
): T[] {
  return values.length <= limit ? [...values] : values.slice(0, limit);
}

/** Stable identity for scaleDiagnostics dedupe: code + path. */
export function scaleDiagnosticIdentity(diagnostic: ScaleDiagnostic): string {
  return `${diagnostic.code}\0${diagnostic.path}`;
}

export function dedupeScaleDiagnostics(list: readonly ScaleDiagnostic[]): ScaleDiagnostic[] {
  const seen = new Set<string>();
  return list.filter((diagnostic) => {
    const key = scaleDiagnosticIdentity(diagnostic);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface DualChannelWarning {
  warning: PipelineWarning;
  diagnostic: ScaleDiagnostic;
}

export interface DualChannelAdvisory {
  advisory: Advisory;
  diagnostic: ScaleDiagnostic;
}

/**
 * Explicit continuous breaks outside the trained display domain.
 * Facts: axis, outside values, trained domain bounds.
 */
export function emitScaleBreakOutsideDomain(
  axis: "x" | "y",
  outside: readonly number[],
  lo: number,
  hi: number,
): DualChannelWarning {
  const samples = boundEvidenceValues(outside);
  const warning: PipelineWarning = {
    code: "scale-break-outside-domain",
    message: `Omitted ${outside.length} explicit ${axis} break(s) outside the trained domain [${lo}, ${hi}]: ${outside.join(", ")}.`,
  };
  const diagnostic: ScaleDiagnostic = {
    code: "scale-break-outside-domain",
    severity: "warning",
    path: `/scales/${axis}/breaks`,
    problem: `One or more explicit ${axis} breaks are outside the trained display domain and were omitted.`,
    cause:
      "Breaks beyond the expanded display domain cannot be projected onto the axis and are dropped by the tick filter.",
    fixes: [
      {
        description: "Remove the out-of-domain breaks or widen the explicit domain.",
      },
    ],
    evidence: {
      failedCount: outside.length,
      values: samples,
    },
    documentationUrl: `${DOCS}#scale-break-outside-domain`,
  };
  return { warning, diagnostic };
}

/**
 * log10 bar/area/density baseline at the transformed-space origin.
 * Fact: axis only.
 */
export function emitScaleBaselineTransformedOrigin(axis: "x" | "y"): DualChannelAdvisory {
  const advisory: Advisory = {
    code: "scale-baseline-transformed-origin",
    path: `scales.${axis}`,
    chosen: "bars/areas/density baseline at the transformed-space origin 0 (semantic 1)",
    howToOverride: "log10 has no semantic-zero image; this baseline is not configurable.",
  };
  const diagnostic: ScaleDiagnostic = {
    code: "scale-baseline-transformed-origin",
    severity: "advisory",
    path: `/scales/${axis}`,
    problem: `Zero-baseline geoms on the ${axis} scale measure from the transformed-space origin 0 (semantic 1), not from zero.`,
    cause:
      "log10 has no image for semantic zero, so bar/col/area/histogram/density baselines and stack/dodge offsets are anchored at the transformed origin instead.",
    fixes: [
      {
        description:
          "This baseline is not configurable for log10; use an identity or sqrt transform if a semantic-zero baseline is required.",
      },
    ],
    documentationUrl: `${DOCS}#scale-baseline-transformed-origin`,
  };
  return { advisory, diagnostic };
}
