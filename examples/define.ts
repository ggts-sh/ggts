/**
 * defineExample — the typed entry point every example's spec.ts exports
 * through. It normalizes + validates eagerly, so a broken example fails at
 * import time (manifest generation, docs build, VR run) instead of rendering
 * garbage, and the default export is always a canonical PortableSpec — the
 * exact JSON the docs "spec" tab shows and agents would emit.
 */
import type { PortableSpec, SpecInput } from "@ggts-sh/spec";
import { normalize, SpecValidationError, validate } from "@ggts-sh/spec";

export function defineExample(input: SpecInput | PortableSpec): PortableSpec {
  const spec = normalize(input);
  // Tier 2 (the {} argument): examples carry inline data, so the grammar's
  // structural + data-aware checks run too — not just schema shape.
  const result = validate(spec, {});
  if (!result.ok) throw new SpecValidationError(result.errors);
  return spec;
}
