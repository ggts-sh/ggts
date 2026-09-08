/** Semantic color/fill guide label format resolution. */
import type { ColorScaleSpec, TemporalKind } from "@ggts-sh/spec";

import { numberFormatter } from "../layout/format-number.js";
import { defaultTimeTickFormat } from "../layout/time.js";
import { defaultTickFormat, tickStep } from "../layout/ticks.js";
import type { SequentialColorScale } from "../scales/color.js";
import { getTemporalRuntime } from "../temporal-runtime.js";

import type { PipelineWarning } from "./types.js";

export interface ColorLegendFormatter {
  label(value: number): string;
  fullLabel(value: number): string;
}

/** Minimum positive adjacent gap among finite break edges (skips non-positive gaps). */
export function minAdjacentWidth(breaks: readonly number[]): number | undefined {
  let min: number | undefined;
  for (let index = 1; index < breaks.length; index++) {
    const width = breaks[index]! - breaks[index - 1]!;
    if (!Number.isFinite(width) || width <= 0) continue;
    if (min === undefined || width < min) min = width;
  }
  return min;
}

function resolveColorLegendFormat(input: {
  domain: readonly [number, number];
  temporalKind: TemporalKind | null;
  transform?: "identity" | "log10" | "sqrt";
  config: Pick<ColorScaleSpec, "labels" | "timezone" | "transform"> | undefined;
  name: string;
  warnings: PipelineWarning[];
  /** When set (binned legends), use bin width for decimals instead of axis tickStep. */
  formatStep?: number;
}): ColorLegendFormatter {
  const { domain, temporalKind, config, name, warnings } = input;
  const transform = input.transform ?? config?.transform ?? "identity";
  const labelFormat = config?.labels;
  if (temporalKind !== null) return resolveTemporalFormat(input, temporalKind, labelFormat);

  // Log colorbars use decade ticks; linear span precision labels sub-unit
  // powers (0.001, 0.01, 0.1) as "0". Derive decimals from the domain floor.
  // ECMA-402 caps maximumFractionDigits at 20 — extreme domains (e.g. 1e-300)
  // use exponential labels instead of throwing RangeError.
  const MAX_LOCALE_FRACTION_DIGITS = 20;
  let label: (value: number) => string;
  if (transform === "log10" && labelFormat === undefined) {
    const positives = domain.filter((value) => Number.isFinite(value) && value > 0);
    const minAbs = positives.length > 0 ? Math.min(...positives) : 1;
    const decimals = minAbs < 1 ? Math.max(0, Math.ceil(-Math.log10(minAbs))) : 0;
    label = (value: number) => {
      if (!Number.isFinite(value)) return String(value);
      if (decimals === 0) return defaultTickFormat(tickStep(domain[0], domain[1], 5))(value);
      if (decimals > MAX_LOCALE_FRACTION_DIGITS) {
        return value.toExponential(2);
      }
      return value.toLocaleString("en-US", {
        maximumFractionDigits: decimals,
        minimumFractionDigits: 0,
      });
    };
  } else {
    const step =
      input.formatStep !== undefined && Number.isFinite(input.formatStep) && input.formatStep > 0
        ? input.formatStep
        : tickStep(domain[0], domain[1], 5);
    label = defaultTickFormat(step);
  }
  if (labelFormat !== undefined) {
    const formatter = numberFormatter(labelFormat);
    if (formatter.ok) {
      label = (value: number) => formatter.format(value);
    } else {
      warnings.push({
        code: "invalid-label-format",
        message: `Unrecognized labels format "${labelFormat}" on scales.${name}; using the default.`,
      });
    }
  }
  return { label, fullLabel: label };
}

function resolveTemporalFormat(
  input: Parameters<typeof resolveColorLegendFormat>[0],
  temporalKind: TemporalKind,
  labelFormat: string | undefined,
): ColorLegendFormatter {
  const { config, name, warnings } = input;
  const options = {
    kind: temporalKind,
    ...(config?.timezone !== undefined && { timezone: config.timezone }),
  };
  const compile = getTemporalRuntime()?.compileLabelFormat;
  const fullLabel =
    compile === undefined
      ? defaultTimeTickFormat
      : compile(temporalKind === "date" ? "%Y-%m-%d" : "%Y-%m-%d %H:%M:%S %Z", options);
  if (labelFormat !== undefined && compile !== undefined) {
    try {
      return { label: compile(labelFormat, options), fullLabel };
    } catch {
      input.warnings.push({
        code: "invalid-label-format",
        message: `Unrecognized labels format "${labelFormat}" on scales.${name}; using the default.`,
      });
    }
  } else if (labelFormat !== undefined) {
    warnings.push({
      code: "invalid-label-format",
      message: `Temporal labels format on scales.${name} requires @ggts-sh/core/temporal (or the full package); using the default.`,
    });
  }
  const label =
    config?.timezone === undefined || compile === undefined
      ? defaultTimeTickFormat
      : compile(temporalKind === "date" ? "%Y-%m-%d" : "%Y-%m-%d %H:%M", options);
  return { label, fullLabel };
}

export function resolveStyleLegendFormat(input: {
  domain: readonly [number, number];
  temporalKind: TemporalKind | null;
  config: { labels?: string; timezone?: string } | undefined;
  name: string;
  warnings: PipelineWarning[];
  formatStep?: number;
}): ColorLegendFormatter {
  return resolveColorLegendFormat(input);
}

export function resolveSequentialLegendFormat(
  scale: SequentialColorScale,
  config: ColorScaleSpec | undefined,
  name: "color" | "fill",
  warnings: PipelineWarning[],
): ColorLegendFormatter {
  return resolveColorLegendFormat({
    domain: scale.domain,
    temporalKind: scale.temporalKind ?? null,
    transform: scale.transform,
    config,
    name,
    warnings,
  });
}

export function resolveBinnedLegendFormat(input: {
  domain: readonly [number, number];
  temporalKind: TemporalKind | null;
  config: ColorScaleSpec;
  name: "color" | "fill";
  warnings: PipelineWarning[];
  formatStep?: number;
}): ColorLegendFormatter {
  return resolveColorLegendFormat(input);
}
