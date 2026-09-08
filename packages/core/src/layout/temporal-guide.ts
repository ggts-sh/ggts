/**
 * Temporal axis guide planning and stable re-exports for guide plan types
 * and temporal interval planning. Non-temporal axis assembly lives in
 * `basic-axis.ts` (import `planBasicAxis` from there).
 *
 * Guide plan type contracts live in `guide-plan-types.ts`.
 */
import {
  MAX_TEMPORAL_MINOR_TICKS,
  parseTemporalInterval,
  TemporalIntervalError,
  temporalIntervalTicks,
} from "@ggts-sh/spec";

import {
  automaticCandidate,
  exactCandidate,
  explicitCandidate,
  temporalOptions,
} from "./temporal-axis-candidates.js";
import type { GuideDegradedCode } from "./guide-degraded-codes.js";
import type { AxisGuidePlan, AxisGuideTick } from "./guide-plan-types.js";
import type { TemporalAxisPlanInput, TemporalCandidateEvaluation } from "./temporal-axis-types.js";

export type {
  AxisGuidePlan,
  AxisGuideTick,
  ColorbarGuidePlan,
  ColorbarGuideTick,
  ColorstepsGuidePlan,
  ColorstepsGuideStep,
  DiscreteGuideEntry,
  DiscreteGuidePlan,
  GuidePlan,
} from "./guide-plan-types.js";

export type { TemporalAxisPlanInput } from "./temporal-axis-types.js";

export class TemporalGuideIntervalError extends Error {
  override readonly cause: TemporalIntervalError;

  constructor(
    readonly aesthetic: "x" | "y",
    readonly option: "dateBreaks" | "dateMinorBreaks",
    cause: TemporalIntervalError,
  ) {
    super(cause.message);
    this.name = "TemporalGuideIntervalError";
    this.cause = cause;
  }
}

type TemporalTickSource = "automatic" | "interval" | "explicit";

function selectTemporalCandidate(
  input: TemporalAxisPlanInput,
  source: TemporalTickSource,
): TemporalCandidateEvaluation {
  switch (source) {
    case "automatic":
      return automaticCandidate(input);
    case "interval":
      try {
        return exactCandidate(input);
      } catch (error) {
        if (!(error instanceof TemporalIntervalError)) throw error;
        throw new TemporalGuideIntervalError(input.aesthetic, "dateBreaks", error);
      }
    case "explicit":
      return explicitCandidate(input);
  }
  throw new Error(`Unsupported temporal tick source: ${String(source)}`);
}

function planMinorTicks(
  input: TemporalAxisPlanInput,
  selected: TemporalCandidateEvaluation,
): AxisGuideTick[] {
  if (input.config.dateMinorBreaks === undefined) return [];
  const majorValues = new Set(selected.ticks.map((tick) => tick.value as number));
  const minorInterval = parseTemporalInterval(input.config.dateMinorBreaks);
  try {
    return temporalIntervalTicks(input.domain[0], input.domain[1], minorInterval, {
      ...temporalOptions(input),
      maxTicks: MAX_TEMPORAL_MINOR_TICKS,
    })
      .filter((value) => !majorValues.has(value))
      .map((value) => ({ value, label: "", fullLabel: "", kind: "minor" as const }));
  } catch (error) {
    if (!(error instanceof TemporalIntervalError)) throw error;
    throw new TemporalGuideIntervalError(input.aesthetic, "dateMinorBreaks", error);
  }
}

export function planTemporalAxis(input: TemporalAxisPlanInput): AxisGuidePlan {
  const source: TemporalTickSource =
    input.breaks === undefined
      ? input.config.dateBreaks === undefined
        ? "automatic"
        : "interval"
      : "explicit";
  const selected = selectTemporalCandidate(input, source);
  const minorTicks = planMinorTicks(input, selected);

  const degraded: GuideDegradedCode[] = [
    ...(selected.overlap ? (["temporal-label-overlap"] as const) : []),
    ...(selected.marginOverflow ? (["temporal-label-margin-overflow"] as const) : []),
    ...(source === "explicit" &&
    input.sourceBreaks !== undefined &&
    input.sourceBreaks.length > selected.ticks.length
      ? (["temporal-break-outside-domain"] as const)
      : []),
  ];
  return Object.freeze({
    type: "axis" as const,
    id: `axis:${input.aesthetic}:panel:${String(input.panelIndex)}`,
    aesthetic: input.aesthetic,
    panelIndex: input.panelIndex,
    scaleType: "time" as const,
    transform: "identity" as const,
    temporalKind: input.kind,
    domain: Object.freeze([input.domain[0], input.domain[1]] as const),
    direction: input.reverse ? ("descending" as const) : ("ascending" as const),
    source,
    interval: source === "explicit" ? null : selected.interval.key,
    locale: input.config.locale ?? "en-US",
    timezone:
      input.kind === "date" || input.kind === "time" || input.kind === "monthDay"
        ? "UTC"
        : (input.config.timezone ?? "UTC"),
    ticks: Object.freeze([...selected.ticks, ...minorTicks].map((tick) => Object.freeze(tick))),
    ...(input.sourceBreaks !== undefined && {
      sourceBreaks: Object.freeze([...input.sourceBreaks]),
    }),
    overlap: selected.overlap,
    marginOverflow: selected.marginOverflow,
    degraded: Object.freeze(degraded),
  });
}
