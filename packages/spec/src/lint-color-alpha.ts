/**
 * Spec lint rule `ordinal-color-times-alpha` (issue #1962).
 *
 * Warns when a discrete color or fill scale (> 4 classes) co-occurs on a layer
 * with a continuously interpolating quantitative alpha ramp, producing a
 * hue × opacity grid exceeding ~8 distinguishable shades.
 */
import type { SpecAdvisory } from "./lint.js";
import { configuredColorScaleType } from "./scale-color-helpers.js";
import type { Aes, CellValue, ColorScaleSpec } from "./schema.js";
import { effectiveChannel, type FieldEvidenceMap } from "./validate-data.js";
import { isRecord } from "./validate-structure-layer-shared.js";

const COLOR_CHANNELS = ["color", "fill"] as const;
type ColorChannel = (typeof COLOR_CHANNELS)[number];

const MAX_CLASSES_WITH_CONTINUOUS_ALPHA = 4;
const SKIPPED_COLOR_TYPES = new Set<string>(["sequential", "binned", "identity"]);
const DISCRETE_COLOR_TYPES = new Set<string>(["ordinal", "manual"]);
const DISCRETE_FIELD_TYPES = new Set<string>(["nominal", "ordinal"]);

function isInterpolatingAlphaScale(alphaConfig: unknown): boolean {
  if (alphaConfig === undefined) return true;
  if (!isRecord(alphaConfig)) return false;
  const scaleType = alphaConfig["type"];
  if (scaleType !== undefined && scaleType !== "sequential") return false;
  const range = alphaConfig["range"];
  if (range === undefined) return true;
  if (!Array.isArray(range) || range.length < 2) return false;
  if (!range.every((value) => typeof value === "number" && Number.isFinite(value))) return false;
  const first = range[0] as number;
  return first !== (range.at(-1) as number);
}

function isDiscreteColorScale(configuredType: string | undefined, fieldType: string): boolean {
  if (configuredType !== undefined) return DISCRETE_COLOR_TYPES.has(configuredType);
  return DISCRETE_FIELD_TYPES.has(fieldType);
}

function addDistinctNonNull(values: readonly unknown[], target: Set<unknown>): void {
  for (const value of values) {
    if (value !== null && value !== undefined) target.add(value);
  }
}

function countDistinctNonNull(values: readonly unknown[]): number {
  const distinct = new Set<unknown>();
  addDistinctNonNull(values, distinct);
  return distinct.size;
}

interface LayerMatch {
  alphaField: string;
  colorValues: readonly CellValue[];
}

function layerColorAlphaMatch(input: {
  layer: unknown;
  fields: FieldEvidenceMap | null;
  plotAes: Aes | undefined;
  channel: ColorChannel;
  configuredColorType: string | undefined;
}): LayerMatch | null {
  const { layer, fields, plotAes, channel, configuredColorType } = input;
  if (!isRecord(layer) || fields === null) return null;
  const layerAes = isRecord(layer["aes"]) ? (layer["aes"] as Aes) : undefined;
  const alphaMapped = effectiveChannel(plotAes, layerAes, "alpha");
  if (alphaMapped === undefined || !("field" in alphaMapped)) return null;
  const alphaInfo = fields.get(alphaMapped.field);
  if (alphaInfo === undefined || alphaInfo.type !== "quantitative" || alphaInfo.values === null) {
    return null;
  }
  const colorMapped = effectiveChannel(plotAes, layerAes, channel);
  if (colorMapped === undefined || !("field" in colorMapped)) return null;
  const colorInfo = fields.get(colorMapped.field);
  if (colorInfo === undefined || colorInfo.type === null || colorInfo.values === null) return null;
  if (!isDiscreteColorScale(configuredColorType, colorInfo.type)) return null;
  return { alphaField: alphaMapped.field, colorValues: colorInfo.values };
}

function evaluateChannel(input: {
  channel: ColorChannel;
  layers: readonly unknown[];
  scales: Record<string, unknown> | undefined;
  plotAes: Aes | undefined;
  layerEvidence: readonly (FieldEvidenceMap | null)[];
  plotEvidence: FieldEvidenceMap | null;
}): SpecAdvisory | null {
  const { channel, layers, scales, plotAes, layerEvidence, plotEvidence } = input;
  const scaleRaw = scales?.[channel];
  if (scaleRaw !== undefined && !isRecord(scaleRaw)) return null;
  const scaleConfig = scaleRaw as ColorScaleSpec | undefined;
  const configuredColorType = configuredColorScaleType(scaleConfig);
  if (configuredColorType !== undefined && SKIPPED_COLOR_TYPES.has(configuredColorType)) {
    return null;
  }

  const explicitDomain = Array.isArray(scaleConfig?.domain) ? scaleConfig.domain : null;
  const seenColumns = new Set<readonly CellValue[]>();
  const distinctValues = new Set<unknown>();
  let firstAlphaField: string | null = null;

  for (let i = 0; i < layers.length; i++) {
    const layerFields = layerEvidence[i];
    const fields = layerFields === undefined ? plotEvidence : layerFields;
    const match = layerColorAlphaMatch({
      layer: layers[i],
      fields,
      plotAes,
      channel,
      configuredColorType,
    });
    if (match === null) continue;
    firstAlphaField ??= match.alphaField;
    if (explicitDomain === null && !seenColumns.has(match.colorValues)) {
      seenColumns.add(match.colorValues);
      addDistinctNonNull(match.colorValues, distinctValues);
    }
  }

  if (firstAlphaField === null) return null;
  const classCount =
    explicitDomain === null ? distinctValues.size : countDistinctNonNull(explicitDomain);
  if (classCount <= MAX_CLASSES_WITH_CONTINUOUS_ALPHA) return null;

  return {
    code: "ordinal-color-times-alpha",
    path: `/scales/${channel}`,
    message: `scales.${channel} encodes ${classCount} discrete classes while alpha continuously interpolates "${firstAlphaField}" — ${classCount} hues × continuous opacity steps exceed ~8 distinguishable shades.`,
    suggestion: {
      description: `Encode one variable with ${channel} and the other with position or small multiples, drop alpha to a constant, or bin alpha into at most two steps.`,
    },
  };
}

/**
 * Advisories for discrete `color`/`fill` scales paired with continuous
 * interpolating quantitative `alpha`. Skips silently when field values are
 * absent (missing data, over-limit inline data, or profile-only evidence).
 */
export function collectOrdinalColorTimesAlphaAdvisories(
  spec: Record<string, unknown>,
  layerEvidence: readonly (FieldEvidenceMap | null)[],
  plotEvidence: FieldEvidenceMap | null,
): SpecAdvisory[] {
  const layers = spec["layers"];
  if (!Array.isArray(layers) || layers.length === 0) return [];
  const rawScales = spec["scales"];
  if (rawScales !== undefined && !isRecord(rawScales)) return [];
  if (!isInterpolatingAlphaScale(rawScales?.["alpha"])) return [];

  const plotAes = isRecord(spec["aes"]) ? (spec["aes"] as Aes) : undefined;
  const advisories: SpecAdvisory[] = [];
  for (const channel of COLOR_CHANNELS) {
    const advisory = evaluateChannel({
      channel,
      layers,
      scales: rawScales,
      plotAes,
      layerEvidence,
      plotEvidence,
    });
    if (advisory !== null) advisories.push(advisory);
  }
  return advisories;
}
