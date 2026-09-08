/**
 * Lean portable builder entry (`@ggts-sh/spec/portable`).
 *
 * Exports the fluent builder without TypeBox: `.spec()` is an alias of
 * `.toPortable()` (normalize only). Use this from chart render bundles;
 * keep `@ggts-sh/spec` + `.spec()` / `validate()` for agent authoring.
 *
 * Lifecycle (Hadley lesson 13; meanings in CONTRIBUTING.md): tags collected
 * into lifecycle.json by scripts/gen-lifecycle.ts.
 */
// @lifecycle-default experimental

export type {
  AuthoringCellValue,
  AuthoringColumns,
  AuthoringDataRef,
  AuthoringRows,
  DataInput,
} from "./builder-data.js";

export type {
  GeomAreaOptions,
  GeomBarOptions,
  GeomBoxplotOptions,
  GeomColOptions,
  GeomDensityOptions,
  GeomHistogramOptions,
  GeomLineOptions,
  GeomPointOptions,
  GeomSmoothOptions,
  GeomTextOptions,
} from "./builder-options.js";

export { normalize } from "./normalize.js";
export type { AesInput, SpecInput } from "./normalize.js";

export { aes, gg, GGBuilder } from "./portable-builder.js";
