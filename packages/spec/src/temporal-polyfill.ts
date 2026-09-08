/**
 * Sole module that statically imports `@js-temporal/polyfill`.
 *
 * Lean chart graphs (`@ggts-sh/core/render` + `@ggts-sh/spec/portable`) must
 * never import this file — identity / numeric charts then keep Temporal out of
 * the client bundle. Full temporal paths call {@link ensureTemporalPolyfill}
 * (via `installTemporal` / agent `validate()`) before parsing non-UTC zones.
 *
 * Lifecycle (Hadley lesson 13; meanings in CONTRIBUTING.md): tags collected
 * into lifecycle.json by scripts/gen-lifecycle.ts.
 */
// @lifecycle-default experimental
import { Temporal as PolyfillTemporal } from "@js-temporal/polyfill";

import { registerTemporalPolyfill } from "./temporal-parse-core.js";

let ensured = false;

/** Register the package polyfill when native `globalThis.Temporal` is absent. Idempotent. */
export function ensureTemporalPolyfill(): void {
  if (ensured) return;
  ensured = true;
  registerTemporalPolyfill(PolyfillTemporal);
}

// Side-effect for direct importers of this module (tests / explicit installs).
ensureTemporalPolyfill();
