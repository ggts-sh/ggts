/**
 * Explicit registration entry points (#1420).
 *
 * The `@ggts-sh/core` barrel is side-effect-free: importing it registers no
 * stat frames, no geom batches, and no Temporal runtime. Callers opt in:
 *
 *   - `registerBasic()` — identity-chart geoms/stats (scatter, line, bar,
 *     area, …) plus every color and style scale kind and the band-axis
 *     planner. Same tier `@ggts-sh/core/render` installs on import.
 *   - `registerAll()` — the full grammar (every stat frame + geom batch) plus
 *     the Temporal polyfill parse path and the interaction-candidate runtime
 *     (#1421). One-call migration path for apps that relied on the pre-#1420
 *     auto-registering barrel.
 *   - Per-family `register<Family>()` functions (see pipeline/register-*.ts)
 *     for granular opt-in.
 *
 * All registration is idempotent.
 *
 * @lifecycle experimental
 */
import { installCandidates } from "./install-candidates.js";
import { installTemporal } from "./install-temporal.js";
import { registerBasicStatFrames } from "./pipeline/frame-stats-register-basic.js";
import { registerAllStatFrames } from "./pipeline/frame-stats-register-all.js";
import { registerBasicGeomBatches } from "./pipeline/geometry-register-basic.js";
import { registerAllGeomBatches } from "./pipeline/geometry-register-all.js";
import { registerAllColorKinds } from "./pipeline/register-color-all.js";
import { registerAllStyleKinds } from "./pipeline/register-style-all.js";
import { registerBandGuide } from "./layout/register-band-guide.js";

/** Register basic geom batches + basic stat frames (identity charts). */
export function registerBasic(): void {
  registerBasicStatFrames();
  registerBasicGeomBatches();
  registerAllColorKinds();
  registerAllStyleKinds();
  registerBandGuide();
}

/** Register every stat frame + geom batch; install Temporal + candidates. */
export function registerAll(): void {
  registerAllStatFrames();
  registerAllGeomBatches();
  registerAllColorKinds();
  registerAllStyleKinds();
  registerBandGuide();
  installTemporal();
  installCandidates();
}
