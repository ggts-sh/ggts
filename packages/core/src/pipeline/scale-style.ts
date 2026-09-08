/** Training and semantic guide planning for mapped size/linewidth/alpha/shape/linetype. */
import type { PortableSpec, StyleAesthetic } from "@ggts-sh/spec";

import type { ScaleState } from "../scales/state.js";
import type { ColumnTable } from "../table.js";

import { collectStyleValues } from "./scale-style-collect.js";
import {
  getStyleScaleResolver,
  type StyleScaleFamily,
  type StyleScaleResolveInput,
} from "./scale-style-registry.js";
import type { StyleResolution } from "./scale-style-types.js";
import { PipelineError } from "./types.js";
import type { LayerBinding, LayerFrame, PipelineWarning } from "./types.js";

export function resolveStyleScale(input: {
  aesthetic: StyleAesthetic;
  frames: readonly LayerFrame[];
  bindings: readonly LayerBinding[];
  table: ColumnTable;
  sourceTable: ColumnTable;
  config: NonNullable<PortableSpec["scales"]>[StyleAesthetic] | undefined;
  prevState: ScaleState | null;
  title: string;
  warnings: PipelineWarning[];
}): StyleResolution {
  const { aesthetic, config, prevState, title, warnings } = input;
  // Sequential/binned/identity resolutions never read the source catalog,
  // so a provably-continuous numeric aesthetic skips the full-column dedupe
  // walk (100k rows × encodeKey × Set per mapped field on dense plots).
  const catalogMode =
    aesthetic === "shape" || aesthetic === "linetype"
      ? "always"
      : config?.type === undefined
        ? "auto"
        : config.type === "sequential" || config.type === "binned" || config.type === "identity"
          ? "never"
          : "always";
  const collected = collectStyleValues({ ...input, catalogMode });
  if (!collected.anyField) {
    return { aesthetic, resolved: null, legendInput: null, guidePlan: null, state: null };
  }
  const missingCount = collected.values.filter((value) => value === null).length;
  if (missingCount > 0) {
    warnings.push({
      code: "style-na-values",
      message: `${String(missingCount)} ${aesthetic} value(s) use the NA style.`,
    });
  }
  const family: StyleScaleFamily =
    aesthetic === "shape" || aesthetic === "linetype" ? "finite" : "numeric";
  const resolve = getStyleScaleResolver(family);
  if (resolve === undefined) {
    const register = family === "finite" ? "registerFiniteStyle" : "registerNumericStyle";
    throw new PipelineError(
      "unsupported-param",
      `/scales/${aesthetic}`,
      `Style scale family "${family}" is not registered in this build. Call ${register}() from @ggts-sh/core/headless/register once at startup, or registerBasic() from @ggts-sh/core.`,
    );
  }
  const resolved: StyleScaleResolveInput = {
    aesthetic,
    values: collected.values,
    catalog: collected.catalog,
    anyDiscrete: collected.anyDiscrete,
    anyIndexable: collected.anyIndexable,
    ...(collected.nonInteractiveValues !== undefined && {
      nonInteractiveValues: collected.nonInteractiveValues,
    }),
    config,
    prevState,
    title,
    warnings,
  };
  return resolve(resolved);
}
