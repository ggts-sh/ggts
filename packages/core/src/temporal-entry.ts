/**
 * Temporal entry (`@ggts-sh/core/temporal`).
 *
 * Installs the Temporal polyfill parse path and temporal axis planner, then
 * re-exports guide helpers for apps that started from `@ggts-sh/core/render`
 * and later need time scales.
 *
 * Lifecycle (Hadley lesson 13; meanings in CONTRIBUTING.md): tags collected
 * into lifecycle.json by scripts/gen-lifecycle.ts.
 */
// @lifecycle-default experimental
import { installTemporal } from "./install-temporal.js";

// Side-effect contract of this subpath: importing `@ggts-sh/core/temporal`
// installs the Temporal polyfill parse path + guide planner.
installTemporal();

export { installTemporal } from "./install-temporal.js";
export { installTemporalRuntime, getTemporalRuntime } from "./temporal-runtime.js";

export {
  compileTemporalLabelFormat,
  formatTemporalTickSequence,
  formatTime,
} from "./layout/format.js";
export type { TemporalLabelFormatOptions, TemporalTickLabel } from "./layout/format.js";

export { planTemporalAxis } from "./layout/temporal-guide.js";
export type { AxisGuidePlan, TemporalAxisPlanInput } from "./layout/temporal-guide.js";
