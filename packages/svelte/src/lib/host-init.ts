import { registerBasic } from "@ggts-sh/core";

// Default-entry registration contract (#1420): basic geoms, stats, color and
// style scale kinds, so identity charts work with no setup. Temporal scale
// children self-register full temporal support; spec-driven apps call
// registerAll(). The lean entry (`@ggts-sh/svelte/lean`) skips this call.
// A call (not the /render side effect) keeps one @ggts-sh/core entry in
// dev-server prebundles — a /render + barrel split would fork the registries.
registerBasic();
