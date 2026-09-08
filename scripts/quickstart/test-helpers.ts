/**
 * Shared helpers for the sakura-lesson test split.
 *
 * Each test file folds its own cloned Kyoto rows (no cross-file shared
 * mutation) and runs registration once, here at import time, before its
 * first headless render.
 */

import { registerAll } from "@ggsvelte/core";

import { kyotoSakura } from "../../packages/core/src/data/index.ts";

// Headless full-grammar rendering (#1420): explicit opt-in.
registerAll();

/** A fresh clone of the Kyoto series — one per test file, never shared. */
export function makeRows() {
  return kyotoSakura.map((row) => ({ ...row }));
}
