/**
 * Layout/scene assembly helpers used by runPipeline: domain projection,
 * tick formatters, margin max, and warning/advisory dedupe.
 */
import type { PositionScaleSpec, TemporalPrecision, TemporalScaleKind } from "@ggts-sh/spec";

import type {
  BandLayoutDomainContext,
  Domain,
  LayoutResult,
  Margins,
  TemporalLayoutDomainContext,
  TickFormatter,
} from "../layout/layout.js";
import { formatTime } from "../layout/format-time.js";
import { numberFormatter } from "../layout/format-number.js";
import { getTemporalRuntime } from "../temporal-runtime.js";
import { defaultTickFormat, tickStep } from "../layout/ticks.js";
import { defaultLogTickFormat } from "../layout/ticks.js";
import { defaultTimeTickFormat } from "../layout/time.js";
import { encodeKey } from "../scales/state.js";
import type { PositionScale } from "../scales/train.js";
import type { CellValue } from "../table.js";
import { cellToNumber } from "../table.js";
import type { SceneTick } from "../scene.js";

import type { Advisory, AxisValueFormatter, PipelineWarning } from "./types.js";

export const TITLE_BAND = 22;
export const SUBTITLE_BAND = 16;
export const CAPTION_BAND = 14;
export const AXIS_TITLE_BAND = 18;
export const LEGEND_GAP = 12;
export const LEGEND_EDGE_PAD = 2;

export function layoutDomain(
  scale: PositionScale,
  breaks: readonly (number | string)[] | undefined,
  temporal?: TemporalLayoutDomainContext,
  band?: BandLayoutDomainContext,
): Domain {
  if (scale.type === "band") {
    return {
      type: "band",
      categories: [...scale.domain],
      rawCategories: scale.rawDomain,
      ...(breaks !== undefined && {
        // First-occurrence dedupe by encodeKey (O(K)), not nested findIndex (O(K²)).
        breaks: (() => {
          const seen = new Set<string>();
          const unique: (string | number)[] = [];
          for (const value of breaks) {
            const key = encodeKey(value);
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(value);
          }
          return unique;
        })(),
      }),
      ...(band !== undefined && { band }),
    };
  }
  const numericBreaks =
    breaks === undefined
      ? undefined
      : breaks.map((b) => cellToNumber(b as CellValue)).filter((v) => Number.isFinite(v));
  if (scale.type === "time") {
    return {
      type: "time",
      min: scale.domain[0],
      max: scale.domain[1],
      ...(numericBreaks !== undefined && { breaks: numericBreaks }),
      ...(temporal !== undefined && { temporal }),
    };
  }
  return {
    type: "linear",
    transform: scale.transform,
    min: scale.domain[0],
    max: scale.domain[1],
    ...(numericBreaks !== undefined && { breaks: numericBreaks }),
  };
}

/**
 * Default strftime pattern for tooltip / crosshair axis values.
 *
 * Patterns track the **channel unit** (column precision), not tick spacing.
 * Year data labels as years even when a cursor sits between year ticks;
 * day data still gets full calendar dates.
 */
function defaultTemporalAxisPattern(
  kind: TemporalScaleKind,
  precision: TemporalPrecision | null | undefined,
  options?: { lean?: boolean },
): string {
  const lean = options?.lean === true;
  if (kind === "monthDay") return "%b %e";
  if (kind === "time") {
    return (
      ({ millisecond: "%H:%M:%S.%L", minute: "%H:%M" } as Record<string, string>)[
        precision ?? ""
      ] ?? "%H:%M:%S"
    );
  }
  if (precision === "year") return "%Y";
  if (precision === "quarter") return lean ? "%Y-%m" : "%Y-Q%q";
  if (precision === "month") return "%Y-%m";
  if (precision === "date" || kind === "date") return "%Y-%m-%d";
  const suffix =
    precision === "minute" ? "%H:%M" : precision === "millisecond" ? "%H:%M:%S.%L" : "%H:%M:%S";
  return lean ? `%Y-%m-%d ${suffix}` : `%Y-%m-%d ${suffix} %Z`;
}

function warnUnusedScaleOptions(
  axis: "x" | "y",
  config: PositionScaleSpec | undefined,
  warnings: PipelineWarning[],
): void {
  const options: [unknown, unknown, string, string][] = [
    [config?.breaks, config?.dateBreaks, "breaks", "dateBreaks"],
    [config?.labels, config?.dateLabels, "labels", "dateLabels"],
    [config?.dateMinorBreaks, config?.minorBreaks, "dateMinorBreaks", "minorBreaks"],
  ];
  for (const [primary, legacy, primaryName, legacyName] of options) {
    if (primary !== undefined && legacy !== undefined) {
      warnings.push({
        code: "unused-scale-option",
        message: `scales.${axis}.${primaryName} takes precedence; ${legacyName} is ignored.`,
      });
    }
  }
}

function defaultAxisFormatter(
  scale: PositionScale,
  config: PositionScaleSpec | undefined,
  kind: TemporalScaleKind,
  precision: TemporalPrecision | null | undefined,
): TickFormatter | undefined {
  if (scale.type !== "time") return undefined;
  const compile = getTemporalRuntime()?.compileLabelFormat;
  const pattern = defaultTemporalAxisPattern(kind, precision, { lean: compile === undefined });
  if (compile === undefined) return (value) => formatTime(value as number, pattern);
  const format = compile(pattern, {
    kind,
    locale: config?.locale ?? "en-US",
    timezone: config?.timezone ?? "UTC",
  });
  return (value) => format(value as number);
}

export function makeAxisFormatter(
  axis: "x" | "y",
  scale: PositionScale,
  config: PositionScaleSpec | undefined,
  warnings: PipelineWarning[],
  resolvedTemporalKind?: TemporalScaleKind | null,
  resolvedTemporalPrecision?: TemporalPrecision | null,
): TickFormatter | undefined {
  warnUnusedScaleOptions(axis, config, warnings);
  const labels = config?.dateLabels ?? config?.labels;
  if (labels === undefined) {
    const kind = resolvedTemporalKind ?? config?.temporalKind ?? "datetime";
    return defaultAxisFormatter(scale, config, kind, resolvedTemporalPrecision);
  }
  if (scale.type === "band") {
    warnings.push({
      code: "invalid-label-format",
      message: `scales.${axis}.labels format strings apply to continuous scales; the band ${axis} scale ignores it.`,
    });
    return undefined;
  }
  if (scale.type === "time") {
    if (config?.dateLabels !== undefined) {
      const compile = getTemporalRuntime()?.compileLabelFormat;
      if (compile === undefined) {
        return (value) => formatTime(value as number, labels);
      }
      const format = compile(config.dateLabels, {
        kind: resolvedTemporalKind ?? config.temporalKind ?? "datetime",
        locale: config.locale ?? "en-US",
        timezone: config.timezone ?? "UTC",
      });
      return (value) => format(value as number);
    }
    return (value) => formatTime(value as number, labels);
  }
  const f = numberFormatter(labels);
  if (!f.ok) {
    warnings.push({
      code: "invalid-label-format",
      message: `Unrecognized labels format "${labels}" on scales.${axis}; using the default.`,
    });
    return undefined;
  }
  return (value) => f.format(value as number);
}

export function makeAxisValueFormatter(
  scale: PositionScale,
  custom: TickFormatter | undefined,
  valueToNumber?: (value: CellValue) => number,
): AxisValueFormatter {
  if (scale.type === "band") return (value) => (value === null ? "–" : String(value));
  const fallback =
    scale.type === "time"
      ? defaultTimeTickFormat
      : scale.transform === "log10"
        ? defaultLogTickFormat
        : defaultTickFormat(tickStep(scale.domain[0], scale.domain[1], 5));
  return (value) => {
    if (value === null) return "–";
    const numeric = valueToNumber?.(value) ?? cellToNumber(value);
    return custom === undefined ? fallback(numeric) : custom(numeric, NaN);
  };
}

export function axisTicks(
  scale: PositionScale,
  ticks: LayoutResult["x"]["ticks"],
  extent: number,
  fromEnd: boolean,
): SceneTick[] {
  const out: SceneTick[] = [];
  for (let index = 0; index < ticks.length; index++) {
    const tick = ticks[index]!;
    // Band ticks carry their typed domain position because explicit breaks
    // may filter or reorder presentation ticks independently of the domain.
    const semanticValue =
      scale.type === "band"
        ? tick.domainIndex === undefined
          ? index < scale.rawDomain.length
            ? scale.rawDomain[index]
            : tick.value
          : scale.rawDomain[tick.domainIndex]
        : tick.value;
    const t =
      scale.type === "band"
        ? scale.normalize(semanticValue)
        : scale.normalize(tick.value as number);
    if (t === undefined || Number.isNaN(t)) continue;
    const pos = fromEnd ? extent - t * extent : t * extent;
    out.push({
      pos,
      value: semanticValue as CellValue,
      label: tick.labeled ? tick.label : "",
      fullLabel: tick.fullLabel ?? tick.label,
      kind: tick.kind ?? "major",
      ...(tick.lines !== undefined && { lines: tick.lines }),
      ...(tick.angle !== undefined && { angle: tick.angle }),
    });
  }
  return out;
}

export function dedupeWarnings(list: PipelineWarning[]): PipelineWarning[] {
  const seen = new Set<string>();
  return list.filter((w) => {
    const key = `${w.code} ${w.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function dedupeAdvisories(list: Advisory[]): Advisory[] {
  const seen = new Set<string>();
  return list.filter((a) => {
    const key = `${a.code} ${a.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const elementwiseMaxMargins = (a: Margins, b: Margins): Margins => ({
  top: Math.max(a.top, b.top),
  right: Math.max(a.right, b.right),
  bottom: Math.max(a.bottom, b.bottom),
  left: Math.max(a.left, b.left),
});

export function scaleDomainSnapshot(scale: PositionScale): readonly CellValue[] {
  return Object.freeze([...scale.domain]);
}
