/**
 * Continuous positional axis training (linear/log/time) with zero forcing.
 */
import type { PositionScaleSpec } from "@ggts-sh/spec";

import type { ContinuousConfig } from "../scales/train.js";
import { ScaleConfigError, trainContinuous } from "../scales/train.js";

import { emitScaleBreakOutsideDomain } from "./diagnostics-emit.js";
import { axisTransform, resolveScaleExpansion } from "./position-program.js";
import { continuousDomainOf } from "./scale-axis-domain.js";
import type { AxisInputs, AxisTraining } from "./scale-axis-types.js";
import type { Advisory, PipelineWarning } from "./types.js";
import { PipelineError } from "./types.js";
import type { ScaleDiagnostic } from "./types-scale-diagnostics.js";
import { maybeForceZeroForBars } from "./scale-axis-train-continuous-zero.js";
import { pushContinuousTrainingWarnings } from "./scale-axis-train-continuous-warn.js";

/**
 * Documented numeric percent formats from `numberFormatter` (not strftime
 * tokens like `%Y`). Matches `%`, `.0%`, `.1%`, `,.0%`, `~%`, `.1~%`.
 */
const NUMERIC_PERCENT_LABELS = /^(?:,)?(?:\.\d+)?~?%$/;

/**
 * Percent formats (`".0%"`, `"%"`) multiply by 100. Domains far outside
 * proportion space ([0,1] / roughly [-1,1]) print absurd labels like "87300%".
 * Expansion pads ~5%, so a true [0,1] domain stays near 1.05 — threshold 2
 * allows modest overshoot (e.g. 150%) without flagging position:"fill".
 */
function maybePercentLabelsAdvisory(
  axis: "x" | "y",
  config: PositionScaleSpec | undefined,
  domain: readonly [number, number],
  advisories: Advisory[],
): void {
  const labels = config?.labels;
  if (labels === undefined || !NUMERIC_PERCENT_LABELS.test(labels)) return;
  const [lo, hi] = domain;
  const extreme = Math.max(Math.abs(lo), Math.abs(hi));
  if (!Number.isFinite(extreme) || extreme <= 2) return;
  advisories.push({
    code: "percent-labels-out-of-range",
    path: `scales.${axis}`,
    chosen: `labels "${labels}" on domain [${lo}, ${hi}] (extreme |v|=${extreme})`,
    howToOverride: `Percent label formats multiply values by 100. Use proportions in [0, 1] (position: "fill" for parts-of-a-whole), or drop labels / use a non-percent format (".0f", ",d") when the data is already in percent points or counts.`,
  });
}

export function trainContinuousAxis(
  axis: "x" | "y",
  inputs: AxisInputs,
  config: PositionScaleSpec | undefined,
  type: "linear" | "time",
  advisories: Advisory[],
  warnings: PipelineWarning[],
): AxisTraining {
  const scaleDiagnostics: ScaleDiagnostic[] = [];
  const zero = maybeForceZeroForBars(axis, inputs, config, type, advisories, scaleDiagnostics);

  const domain = continuousDomainOf(config, axis);
  const transform = axisTransform(config, type);
  const expansion = resolveScaleExpansion(config?.expand, type === "time");
  const continuousConfig: ContinuousConfig = {
    type,
    transform,
    expansion,
    ...(domain !== undefined && { domain }),
    ...(config?.nice !== undefined && { nice: config.nice }),
    ...(zero !== undefined && { zero }),
    ...(config?.reverse !== undefined && { reverse: config.reverse }),
  };
  let training;
  try {
    training = trainContinuous(inputs.numeric, continuousConfig);
  } catch (error) {
    if (error instanceof ScaleConfigError) {
      throw new PipelineError(error.code, `/scales/${axis}`, error.message);
    }
    throw error;
  }
  pushContinuousTrainingWarnings(axis, training, warnings);
  maybePercentLabelsAdvisory(axis, config, training.scale.domain, advisories);
  // Explicit continuous breaks outside the trained (expanded, ggplot2-correct)
  // display domain are dropped by the layout tick filter. Structured facts
  // project lean + rich channels once (#628) — no post-hoc message parsing.
  if (type !== "time" && config?.breaks !== undefined) {
    const [lo, hi] = training.scale.domain;
    const outside = config.breaks.filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value) && (value < lo || value > hi),
    );
    if (outside.length > 0) {
      const event = emitScaleBreakOutsideDomain(axis, outside, lo, hi);
      warnings.push(event.warning);
      scaleDiagnostics.push(event.diagnostic);
    }
  }
  return { scale: training.scale, advisories, warnings, scaleDiagnostics };
}
