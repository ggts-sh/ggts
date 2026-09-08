/**
 * Spec validation orchestrator — tier 1 (schema shape) plus opt-in tier 2
 * (structural grammar, data-aware checks, optional lint).
 *
 * Tier-1 mechanism (decision 0004): TypeBox 1.x compiled checks plus
 * `Value.Errors` over the same schemas that emit `schema/v0.json` — one
 * artifact, no drift.
 * Layer/plot shape walks: validate-schema-shape.ts (shared GEOM_BRANCHES;
 * also hands per-layer branch-ok indices to the tier-2 structural gate).
 * Raw TypeBox union noise is mapped to the agent error contract in
 * validate-map-errors.ts (schema walk: validate-schema-walk.ts; channel/data
 * form classification: validate-map-forms.ts).
 * Data-free grammar rules live in validate-structure*.ts (layers / color
 * schemes / facet form). Data-aware checks live in validate-data*.ts
 * (evidence + checks modules, barrel at validate-data.ts).
 *
 * Output: `{ ok: true, spec }` or `{ ok: false, errors: SpecError[] }` with
 * the agent error contract from errors.ts. Messages are snapshot-tested.
 */
import { Settings } from "typebox/system";

import type { SpecError } from "./errors.js";
// Precompiled at build time (scripts/gen-plot-validator.ts) — compiling the
// full plot union at runtime costs seconds; the generated module is pinned
// against a runtime-compiled validator by plot-spec-validator-generated.test.
import { Check as plotSpecSchemaCheck } from "./generated/plot-spec-validator.js";
import type { SpecAdvisory } from "./lint.js";
import { lintSpec } from "./lint.js";
import type { Aes, PortableSpec } from "./schema.js";
import { ensureTemporalPolyfill } from "./temporal-polyfill.js";
import type { ValidateOptions } from "./validate-data.js";
import {
  dataChecks,
  DEFAULT_VALIDATE_LIMITS,
  jsonDepth,
  resolveLayerFieldEvidence,
} from "./validate-data.js";
import { collectSchemaShapeErrors, GEOM_BRANCHES } from "./validate-schema-shape.js";
import { structuralGateErrors } from "./structural-gate.js";
import { facetStructuralErrors, layerStructuralErrors } from "./validate-structure.js";

export type ValidateResult =
  | { ok: true; spec: PortableSpec; advisories?: SpecAdvisory[] }
  | { ok: false; errors: SpecError[]; advisories?: SpecAdvisory[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate a spec. Tier 1 (always): schema shape, no data needed. Tier 2
 * (opt-in — pass an `options` argument, even `{}`): the grammar's structural
 * rules (required channels per geom, bar/count y ban, rule forms) plus
 * data-aware checks against the spec's inline data or the provided
 * DataProfile, under documented input limits (DEFAULT_VALIDATE_LIMITS).
 *
 * On success, returns the input typed as PortableSpec (no copy is made).
 */
export function validate(input: unknown, options?: ValidateOptions): ValidateResult {
  // Agent validate path may inspect temporal columns / IANA zones — load the
  // polyfill here so lean `@ggts-sh/core/render` graphs never need it.
  ensureTemporalPolyfill();
  const limits = { ...DEFAULT_VALIDATE_LIMITS, ...options?.limits };

  // Depth guard first: pathological nesting must not reach the schema walker.
  if (jsonDepth(input, limits.maxDepth) > limits.maxDepth) {
    return {
      ok: false,
      errors: [
        {
          code: "validation-limit",
          path: "",
          message: `The spec nests deeper than ${limits.maxDepth} levels (documented maxDepth limit); validation refused.`,
        },
      ],
    };
  }

  const errors: SpecError[] = [];
  // TypeBox Settings are process-global. Align with tsconfig exactOptionalPropertyTypes
  // and raise maxErrors so Value.Errors is not truncated at the default of 8.
  const previousMaxErrors = Settings.Get().maxErrors;
  const previousExactOptional = Settings.Get().exactOptionalPropertyTypes;
  Settings.Set({
    maxErrors: Math.max(limits.maxDiagnostics, previousMaxErrors),
    exactOptionalPropertyTypes: true,
  });
  try {
    // TypeBox's interpreted Value.Check / Value.Errors walk the cyclic schema
    // graph for every inline row. Use the compiled plot validator for the
    // common valid path, and Value.Errors only when building invalid diagnostics.
    const schemaValid: boolean = (plotSpecSchemaCheck as (value: unknown) => boolean)(input);

    // Tier-2 structural gate: run layerStructuralErrors only on branch-valid
    // layers. When the compiled plot check passed, LayerSpec's geom-discriminated
    // union already proves every layer matches its GEOM_BRANCHES member — skip
    // a second interpreted walk. When it failed, reuse the shape walk's per-layer
    // Value.Errors emptiness set (#1279).
    let branchOkLayers: ReadonlySet<number> | "all" = "all";

    if (!schemaValid) {
      if (!isRecord(input)) {
        return {
          ok: false,
          errors: [
            {
              code: "invalid-spec-root",
              path: "",
              message: `A plot spec must be a JSON object with a "layers" array (got ${Array.isArray(input) ? "an array" : typeof input}).`,
              fix: {
                description: "Provide an object with at least one layer.",
                example: {
                  layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
                },
              },
            },
          ],
        };
      }

      const shape = collectSchemaShapeErrors(input);
      errors.push(...shape.errors);
      branchOkLayers = shape.branchOkLayerIndices;
    }

    // TypeBox-free structural gates (shared with pipeline render path).
    if (schemaValid) {
      errors.push(...structuralGateErrors(input));
    }

    // --- tier 2 (opt-in via options): structural grammar checks ----------------
    // Required channels, the bar/count y ban, and the rule form rules are part
    // of the tier-2 contract (the pipeline enforces them at render time with
    // equivalent structured errors); tier 1 stays schema-shape-only so partial
    // specs remain composable.
    // Eligibility: record layers with a known geom whose branch is valid
    // (see branchOkLayers above). Uses shared GEOM_BRANCHES for known-geom keys.
    // --- tier 2 (opt-in): facet form rules --------------------------------------
    // Runs for any record-valued facet, even when the facet is schema-invalid.
    errors.push(
      ...collectLayerGrammarErrors(input, options, branchOkLayers),
      ...collectFacetGrammarErrors(input, options),
    );

    // --- tier 2 (opt-in): data-aware checks + optional lint --------------------
    // One resolveLayerFieldEvidence pass for plot + layer tables; dataChecks and
    // lintSpec share it. On limit/profile errors, lint gets no shared map so it
    // does not re-scan data that data-aware validation already refused.
    const advisories = collectDataValidation(input, options, limits, errors);
    const withAdvisories = advisories !== undefined && advisories.length > 0 ? { advisories } : {};

    if (errors.length > limits.maxDiagnostics) {
      const kept = errors.slice(0, limits.maxDiagnostics);
      kept.push({
        code: "validation-limit",
        path: "",
        message: `Diagnostics truncated: ${errors.length} problems found, showing the first ${limits.maxDiagnostics} (documented maxDiagnostics limit).`,
      });
      return { ok: false, errors: kept, ...withAdvisories };
    }

    if (errors.length > 0) return { ok: false, errors, ...withAdvisories };
    return { ok: true, spec: input as PortableSpec, ...withAdvisories };
  } finally {
    Settings.Set({
      maxErrors: previousMaxErrors,
      exactOptionalPropertyTypes: previousExactOptional,
    });
  }
}

function collectLayerGrammarErrors(
  input: unknown,
  options: ValidateOptions | undefined,
  branchOkLayers: ReadonlySet<number> | "all",
): SpecError[] {
  if (options === undefined || !isRecord(input) || !Array.isArray(input["layers"])) return [];
  const errors: SpecError[] = [];
  const plotAes = isRecord(input["aes"]) ? (input["aes"] as Aes) : undefined;
  const layers = input["layers"] as unknown[];
  for (let index = 0; index < layers.length; index++) {
    const layer = layers[index];
    if (!isRecord(layer)) continue;
    const geom = layer["geom"];
    if (typeof geom !== "string" || !Object.hasOwn(GEOM_BRANCHES, geom)) continue;
    if (branchOkLayers !== "all" && !branchOkLayers.has(index)) continue;
    errors.push(...layerStructuralErrors(layer, geom, index, plotAes));
  }
  return errors;
}

function collectFacetGrammarErrors(
  input: unknown,
  options: ValidateOptions | undefined,
): SpecError[] {
  if (options === undefined || !isRecord(input) || !isRecord(input["facet"])) return [];
  return facetStructuralErrors(input["facet"]);
}

function collectDataValidation(
  input: unknown,
  options: ValidateOptions | undefined,
  limits: typeof DEFAULT_VALIDATE_LIMITS,
  errors: SpecError[],
): SpecAdvisory[] | undefined {
  if (options === undefined || !isRecord(input)) return undefined;
  const layerResolved = resolveLayerFieldEvidence(input, options, limits);
  errors.push(...dataChecks(input, options, limits, layerResolved));
  if (options.lint !== true) return undefined;
  const shared = layerResolved.status === "ok" ? layerResolved.plot : null;
  return lintSpec(input, options, shared);
}
