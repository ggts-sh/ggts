/**
 * Color/fill scale resolution (ordinal value-stable + sequential ramps).
 */
import { configuredColorScaleType, type ColorScaleSpec } from "@ggts-sh/spec";

import type { ScaleState } from "../scales/state.js";
import type { ColumnTable } from "../table.js";
import type { EditionDefaults } from "../editions.js";

import {
  collectColorCatalogValues,
  collectColorChannelFlags,
  collectColorChannelValues,
  countNullColorChannelValues,
} from "./scale-color-collect.js";
import {
  getColorScaleResolver,
  type ColorScaleKind,
  type ColorScaleResolveInput,
} from "./scale-color-registry.js";
import type { ColorResolution } from "./scale-color-types.js";
import { PipelineError } from "./types.js";
import type { Advisory, LayerBinding, LayerFrame, PipelineWarning } from "./types.js";

export type { ColorResolution } from "./scale-color-types.js";

const COLOR_KIND_REGISTER: Record<ColorScaleKind, string> = {
  ordinal: "registerOrdinalColor",
  sequential: "registerSequentialColor",
  binned: "registerBinnedColor",
  manual: "registerManualColor",
  identity: "registerIdentityColor",
};

function resolveRegistered(type: ColorScaleKind, input: ColorScaleResolveInput): ColorResolution {
  const resolve = getColorScaleResolver(type);
  if (resolve === undefined) {
    throw new PipelineError(
      "unsupported-param",
      `/scales/${input.name}`,
      `Color scale type "${type}" is not registered in this build. Call ${COLOR_KIND_REGISTER[type]}() from @ggts-sh/core/headless/register once at startup, or registerBasic() from @ggts-sh/core.`,
    );
  }
  return resolve(input);
}

export function resolveColorScale(
  name: "color" | "fill",
  frames: readonly LayerFrame[],
  bindings: readonly LayerBinding[],
  table: ColumnTable,
  catalogTable: ColumnTable,
  config: ColorScaleSpec | undefined,
  prevState: ScaleState | null,
  legendTitle: string,
  warnings: PipelineWarning[],
  advisories: Advisory[],
  editionDefaults: EditionDefaults,
): ColorResolution {
  // Retain source-field evidence without scanning its values unless the
  // configured kind consumes the unfiltered catalog. An inferred ordinal
  // scale collects values after its source and frame flags are combined.
  const configuredType = configuredColorScaleType(config);
  const catalog = collectColorCatalogValues(
    name,
    bindings,
    catalogTable,
    configuredType === "ordinal" || configuredType === "manual",
  );
  const flags = collectColorChannelFlags(name, frames, table);
  const anyDiscreteField = flags.anyDiscreteField || catalog.anyDiscreteField;
  const anyField = flags.anyField || catalog.anyField;
  if (!anyField) return { resolved: null, legendInput: null, guidePlan: null, state: null };

  const type = configuredType ?? (anyDiscreteField ? "ordinal" : "sequential");

  // NA-color warning: count nulls without allocating a full values array.
  const missingCount = countNullColorChannelValues(name, frames);
  if (missingCount > 0) {
    warnings.push({
      code: "color-na-values",
      message: `${String(missingCount)} ${name} value(s) use the NA color.`,
    });
  }

  const catalogValues =
    configuredType === undefined && type === "ordinal"
      ? collectColorCatalogValues(name, bindings, catalogTable).catalogValues
      : catalog.catalogValues;
  const shared = {
    name,
    catalogValues,
    anyDiscreteField,
    config,
    prevState,
    legendTitle,
    warnings,
    advisories,
    editionDefaults,
  };

  // Ordinal: train on the unfiltered source catalog when available.
  if (type === "ordinal") {
    let domainValues = catalogValues;
    if (domainValues.length === 0) {
      // No source field (stat-only color): fall back to frame values.
      domainValues = collectColorChannelValues(name, frames, table).values;
    }
    return resolveRegistered("ordinal", { ...shared, values: domainValues });
  }

  // Sequential / binned / manual / identity still need the per-row values.
  const values = collectColorChannelValues(name, frames, table).values;
  return resolveRegistered(type, { ...shared, values });
}
