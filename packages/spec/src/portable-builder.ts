/**
 * Lean portable builder implementation (values for `@ggts-sh/spec/portable`).
 * Index surface re-exports live in {@link ./portable-entry.ts}.
 */
import type { AesInput } from "./normalize.js";
import { toAuthoringDataRef, type DataInput } from "./builder-data.js";
import { GGBuilderCore } from "./builder-core.js";
import { WithBuilderGeoms } from "./builder-geoms.js";
import { WithBuilderScales } from "./builder-scales.js";
import type { PortableSpec } from "./schema.js";

/** Identity helper for aesthetic mappings (same as full package `aes`). */
export function aes(mapping: AesInput): AesInput {
  return mapping;
}

/**
 * Portable builder: `.spec()` and `.toPortable()` both normalize only.
 * Full schema validation: import `validate` from `@ggts-sh/spec`.
 */
export class GGBuilder extends WithBuilderScales(WithBuilderGeoms(GGBuilderCore)) {
  /** Normalize-only finish (TypeBox-free). Alias of {@link toPortable}. */
  spec(): PortableSpec {
    return this.toPortable();
  }
}

/** Start a plot for render paths: gg(data, aes(...)).geomPoint().spec(). */
export function gg(data?: DataInput, mapping?: AesInput): GGBuilder {
  return new GGBuilder({
    ...(data !== undefined && { data: toAuthoringDataRef(data) }),
    ...(mapping !== undefined && { aes: mapping }),
    layers: [],
  });
}
