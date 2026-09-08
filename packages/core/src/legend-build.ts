/**
 * Per-guide legend scene builders (discrete / ramp / steps).
 *
 * Split modules:
 * - legend-build-types.ts — input/output contracts + LegendLayoutError
 * - legend-build-shared.ts — layout metrics, settings, label presentation
 * - legend-build-discrete.ts — categorical builder
 * - legend-build-continuous.ts — ramp + steps builders
 */
import type { TextMeasurer } from "./layout/measure.js";
import type { SceneLegend } from "./scene.js";
import { getContinuousLegendBuilders, getDiscreteLegendBuilder } from "./legend-build-registry.js";
import type { LegendInput, LegendOrder } from "./legend-build-types.js";

export type {
  DiscreteLegendInput,
  LegendBlock,
  LegendInput,
  LegendOrder,
  RampLegendInput,
  ResolvedLegendAppearance,
  StepsLegendInput,
} from "./legend-build-types.js";
export { LegendLayoutError } from "./legend-build-types.js";
export { BLOCK_GAP, disambiguatedLabels, LEGEND_ROW_HEIGHT } from "./legend-build-shared.js";

export function buildForPosition(
  input: LegendInput,
  order: LegendOrder,
  measurer: TextMeasurer,
  maxWidth: number,
  position: "right" | "bottom",
): SceneLegend {
  if (input.kind === "discrete") {
    const build = getDiscreteLegendBuilder();
    if (build === undefined) {
      throw new Error(
        `Discrete legend is not registered in this build. Call registerDiscreteLegend() or registerOrdinalColor() from @ggts-sh/core/headless/register, or registerBasic() from @ggts-sh/core.`,
      );
    }
    return build(input, order, measurer, maxWidth, position);
  }
  const builders = getContinuousLegendBuilders();
  if (builders === undefined) {
    throw new Error(
      `Continuous legend is not registered in this build. Call registerContinuousLegend() or registerSequentialColor() from @ggts-sh/core/headless/register, or registerBasic() from @ggts-sh/core.`,
    );
  }
  if (input.kind === "steps") return builders.steps(input, measurer, maxWidth, position);
  return builders.ramp(input, measurer, maxWidth, position);
}
