/**
 * Side-effect module: wire full Temporal polyfill parsing + axis planning.
 * Imported by the full `@ggts-sh/core` barrel and `@ggts-sh/core/temporal`.
 */
import {
  canonicalTemporalParserKey,
  ensureTemporalPolyfill,
  parseTemporalColumn,
  type TemporalParserSpec,
} from "@ggts-sh/spec";

import { compileTemporalLabelFormat } from "./layout/format-temporal-labels.js";
import type { TemporalLabelFormatOptions } from "./layout/format-temporal-labels.js";
import { planTemporalAxis } from "./layout/temporal-guide.js";
import { getTemporalRuntime, installTemporalRuntime } from "./temporal-runtime.js";
import type { CellValue } from "./table-types.js";

let installed = false;

export function installTemporal(): void {
  // Re-install after test-only runtime clears; skip when already wired.
  if (installed && getTemporalRuntime() !== null) return;
  installed = true;
  // Pull `@js-temporal/polyfill` into this full-core graph only (not lean render).
  ensureTemporalPolyfill();
  installTemporalRuntime({
    parseColumn: (raw: readonly CellValue[], parser: TemporalParserSpec | "auto", options) => {
      const parsed = parseTemporalColumn(raw, parser, {
        ...(options.timezone !== undefined && { timezone: options.timezone }),
        ...(options.disambiguation !== undefined && { disambiguation: options.disambiguation }),
      });
      return {
        decision: parsed.decision,
        semantic: parsed.semantic,
        valid: parsed.valid,
        kind: parsed.decision.kind ?? undefined,
        precision: parsed.decision.precision ?? undefined,
      };
    },
    planAxis: planTemporalAxis,
    parserKey: (parser: TemporalParserSpec) => canonicalTemporalParserKey(parser),
    compileLabelFormat: (pattern, options) =>
      compileTemporalLabelFormat(pattern, options as TemporalLabelFormatOptions),
  });
}
