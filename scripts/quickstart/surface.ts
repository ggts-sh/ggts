/**
 * Agent-surface fragments derived from the sakura lesson fold.
 *
 * Shared by /guide/getting-started markdown and /llms.txt so install, complete
 * file, PortableSpec, and headless/CLI snippets cannot drift from the fold.
 */

import type { PortableSpec } from "@ggsvelte/spec";

import { foldSakura } from "./fold";
import { SAKURA_STEPS, SAKURA_TREND_WINDOW } from "./steps";

// --- the agent surface -----------------------------------------------------

export const QUICKSTART_BUILDER_FRAGMENT = `import { aes, gg } from "@ggsvelte/svelte";
import { kyotoSakura } from "@ggsvelte/core/data";

const spec = gg(kyotoSakura, aes({ x: "year", y: "bloomDate" }))
  .geomPoint()
  .geomLine({
    stat: "summary_rolling",
    fun: "median",
    window: ${SAKURA_TREND_WINDOW},
    curve: "linear",
  })
  .spec();`;

/**
 * Finished lesson chart as PortableSpec JSON for agents.
 *
 * Derived from `foldSakura(SAKURA_STEPS.length)` so layers, scales, theme, and
 * guides cannot drift from the finished Svelte file or the live chart. Plot
 * data is a named ref (`kyotoSakura`) — hosts resolve it from
 * `@ggsvelte/core/data`. Small annotation tables (epochs, records) stay as
 * inline `values` because they are chart decoration, not the 838-row series.
 * `key` and `<Inspect>` are host-only; not PortableSpec fields.
 */
export function finishedPortableSpecNamed(): PortableSpec {
  const { spec } = foldSakura(SAKURA_STEPS.length);
  return {
    ...spec,
    data: { name: "kyotoSakura" },
  };
}

/**
 * Pretty-printed finished PortableSpec. Same object as
 * {@link finishedPortableSpecNamed} — string form for copy blocks / llms.
 */
export const QUICKSTART_PORTABLE_SPEC_FRAGMENT = `${JSON.stringify(
  finishedPortableSpecNamed(),
  null,
  2,
)}\n`;

export const QUICKSTART_HEADLESS_FRAGMENT = `import { registerAll, renderToSVGString } from "@ggsvelte/core";

// Headless/spec-driven rendering opts into the full grammar explicitly (#1420).
registerAll();
const svg = renderToSVGString(spec, { width: 900, height: 360 });`;

export const QUICKSTART_CLI_FRAGMENT = "ggts render spec.json > chart.svg 2> diagnostics.jsonl";
