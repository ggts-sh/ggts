/** Binned color/fill scale family (colorsteps over transformed semantic bins). */
import type { ColorScaleSpec } from "@ggts-sh/spec";

import type { EditionDefaults } from "../editions.js";
import { normalizeColor, rampColor, VIRIDIS_RAMP_10 } from "../scales/color.js";
import type { BinnedColorScale } from "../scales/non-position-color.js";
import { finiteExtent } from "../scales/train.js";
import { scaleTransform } from "../scales/transform.js";
import type { CellValue } from "../table.js";

import { fallbackColors, warnUnknownColors } from "./scale-color-family-helpers.js";
import { resolveSequentialRange } from "./scale-color-sequential-domain.js";
import { minAdjacentWidth, resolveBinnedLegendFormat } from "./scale-color-sequential-format.js";
import type { ColorResolution } from "./scale-color-types.js";
import { resolveColorValueView } from "./scale-color-values.js";
import { PipelineError, type PipelineWarning } from "./types.js";

const DEFAULT_BIN_COUNT = 5;

export function resolveBinnedColorScale(input: {
  name: "color" | "fill";
  values: readonly CellValue[];
  config: ColorScaleSpec;
  legendTitle: string;
  warnings: PipelineWarning[];
  editionDefaults: EditionDefaults;
}): ColorResolution {
  const { name, values, config, legendTitle, warnings, editionDefaults } = input;
  const view = resolveColorValueView({ name, values, config, warnings });
  const { transformName, transform, domain, breaks, transformedBreaks } = prepareBinnedDomain(
    name,
    config,
    view,
  );
  const binCount = breaks.length - 1;
  const configuredRange = resolveSequentialRange(config, editionDefaults) ?? VIRIDIS_RAMP_10;
  const normalizedRange = configuredRange.map((color) => normalizeColor(color));
  const colors = resolveBinnedColors(normalizedRange, binCount, config.reverse === true);
  const { naValue, unknownValue } = fallbackColors(config);
  const sourceLower = domain[0];
  const sourceUpper = domain[1];
  const transformedOf = (semantic: number): number | undefined => {
    let bounded = semantic;
    if (bounded < sourceLower || bounded > sourceUpper) {
      if (config.oob !== "squish") return undefined;
      bounded = Math.min(sourceUpper, Math.max(sourceLower, bounded));
    }
    const transformed = transform.forward(bounded);
    return Number.isFinite(transformed) ? transformed : undefined;
  };
  const semanticColorOf = (semantic: number): string =>
    binnedColorOf(semantic, transformedBreaks, colors, binCount, transformedOf, unknownValue);
  const scale: BinnedColorScale = Object.freeze({
    type: "binned" as const,
    domain,
    transformedDomain: [transformedBreaks[0]!, transformedBreaks.at(-1)!] as [number, number],
    transform: transformName,
    reverse: config.reverse === true,
    breaks: Object.freeze([...breaks]),
    transformedBreaks: Object.freeze(transformedBreaks),
    colors: Object.freeze(colors),
    naValue,
    unknownValue,
    ...(view.temporalKind !== null &&
      view.temporalKind !== "time" && { temporalKind: view.temporalKind }),
    colorOf(value: unknown): string | undefined {
      if (value === null || value === undefined) return naValue;
      const semantic = view.semanticOf(value);
      return semantic === undefined ? unknownValue : semanticColorOf(semantic);
    },
  });
  // Index the batch semantic array (same alignment as sequential-train). Do not
  // re-derive rows via semanticOf — that re-pays encodeKey/Map lookup or a
  // single-row parseColumn on temporal misses the batch already recorded.
  warnUnknownColors(name, countUnknownBinnedValues(values, view.semantic, transformedOf), warnings);
  const formatStep = minAdjacentWidth(breaks);
  const formatter = resolveBinnedLegendFormat({
    domain,
    temporalKind: view.temporalKind,
    config,
    name,
    warnings,
    ...(formatStep !== undefined && { formatStep }),
  });
  const steps = breaks.slice(0, -1).map((lower, index) =>
    Object.freeze({
      lower,
      upper: breaks[index + 1]!,
      lowerInclusive: true as const,
      upperInclusive: index === binCount - 1,
      label: `${formatter.label(lower)}–${formatter.label(breaks[index + 1]!)}`,
      color: colors[index]!,
    }),
  );
  return {
    resolved: { kind: "binned", scale },
    legendInput: {
      kind: "steps",
      scale: name,
      title: legendTitle,
      entries: steps.map(({ label, color }) => ({ label, color })),
    },
    guidePlan: Object.freeze({
      type: "colorsteps" as const,
      id: `guide:${name}`,
      aesthetic: name,
      title: legendTitle,
      domain: Object.freeze([...domain] as [number, number]),
      transformedDomain: Object.freeze([...scale.transformedDomain] as [number, number]),
      transform: transformName,
      temporalKind: view.temporalKind,
      direction: config.reverse === true ? ("descending" as const) : ("ascending" as const),
      steps: Object.freeze(steps),
      naValue,
      unknownValue,
    }),
    state: null,
  };
}

type BinnedValueView = ReturnType<typeof resolveColorValueView>;

function configuredBinnedDomain(
  name: "color" | "fill",
  config: ColorScaleSpec,
  view: BinnedValueView,
  extent: [number, number] | null,
): [number, number] | null {
  const configuredDomain = config.domain;
  const mappedDomain =
    configuredDomain?.length === 2
      ? ([view.semanticOf(configuredDomain[0]), view.semanticOf(configuredDomain[1])] as const)
      : undefined;
  if (
    configuredDomain !== undefined &&
    (mappedDomain?.[0] === undefined || mappedDomain[1] === undefined)
  ) {
    throw new PipelineError(
      "color-binned-domain",
      `/scales/${name}/domain`,
      `The ${name} binned domain must contain exactly two finite semantic values.`,
    );
  }
  return mappedDomain?.[0] !== undefined && mappedDomain[1] !== undefined
    ? [mappedDomain[0], mappedDomain[1]]
    : extent;
}

function parsedBinnedBreaks(
  name: "color" | "fill",
  config: ColorScaleSpec,
  view: BinnedValueView,
  domain: [number, number] | null,
): number[] {
  const breaks =
    config.breaks?.map((value) => view.semanticOf(value)).filter((value) => value !== undefined) ??
    [];
  if (config.breaks !== undefined && breaks.length !== config.breaks.length) {
    throw new PipelineError(
      "color-binned-breaks",
      `/scales/${name}/breaks`,
      `Every ${name} colorstep boundary must parse as a finite semantic value.`,
    );
  }
  if (
    breaks.length >= 2 &&
    domain !== null &&
    config.domain !== undefined &&
    (domain[0] !== breaks[0] || domain[1] !== breaks.at(-1))
  ) {
    throw new PipelineError(
      "color-binned-domain",
      `/scales/${name}/domain`,
      `The ${name} binned domain must match the first and last explicit colorstep boundaries.`,
    );
  }
  return breaks;
}

function binnedBreakDomain(
  name: "color" | "fill",
  config: ColorScaleSpec,
  domain: [number, number] | null,
  breaks: readonly number[],
): [number, number] {
  if (domain === null) {
    throw new PipelineError(
      "color-binned-empty",
      `/scales/${name}`,
      `No ${name} values are valid for the ${config.transform ?? "identity"} binned scale.`,
    );
  }
  return [breaks[0]!, breaks.at(-1)!];
}

function prepareBinnedDomain(
  name: "color" | "fill",
  config: ColorScaleSpec,
  view: BinnedValueView,
): {
  transformName: ReturnType<typeof scaleTransform>["key"];
  transform: ReturnType<typeof scaleTransform>;
  domain: [number, number];
  breaks: number[];
  transformedBreaks: number[];
} {
  const transformName = config.transform ?? "identity";
  const transform = scaleTransform(transformName);
  const valid = Float64Array.from(view.semantic, (value) =>
    transform.valid(value) ? value : Number.NaN,
  );
  const extent = finiteExtent([valid]);
  let domain = configuredBinnedDomain(name, config, view, extent);
  let breaks = parsedBinnedBreaks(name, config, view, domain);
  if (breaks.length >= 2) domain = binnedBreakDomain(name, config, domain, breaks);
  if (domain === null) {
    throw new PipelineError(
      "color-binned-empty",
      `/scales/${name}`,
      `No ${name} values are valid for the ${transformName} binned scale.`,
    );
  }
  const t0 = transform.forward(domain[0]);
  const t1 = transform.forward(domain[1]);
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t0 === t1) {
    throw new PipelineError(
      "color-binned-domain",
      `/scales/${name}/domain`,
      `The ${name} binned domain must contain two distinct values valid for ${transformName}.`,
    );
  }
  if (breaks.length === 0) {
    breaks = Array.from({ length: DEFAULT_BIN_COUNT + 1 }, (_, index) =>
      transform.inverse(t0 + ((t1 - t0) * index) / DEFAULT_BIN_COUNT),
    );
  }
  const transformedBreaks = breaks.map((value) => transform.forward(value));
  if (
    transformedBreaks.some((value) => !Number.isFinite(value)) ||
    transformedBreaks.some((value, index) => index > 0 && value <= transformedBreaks[index - 1]!)
  ) {
    throw new PipelineError(
      "color-binned-breaks",
      `/scales/${name}/breaks`,
      `The ${name} colorstep boundaries must be distinct and strictly increasing in ${transformName} space.`,
    );
  }
  return {
    transformName,
    transform,
    domain: [breaks[0]!, breaks.at(-1)!],
    breaks,
    transformedBreaks,
  };
}

function resolveBinnedColors(
  range: readonly string[],
  binCount: number,
  reverse: boolean,
): string[] {
  const colors =
    range.length === binCount
      ? [...range]
      : Array.from({ length: binCount }, (_, index) => rampColor(range, (index + 0.5) / binCount));
  return reverse ? colors.toReversed() : colors;
}

function binnedColorOf(
  semantic: number,
  transformedBreaks: readonly number[],
  colors: readonly string[],
  binCount: number,
  transformedOf: (value: number) => number | undefined,
  unknownValue: string,
): string {
  const transformed = transformedOf(semantic);
  if (transformed === undefined) return unknownValue;
  let low = 0;
  let high = transformedBreaks.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (transformed < transformedBreaks[middle]!) high = middle;
    else low = middle + 1;
  }
  const index = Math.min(binCount - 1, low - 1);
  return index < 0 ? unknownValue : colors[index]!;
}

function countUnknownBinnedValues(
  values: readonly CellValue[],
  semantic: ArrayLike<number>,
  transformedOf: (value: number) => number | undefined,
): number {
  let unknownCount = 0;
  for (let index = 0; index < values.length; index++) {
    if (
      values[index] !== null &&
      (!Number.isFinite(semantic[index]!) || transformedOf(semantic[index]!) === undefined)
    ) {
      unknownCount++;
    }
  }
  return unknownCount;
}
