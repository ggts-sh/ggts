/**
 * Structural scale-config preflight (PR 3).
 *
 * Runs on the normalized position-scale config BEFORE any data execution —
 * even for empty data — mirroring `assertTemporalConfiguration`. It owns the
 * plan's type/transform contradictions that `normalize()` deliberately leaves
 * uncanonicalized (pure normalize never throws):
 *
 *  - `scale-type-transform-conflict` — a `type: "log"` that survived
 *    normalization (its transform was identity/sqrt, not log10), or a temporal
 *    scale asking for a non-identity transform. Path `/scales/<axis>/transform`.
 *  - `scale-zero-invalid-for-transform` — explicit `zero: true` under a
 *    transform with no valid zero image (log10). Path `/scales/<axis>`.
 *
 * Data-dependent transform/OOB events belong to the pipeline warning path, not
 * here; this stage only rejects impossible configurations.
 */
import type { PositionScaleSpec } from "@ggts-sh/spec";

import { getScaleTransform } from "../scales/transform.js";

import { PipelineError } from "./types.js";

function docs(code: string): string {
  return `https://ggts.sh/guide/errors#${code}`;
}

export function assertScaleConfiguration(
  axis: "x" | "y",
  config: PositionScaleSpec | undefined,
): void {
  if (config === undefined) return;

  // --- scale-type-transform-conflict ---------------------------------------
  // A canonical bare `type: "log"` is rewritten to `{ type: "linear",
  // transform: "log10" }` by normalize(); a surviving `type: "log"` therefore
  // carries a conflicting identity/sqrt transform. A temporal family permits
  // only the identity transform (calendar transforms are never guessed).
  const temporalNonIdentity =
    config.type === "time" && config.transform !== undefined && config.transform !== "identity";
  if (config.type === "log" || temporalNonIdentity) {
    const requested = config.transform ?? "log10";
    const family = config.type === "time" ? "time" : "log";
    const message =
      `The ${axis} scale declares type: "${config.type}" with transform: "${requested}", which cannot be reconciled — ` +
      (config.type === "time"
        ? "temporal scales permit only the identity transform."
        : 'a base-10 log scale IS the linear family with transform: "log10".');
    throw new PipelineError("scale-type-transform-conflict", `/scales/${axis}/transform`, message, {
      code: "scale-type-transform-conflict",
      severity: "error",
      path: `/scales/${axis}/transform`,
      problem: `Incompatible scale type and transform on the ${axis} scale.`,
      cause: message,
      fixes: [
        config.type === "time"
          ? { description: `Remove the transform, or use type: "time" with transform: "identity".` }
          : {
              description: `Use type: "linear" with transform: "${requested}", or drop the transform for a base-10 log scale.`,
              portable: { type: "linear", transform: requested },
            },
      ],
      evidence: { candidates: [family, requested] },
      documentationUrl: docs("scale-type-transform-conflict"),
    });
  }

  // --- scale-zero-invalid-for-transform ------------------------------------
  // Only explicit `zero: true` is an error; automatic bar/density zero-forcing
  // is skipped for log10 elsewhere. sqrt/identity have a valid zero image.
  if (config.zero === true) {
    const transform = getScaleTransform(config.transform ?? "identity");
    if (!transform.valid(0)) {
      const message =
        `The ${axis} scale sets zero: true, but the ${transform.key} transform has no valid image for semantic zero ` +
        `(${transform.key}(0) is undefined), so a zero baseline cannot be forced.`;
      throw new PipelineError("scale-zero-invalid-for-transform", `/scales/${axis}`, message, {
        code: "scale-zero-invalid-for-transform",
        severity: "error",
        path: `/scales/${axis}`,
        problem: `zero: true is invalid under the ${transform.key} transform on the ${axis} scale.`,
        cause: message,
        fixes: [
          { description: "Remove zero: true (log10 positions use the transformed-space origin)." },
        ],
        documentationUrl: docs("scale-zero-invalid-for-transform"),
      });
    }
  }
}

/** Reject a transform that became contradictory only after value-driven
 * inference resolved an otherwise unspecified axis to temporal. */
export function assertInferredTemporalTransform(
  axis: "x" | "y",
  config: PositionScaleSpec | undefined,
  inferredTemporal: boolean,
): void {
  if (!inferredTemporal || config?.transform === undefined || config.transform === "identity")
    return;
  const message =
    `The ${axis} field inferred a temporal scale, which permits only the identity transform, ` +
    `but transform: "${config.transform}" was requested.`;
  throw new PipelineError("scale-type-transform-conflict", `/scales/${axis}/transform`, message, {
    code: "scale-type-transform-conflict",
    severity: "error",
    path: `/scales/${axis}/transform`,
    problem: `Incompatible inferred temporal scale and transform on the ${axis} scale.`,
    cause: message,
    fixes: [
      { description: "Remove the transform to keep temporal inference." },
      {
        description:
          "Force a non-temporal numeric scale only when the source values are quantitative.",
        portable: { type: "linear", transform: config.transform },
      },
    ],
    documentationUrl: docs("scale-type-transform-conflict"),
  });
}
