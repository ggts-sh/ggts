/** Temporal parse helpers shared by the color and style value views. */
import type { TemporalParserSpec } from "@ggts-sh/spec";

import type { CellValue } from "../table.js";
import { cellToNumber } from "../table.js";
import { getTemporalRuntime } from "../temporal-runtime.js";

export function runtimeParseColumn(
  values: readonly CellValue[],
  parser: TemporalParserSpec | "auto",
  options: { timezone?: string; disambiguation?: "compatible" | "earlier" | "later" | "reject" },
) {
  const runtime = getTemporalRuntime();
  if (runtime !== null) return runtime.parseColumn(values, parser, options);
  const semantic = new Float64Array(values.length);
  const valid = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const n = cellToNumber(values[i]!);
    semantic[i] = n;
    if (Number.isFinite(n)) valid[i] = 1;
  }
  return {
    decision: {
      status: "nominal" as const,
      parser: null,
      parserKey: "lite",
      kind: null,
      precision: null,
      evidence: [],
      nonNullCount: 0,
      validatedCount: 0,
      failedCount: 0,
      candidates: [],
    },
    semantic,
    valid,
  };
}

export function runtimeParseOne(
  value: CellValue,
  parser: TemporalParserSpec,
  options: { timezone?: string; disambiguation?: "compatible" | "earlier" | "later" | "reject" },
): { ok: true; epochMs: number } | { ok: false } {
  const runtime = getTemporalRuntime();
  if (runtime !== null) {
    const parsed = runtime.parseColumn([value], parser, options);
    if (parsed.valid[0] === 1) return { ok: true, epochMs: parsed.semantic[0]! };
    return { ok: false };
  }
  const n = cellToNumber(value);
  return Number.isFinite(n) ? { ok: true, epochMs: n } : { ok: false };
}

export function temporalParseOptions(
  config:
    | { timezone?: string; disambiguation?: "compatible" | "earlier" | "later" | "reject" }
    | undefined,
) {
  return {
    ...(config?.timezone !== undefined && { timezone: config.timezone }),
    ...(config?.disambiguation !== undefined && { disambiguation: config.disambiguation }),
  };
}
