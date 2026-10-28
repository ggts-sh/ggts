/**
 * TypeBox-free structural gates that always ran after schema shape success in
 * validate(). Kept on the render path so pipeline/assemble drop only the
 * Compile(PlotSpecSchema) tier, not color-scheme / binned-style / guide /
 * coord-facet checks.
 */
import { SpecValidationError, type SpecError } from "./errors.js";
import {
  binnedStyleScaleStructuralErrors,
  colorScaleStructuralErrors,
  coordFacetStructuralErrors,
  facetSpaceStructuralErrors,
  guideStructuralErrors,
  positionLabelsStructuralErrors,
} from "./validate-structure.js";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Unconditional structural diagnostics from validate() (pre tier-2 options).
 * Safe to call without TypeBox / schema-declarations.
 */
export function structuralGateErrors(input: unknown): SpecError[] {
  if (!isRecord(input)) return [];
  const errors: SpecError[] = [];
  if (isRecord(input["scales"])) {
    errors.push(
      ...colorScaleStructuralErrors(input["scales"]),
      ...binnedStyleScaleStructuralErrors(input["scales"]),
      ...positionLabelsStructuralErrors(input["scales"]),
    );
  }
  const guides = isRecord(input["guides"]) ? input["guides"] : {};
  const scales = isRecord(input["scales"]) ? input["scales"] : undefined;
  errors.push(
    ...guideStructuralErrors(guides, scales),
    ...coordFacetStructuralErrors(input),
    ...facetSpaceStructuralErrors(input),
  );
  return errors;
}

/** Throw SpecValidationError when structuralGateErrors is non-empty. */
export function assertStructuralGate(input: unknown): void {
  const errors = structuralGateErrors(input);
  if (errors.length > 0) throw new SpecValidationError(errors);
}
