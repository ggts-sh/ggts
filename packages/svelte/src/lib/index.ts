// ggts — Svelte 5 adapter (`@ggts-sh/svelte`). Registers the basic grammar on
// import, then re-exports the lean entry (./lean.ts holds the export list).
//
// Lifecycle (Hadley lesson 13; meanings in CONTRIBUTING.md): tags collected
// into lifecycle.json by scripts/gen-lifecycle.ts.
// @lifecycle-default experimental

import "./host-init.js";

export * from "./lean.js";
