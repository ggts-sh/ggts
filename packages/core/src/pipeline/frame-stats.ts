/**
 * Non-identity stat branches for LayerFrame construction.
 * Returns null for identity so the caller can fall through.
 *
 * Builders are registered by {@link registerAllStatFrames} (full package) or
 * left empty on the lean `@ggts-sh/core/render` entry so identity charts do
 * not pull loess/density/sf modules into the client graph.
 */
import type { ColumnTable } from "../table.js";

import { getStatFrameBuilder } from "./frame-stats-registry.js";
import { isBasicRegisterHint, statRegisterHint } from "./register-hints.js";
import type { Advisory, LayerBinding, LayerFrame, PipelineWarning } from "./types.js";
import { PipelineError } from "./types.js";

export function buildNonIdentityFrame(
  binding: LayerBinding,
  table: ColumnTable,
  groups: readonly number[],
  warnings: PipelineWarning[],
  advisories: Advisory[],
  binRange?: [number, number],
  functionDomain?: [number, number],
): LayerFrame | null {
  const stat = binding.layer.stat ?? "identity";
  if (stat === "identity") return null;

  const build = getStatFrameBuilder(stat);
  if (build === undefined) {
    const path = `/layers/${String(binding.index)}/stat`;
    const family = statRegisterHint(stat);
    const fix =
      family === undefined
        ? `Call registerAll() (full grammar) or registerBasic() (identity charts) from @ggts-sh/core, render the stat's default <Geom*> component (it self-registers), or call registerStatFrame("${stat}", …).`
        : isBasicRegisterHint(family)
          ? `Call ${family}() from @ggts-sh/core/headless/register once at startup, or registerAll() from @ggts-sh/core (full grammar). Low-level: registerStatFrame("${stat}", …).`
          : `Call ${family}() once at startup (exported from @ggts-sh/svelte and @ggts-sh/core) or registerAll() (full grammar). A <Geom*> component self-registers only its default stat, so a stat override needs the family call. Low-level: registerStatFrame("${stat}", …).`;
    throw new PipelineError(
      "unsupported-param",
      path,
      `Stat "${stat}" is not registered in this build. ${fix}`,
    );
  }
  return build(binding, table, groups, warnings, advisories, binRange, functionDomain);
}
