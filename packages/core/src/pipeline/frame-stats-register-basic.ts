/**
 * Basic non-identity stats for `@ggts-sh/core/render` (bar/count, sum).
 * Heavy stats (smooth, density, sf, …) stay on the full package registration.
 */
import { buildCountFrame } from "./frame-stats-count.js";
import { buildSumFrame } from "./frame-stats-sum.js";
import { registerStatFrame } from "./frame-stats-registry.js";

let registered = false;

/** Idempotent: safe to call from registerBasic()/registerAll() more than once. */
export function registerBasicStatFrames(): void {
  if (registered) return;
  registered = true;
  registerStatFrame("count", (binding, table, groups, warnings) =>
    buildCountFrame(binding, table, groups, warnings),
  );
  registerStatFrame("sum", (binding, table, groups, warnings) =>
    buildSumFrame(binding, table, groups, warnings),
  );
}
