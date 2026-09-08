/**
 * Normalize + TypeBox-free structural gate for a pipeline spec entry.
 *
 * Full TypeBox schema validation stays on the agent path (`validate()`,
 * builder `.spec()`). Render uses normalize + structuralGate + pipeline
 * preflights so browser chart chunks do not load schema-declarations /
 * typebox/compile.
 */
import type { NormalizedSpec, PortableSpec, SpecError, SpecInput } from "@ggts-sh/spec";
import {
  assertStructuralGate,
  normalize,
  SpecValidationError,
  temporalGuideTypeMismatchError,
  temporalLabelConfigurationError,
  temporalLocaleConfigurationError,
} from "@ggts-sh/spec";

import { PipelineError } from "./types.js";

function preflightStyleScales(spec: PortableSpec): void {
  for (const aesthetic of ["shape", "linetype"] as const) {
    const type = (spec.scales?.[aesthetic] as { type?: string } | undefined)?.type;
    if (type !== "sequential") continue;
    const path = `/scales/${aesthetic}/type`;
    throw new PipelineError(
      "unsupported-aesthetic-scale",
      path,
      `Continuous ${aesthetic} interpolation is not meaningful; use type: "binned" for quantitative values.`,
      {
        code: "unsupported-aesthetic-scale",
        severity: "error",
        path,
        problem: `${aesthetic} has a finite set of distinguishable outputs and cannot be continuous.`,
        cause: `type: "sequential" would imply interpolation between named ${aesthetic} values.`,
        fixes: [
          { description: `Use scales.${aesthetic}.type = "binned".` },
          { description: `Map a categorical field and use type: "ordinal".` },
        ],
        documentationUrl: "/guide/aesthetic-scales#finite-styles",
      },
    );
  }
}

function preflightTemporalLabels(spec: PortableSpec): void {
  for (const axis of ["x", "y"] as const) {
    const dateLabels = spec.scales?.[axis]?.dateLabels;
    if (typeof dateLabels !== "string") continue;
    const error = temporalLabelConfigurationError(dateLabels, spec.scales?.[axis]?.temporalKind);
    if (error === null) continue;
    const path = `/scales/${axis}/dateLabels`;
    throw new PipelineError("invalid-temporal-labels", path, error, {
      code: "invalid-temporal-labels",
      severity: "error",
      path,
      problem: "The temporal label format is not in the closed portable grammar.",
      cause: error,
      fixes: [{ description: "Use only the documented dateLabels tokens." }],
      documentationUrl: "/guide/temporal-scales#formatting",
    });
  }
}

export function normalizeAndValidateSpec(spec: SpecInput | PortableSpec): NormalizedSpec {
  const authoredScales = spec.scales as Record<string, unknown> | undefined;
  const normalized = normalize(spec);
  // Preserve the stable pipeline diagnostic before the portable schema rejects
  // the same closed-token violation as a generic shape error.
  preflightTemporalLabels(normalized);
  preflightStyleScales(normalized);
  // Color scheme / binned-style / guide / coord-facet gates without TypeBox.
  assertStructuralGate(normalized);

  const temporalScaleErrors: SpecError[] = [];
  const seen = new Set<string>();
  const collect = (scales: Record<string, unknown> | undefined) => {
    for (const axis of ["x", "y"] as const) {
      const mismatch = temporalGuideTypeMismatchError(scales, axis);
      if (mismatch === null || seen.has(mismatch.path)) continue;
      seen.add(mismatch.path);
      temporalScaleErrors.push(mismatch);
    }
  };
  // After normalize first so log→linear reports the canonical type. Then the
  // authored spec, because normalize strips temporal options from band scales.
  collect(normalized.scales);
  collect(authoredScales);
  if (temporalScaleErrors.length > 0) throw new SpecValidationError(temporalScaleErrors);

  for (const axis of ["x", "y"] as const) {
    const config = normalized.scales?.[axis];
    if (config?.locale !== undefined) {
      const error = temporalLocaleConfigurationError(config.locale);
      if (error !== null) {
        const path = `/scales/${axis}/locale`;
        throw new PipelineError("invalid-temporal-locale", path, error, {
          code: "invalid-temporal-locale",
          severity: "error",
          path,
          problem: "The temporal label locale is not a supported BCP 47 locale.",
          cause: error,
          fixes: [{ description: "Use a canonical locale such as en-US or fr-FR." }],
          documentationUrl: "/guide/temporal-scales#formatting",
        });
      }
    }
  }
  return normalized;
}
