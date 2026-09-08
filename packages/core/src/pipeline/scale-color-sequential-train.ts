/** Train a transformed sequential color/fill scale. */
import { CYCLIC_SCHEME_NAMES, type ColorScaleSpec } from "@ggts-sh/spec";

const CYCLIC_SCHEMES = new Set<string>(CYCLIC_SCHEME_NAMES);

import type { EditionDefaults } from "../editions.js";
import { trainSequential, type SequentialColorScale } from "../scales/color.js";
import { finiteExtent } from "../scales/train.js";
import { scaleTransform } from "../scales/transform.js";
import type { CellValue } from "../table.js";

import { resolveSequentialRange } from "./scale-color-sequential-domain.js";
import { resolveColorValueView } from "./scale-color-values.js";
import type { Advisory, PipelineWarning } from "./types.js";
import { PipelineError } from "./types.js";

export function trainSequentialColorScale(input: {
  name: "color" | "fill";
  values: readonly CellValue[];
  anyDiscreteField: boolean;
  config: ColorScaleSpec | undefined;
  editionDefaults: EditionDefaults;
  warnings: PipelineWarning[];
  advisories: Advisory[];
}): SequentialColorScale {
  const { name, values, config, warnings, advisories } = input;
  warnSequentialDiscrete(input);
  const prepared = prepareSequentialColor(input);
  const scale = trainPreparedSequentialColor(name, prepared);
  warnSequentialUnknowns(name, values, prepared, scale, warnings);
  if (config?.scheme === undefined && config?.range === undefined) {
    advisories.push({
      code: "palette-inferred",
      path: `scales.${name}`,
      chosen: "sequential viridis ramp",
      howToOverride: `Set scales.${name}.range (ramp stops) or scales.${name}.domain.`,
    });
  }
  const guideBreaks = resolveSequentialBreaks(
    name,
    config,
    prepared.view,
    prepared.transform,
    scale,
  );
  const semanticColorOf = (value: unknown): string | undefined => scale.colorOf(value);
  return {
    ...scale,
    ...(prepared.view.temporalKind !== null &&
      prepared.view.temporalKind !== "time" && {
        temporal: true,
        temporalKind: prepared.view.temporalKind,
      }),
    ...(guideBreaks !== undefined && { guideBreaks: Object.freeze(guideBreaks) }),
    colorOf(value: unknown): string | undefined {
      if (value === null || value === undefined) return semanticColorOf(null);
      const semantic = prepared.view.semanticOf(value);
      return semantic === undefined ? scale.unknownValue : semanticColorOf(semantic);
    },
  };
}

type SequentialColorInput = Parameters<typeof trainSequentialColorScale>[0];
type PreparedSequentialColor = {
  view: ReturnType<typeof resolveColorValueView>;
  config: ColorScaleSpec | undefined;
  transformName: NonNullable<ColorScaleSpec["transform"]>;
  transform: ReturnType<typeof scaleTransform>;
  extent: ReturnType<typeof finiteExtent>;
  domain: [number, number] | undefined;
  range: ReturnType<typeof resolveSequentialRange>;
  oob: ColorScaleSpec["oob"];
};

function warnSequentialDiscrete(input: SequentialColorInput): void {
  const { name, anyDiscreteField, config, warnings } = input;
  if (anyDiscreteField && config?.temporalKind === undefined && config?.parse === undefined) {
    warnings.push({
      code: "sequential-discrete-field",
      message: `The ${name} scale is sequential but a mapped field is discrete; values that do not parse as numbers render the unknown color.`,
    });
  }
}

function prepareSequentialColor(input: SequentialColorInput): PreparedSequentialColor {
  const { name, values, config, editionDefaults, warnings } = input;
  const view = resolveColorValueView({ name, values, config, warnings });
  const transformName = config?.transform ?? "identity";
  const transform = scaleTransform(transformName);
  const validSemantic = Float64Array.from(view.semantic, (value) =>
    transform.valid(value) ? value : Number.NaN,
  );
  const extent = finiteExtent([validSemantic]);
  const invalidCount = view.semantic.reduce(
    (count, value) => count + (Number.isFinite(value) && !transform.valid(value) ? 1 : 0),
    0,
  );
  if (invalidCount > 0) {
    warnings.push({
      code: "color-transform-invalid",
      message: `${String(invalidCount)} ${name} value(s) are invalid for the ${transformName} transform and use the unknown color.`,
    });
  }
  const domain = resolveColorDomain(name, config, view);
  validateColorTransformInput(name, values, config, transformName, extent, domain);
  const range = resolveSequentialRange(config, editionDefaults);
  const cyclic = config?.scheme !== undefined && CYCLIC_SCHEMES.has(config.scheme);
  const oob = config?.oob ?? (cyclic ? "wrap" : undefined);
  return { view, config, transformName, transform, extent, domain, range, oob };
}

function resolveColorDomain(
  name: "color" | "fill",
  config: ColorScaleSpec | undefined,
  view: ReturnType<typeof resolveColorValueView>,
): [number, number] | undefined {
  const configuredDomain = config?.domain;
  const semanticDomain =
    configuredDomain?.length === 2
      ? ([view.semanticOf(configuredDomain[0]), view.semanticOf(configuredDomain[1])] as const)
      : undefined;
  const domain =
    semanticDomain !== undefined &&
    semanticDomain[0] !== undefined &&
    semanticDomain[1] !== undefined
      ? ([semanticDomain[0], semanticDomain[1]] as [number, number])
      : undefined;
  if (configuredDomain !== undefined && domain === undefined) {
    throw new PipelineError(
      "color-domain-invalid",
      `/scales/${name}/domain`,
      `The ${name} domain must contain exactly two values valid for its parser and transform.`,
    );
  }
  return domain;
}

function validateColorTransformInput(
  name: "color" | "fill",
  values: readonly CellValue[],
  config: ColorScaleSpec | undefined,
  transformName: NonNullable<ColorScaleSpec["transform"]>,
  extent: ReturnType<typeof finiteExtent>,
  domain: [number, number] | undefined,
): void {
  if (
    extent !== null ||
    domain !== undefined ||
    !values.some((value) => value !== null) ||
    (transformName === "identity" &&
      config?.temporalKind === undefined &&
      config?.parse === undefined)
  ) {
    return;
  }
  throw new PipelineError(
    "color-transform-empty",
    `/scales/${name}`,
    `All ${name} values are invalid for the ${transformName} transform.`,
  );
}

function trainPreparedSequentialColor(
  name: "color" | "fill",
  prepared: PreparedSequentialColor,
): SequentialColorScale {
  const { extent, domain, range, transformName, oob, config } = prepared;
  try {
    return trainSequential(extent, {
      ...(domain !== undefined && { domain }),
      ...(range !== undefined && { range }),
      ...(config?.reverse !== undefined && { reverse: config.reverse }),
      transform: transformName,
      ...(oob !== undefined && { oob }),
      ...(config?.naValue !== undefined && { naValue: config.naValue }),
      ...(config?.unknownValue !== undefined && { unknownValue: config.unknownValue }),
    });
  } catch (error) {
    throw new PipelineError(
      "color-domain-transform",
      `/scales/${name}/domain`,
      error instanceof Error ? error.message : `Invalid ${name} transform domain.`,
    );
  }
}

function warnSequentialUnknowns(
  name: "color" | "fill",
  values: readonly CellValue[],
  prepared: PreparedSequentialColor,
  scale: SequentialColorScale,
  warnings: PipelineWarning[],
): void {
  const { view, transform, oob } = prepared;
  const lower = Math.min(scale.domain[0], scale.domain[1]);
  const upper = Math.max(scale.domain[0], scale.domain[1]);
  let unknownCount = 0;
  for (let index = 0; index < values.length; index++) {
    if (values[index] === null) continue;
    const semantic = view.semantic[index]!;
    if (
      !Number.isFinite(semantic) ||
      !transform.valid(semantic) ||
      (oob !== "squish" && oob !== "wrap" && (semantic < lower || semantic > upper))
    ) {
      unknownCount++;
    }
  }
  if (unknownCount > 0) {
    warnings.push({
      code: "color-unknown-values",
      message: `${String(unknownCount)} ${name} value(s) use the unknown color.`,
    });
  }
}

function resolveSequentialBreaks(
  name: "color" | "fill",
  config: ColorScaleSpec | undefined,
  view: ReturnType<typeof resolveColorValueView>,
  transform: ReturnType<typeof scaleTransform>,
  scale: SequentialColorScale,
): number[] | undefined {
  const guideBreaks = config?.breaks?.map((value) => view.semanticOf(value));
  const lower = Math.min(scale.domain[0], scale.domain[1]);
  const upper = Math.max(scale.domain[0], scale.domain[1]);
  if (
    guideBreaks?.some(
      (value) => value === undefined || !transform.valid(value) || value < lower || value > upper,
    ) === true
  ) {
    throw new PipelineError(
      "color-domain-invalid",
      `/scales/${name}/breaks`,
      `Every ${name} colorbar break must parse, satisfy the transform, and lie inside the semantic domain.`,
    );
  }
  return guideBreaks as number[] | undefined;
}
