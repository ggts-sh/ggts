/**
 * Temporal axis interval candidates: automatic ladder, exact interval, and
 * explicit breaks — scoring and evaluation for planTemporalAxis.
 */
import {
  MAX_TEMPORAL_MAJOR_TICKS,
  MIN_TEMPORAL_LABEL_GAP_PX,
  parseTemporalInterval,
  temporalIntervalTicks,
  type TemporalInterval,
} from "@ggts-sh/spec";

import { neighbourOverlap } from "./axis-overlap.js";
import { formatTemporalTickSequence, formatTime } from "./format.js";
import type { AxisGuideTick } from "./guide-plan-types.js";
import type { TemporalAxisPlanInput, TemporalCandidateEvaluation } from "./temporal-axis-types.js";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30.44 * DAY;
const YEAR = 365.25 * DAY;

const AUTOMATIC_INTERVALS: readonly TemporalInterval[] = [
  ...[1, 2, 5, 10, 20, 50, 100, 200, 500].map((step) => interval("millisecond", step)),
  ...[1, 2, 5, 10, 15, 30].map((step) => interval("second", step)),
  ...[1, 2, 5, 10, 15, 30].map((step) => interval("minute", step)),
  ...[1, 2, 3, 6, 12].map((step) => interval("hour", step)),
  ...[1, 2].map((step) => interval("day", step)),
  ...[1, 2].map((step) => interval("week", step)),
  ...[1, 2, 3, 6].map((step) => interval("month", step)),
  ...[1, 2].map((step) => interval("quarter", step)),
  ...[1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000].map((step) =>
    interval("year", step),
  ),
];

function interval(unit: TemporalInterval["unit"], step: number): TemporalInterval {
  return { unit, step, key: `${String(step)} ${unit}${step === 1 ? "" : "s"}` };
}

function intervalApproxMs(value: TemporalInterval): number {
  const unit = {
    millisecond: 1,
    second: SECOND,
    minute: MINUTE,
    hour: HOUR,
    day: DAY,
    week: WEEK,
    month: MONTH,
    quarter: 3 * MONTH,
    year: YEAR,
  }[value.unit];
  return unit * value.step;
}

export function temporalOptions(input: TemporalAxisPlanInput) {
  return {
    kind: input.kind,
    locale: input.config.locale ?? "en-US",
    timezone:
      input.kind === "date" || input.kind === "time" || input.kind === "monthDay"
        ? "UTC"
        : (input.config.timezone ?? "UTC"),
    weekStart: input.config.weekStart ?? "monday",
    ...(input.config.disambiguation !== undefined && {
      disambiguation: input.config.disambiguation,
    }),
  };
}

function buildTicks(
  values: readonly number[],
  intervalValue: TemporalInterval,
  input: TemporalAxisPlanInput,
): AxisGuideTick[] {
  // Visible labels are span-uniform (#962). Reverse still formats in visual
  // order so measurement matches what the reader sees left-to-right / top-to-bottom;
  // the format itself no longer depends on neighbour context.
  const formatOrder = input.reverse ? values.toReversed() : values;
  const formatted = formatTemporalTickSequence(formatOrder, {
    ...temporalOptions(input),
    interval: intervalValue,
    ...(input.config.dateLabels !== undefined && { pattern: input.config.dateLabels }),
  });
  const labels = input.reverse ? formatted.toReversed() : formatted;
  if (input.config.dateLabels === undefined && input.config.labels !== undefined) {
    for (let index = 0; index < labels.length; index++) {
      labels[index] = {
        ...labels[index]!,
        label: formatTime(values[index]!, input.config.labels),
      };
    }
  }
  return values.map((value, index) => ({
    value,
    label: labels[index]!.label,
    fullLabel: labels[index]!.fullLabel,
    kind: "major" as const,
  }));
}

function evaluateTicks(
  ticks: readonly AxisGuideTick[],
  input: TemporalAxisPlanInput,
): { overlap: boolean; marginOverflow: boolean } {
  if (ticks.length === 0) return { overlap: false, marginOverflow: false };
  const [min, max] = input.domain;
  const span = max - min;
  const projected = ticks
    .map((tick) => {
      const value = tick.value as number;
      const fraction = span === 0 ? 0.5 : (value - min) / span;
      const pos = (input.reverse ? 1 - fraction : fraction) * input.extentPx;
      return {
        pos,
        width: input.measurer.measureWidth(tick.label, input.fontSize),
        height: input.measurer.measureHeight(input.fontSize),
      };
    })
    .toSorted((left, right) => left.pos - right.pos);

  // projected is already sorted by pos above — skip re-sort in neighbourOverlap.
  const overlap = neighbourOverlap(
    projected.map((tick) => ({
      pos: tick.pos,
      half: input.orient === "horizontal" ? tick.width / 2 : tick.height / 2,
    })),
    MIN_TEMPORAL_LABEL_GAP_PX,
    { alreadySorted: true },
  );
  // Layout reserves tickLength + tickLabelGap (defaults 6 + 3) in addition to the
  // label extent. Match that chrome so near-cap labels still diagnose overflow.
  const tickChromePx = 6 + 3;
  const orthogonalCap = input.orthogonalMarginCapPx ?? input.marginCapPx;
  const marginOverflow = projected.some((tick) =>
    input.orient === "horizontal"
      ? tick.width / 2 > input.marginCapPx || tick.height + tickChromePx > orthogonalCap
      : tick.width + tickChromePx > input.marginCapPx || tick.height / 2 > orthogonalCap,
  );
  return { overlap, marginOverflow };
}

function evaluateCandidate(
  intervalValue: TemporalInterval,
  input: TemporalAxisPlanInput,
): TemporalCandidateEvaluation | null {
  try {
    const values = temporalIntervalTicks(input.domain[0], input.domain[1], intervalValue, {
      ...temporalOptions(input),
      maxTicks: MAX_TEMPORAL_MAJOR_TICKS,
    });
    if (values.length === 0) return null;
    const ticks = buildTicks(values, intervalValue, input);
    const measured = evaluateTicks(ticks, input);
    return {
      interval: intervalValue,
      ticks,
      ...measured,
      count: ticks.length,
      approxMs: intervalApproxMs(intervalValue),
    };
  } catch {
    return null;
  }
}

function candidateScore(
  candidate: TemporalCandidateEvaluation,
): readonly [number, number, number, number, string] {
  const countPenalty =
    candidate.count >= 3 && candidate.count <= 7
      ? Math.abs(candidate.count - 5)
      : 10 + Math.min(Math.abs(candidate.count - 3), Math.abs(candidate.count - 7));
  return [
    candidate.overlap ? 1 : 0,
    candidate.marginOverflow ? 1 : 0,
    countPenalty,
    -candidate.approxMs,
    candidate.interval.key,
  ];
}

function compareScore(
  left: TemporalCandidateEvaluation,
  right: TemporalCandidateEvaluation,
): number {
  const a = candidateScore(left);
  const b = candidateScore(right);
  for (let index = 0; index < a.length; index++) {
    const av = a[index]!;
    const bv = b[index]!;
    if (av === bv) continue;
    return av < bv ? -1 : 1;
  }
  return 0;
}

export function automaticCandidate(input: TemporalAxisPlanInput): TemporalCandidateEvaluation {
  const intervalPool =
    input.kind === "date"
      ? AUTOMATIC_INTERVALS.filter((candidate) =>
          ["day", "week", "month", "quarter", "year"].includes(candidate.unit),
        )
      : input.kind === "time"
        ? AUTOMATIC_INTERVALS.filter((candidate) =>
            ["millisecond", "second", "minute", "hour"].includes(candidate.unit),
          )
        : // A yearless axis holds one year, so a year tick is the same tick
          // twice. A week tick is worse than useless: it implies a weekday, and
          // the weekday belongs to the reference year rather than to the data.
          // Below a day there is nothing left to resolve.
          input.kind === "monthDay"
          ? AUTOMATIC_INTERVALS.filter((candidate) =>
              ["day", "month", "quarter"].includes(candidate.unit),
            )
          : AUTOMATIC_INTERVALS;
  const span = Math.max(1, input.domain[1] - input.domain[0]);
  const previousApprox =
    input.previousInterval === undefined || input.previousInterval === null
      ? null
      : intervalApproxMs(parseTemporalInterval(input.previousInterval));
  const lowerApprox = previousApprox ?? span / 12;
  const upperApprox = Math.max(lowerApprox, span * 1.1);
  const evaluatePool = (pool: readonly TemporalInterval[]) =>
    pool
      .map((candidate) => evaluateCandidate(candidate, input))
      .filter((candidate): candidate is TemporalCandidateEvaluation => candidate !== null)
      .toSorted(
        (left, right) =>
          left.approxMs - right.approxMs ||
          (left.interval.key < right.interval.key
            ? -1
            : left.interval.key > right.interval.key
              ? 1
              : 0),
      );
  const primary = evaluatePool(
    intervalPool.filter((candidate) => {
      const approx = intervalApproxMs(candidate);
      return approx >= lowerApprox && approx <= upperApprox;
    }),
  );
  const coarser = () =>
    evaluatePool(intervalPool.filter((candidate) => intervalApproxMs(candidate) > upperApprox));
  const candidates = primary.length > 0 ? primary : coarser();
  if (candidates.length === 0) {
    const fallback = interval("year", 1);
    return {
      interval: fallback,
      ticks: [],
      overlap: false,
      marginOverflow: false,
      count: 0,
      approxMs: YEAR,
    };
  }

  if (input.previousInterval !== undefined && input.previousInterval !== null) {
    const previous = parseTemporalInterval(input.previousInterval);
    const retained = candidates.find((candidate) => candidate.interval.key === previous.key);
    if (retained !== undefined && !retained.overlap) return retained;
    const fallbackLadder = [...candidates, ...coarser()];
    return fallbackLadder.find((candidate) => !candidate.overlap) ?? fallbackLadder.at(-1)!;
  }
  const fitting = candidates.filter((candidate) => !candidate.overlap);
  if (fitting.length > 0) return fitting.toSorted(compareScore)[0]!;
  const fallbackLadder = [...candidates, ...coarser()];
  return fallbackLadder.find((candidate) => !candidate.overlap) ?? fallbackLadder.at(-1)!;
}

export function exactCandidate(input: TemporalAxisPlanInput): TemporalCandidateEvaluation {
  const intervalValue = parseTemporalInterval(input.config.dateBreaks!);
  const values = temporalIntervalTicks(input.domain[0], input.domain[1], intervalValue, {
    ...temporalOptions(input),
    maxTicks: MAX_TEMPORAL_MAJOR_TICKS,
  });
  const ticks = buildTicks(values, intervalValue, input);
  return {
    interval: intervalValue,
    ticks,
    ...evaluateTicks(ticks, input),
    count: ticks.length,
    approxMs: intervalApproxMs(intervalValue),
  };
}

export function explicitCandidate(input: TemporalAxisPlanInput): TemporalCandidateEvaluation {
  const values = (input.breaks ?? []).filter(
    (value) => Number.isFinite(value) && value >= input.domain[0] && value <= input.domain[1],
  );
  const intervalValue = inferExplicitInterval(values);
  const ticks = buildTicks(values, intervalValue, input);
  return {
    interval: intervalValue,
    ticks,
    ...evaluateTicks(ticks, input),
    count: ticks.length,
    approxMs: intervalApproxMs(intervalValue),
  };
}

function inferExplicitInterval(values: readonly number[]): TemporalInterval {
  const ordered = [...new Set(values)].toSorted((left, right) => left - right);
  if (ordered.length < 2) return interval("year", 1);
  let gap = Number.POSITIVE_INFINITY;
  for (let index = 1; index < ordered.length; index++) {
    gap = Math.min(gap, ordered[index]! - ordered[index - 1]!);
  }
  if (gap >= YEAR) return interval("year", Math.max(1, Math.round(gap / YEAR)));
  if (gap >= MONTH) return interval("month", Math.max(1, Math.round(gap / MONTH)));
  if (gap >= DAY) return interval("day", Math.max(1, Math.round(gap / DAY)));
  if (gap >= HOUR) return interval("hour", Math.max(1, Math.round(gap / HOUR)));
  if (gap >= MINUTE) return interval("minute", Math.max(1, Math.round(gap / MINUTE)));
  if (gap >= SECOND) return interval("second", Math.max(1, Math.round(gap / SECOND)));
  return interval("millisecond", Math.max(1, Math.round(gap)));
}
