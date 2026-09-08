/** Semantic numeric view for sequential/binned color and fill scales. */
import type { ColorScaleSpec, TemporalKind, TemporalParserSpec } from "@ggts-sh/spec";

import { encodeKey } from "../scales/state.js";
import type { CellValue } from "../table.js";
import { cellToNumber } from "../table.js";
import { getTemporalRuntime } from "../temporal-runtime.js";

import type { PipelineErrorCode } from "../diagnostics-error-catalog.js";

import { PipelineError, type PipelineWarning } from "./types.js";

function runtimeParseColumn(
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

function runtimeParseOne(
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

export interface ColorValueView {
  semantic: Float64Array;
  temporalKind: TemporalKind | null;
  parser: TemporalParserSpec | null;
  semanticOf(value: unknown): number | undefined;
}

function colorScaleError(
  name: "color" | "fill",
  code: PipelineErrorCode,
  problem: string,
  cause: string,
  fixes: readonly { description: string }[],
  pathSuffix = "",
): PipelineError {
  const path = `/scales/${name}${pathSuffix}`;
  return new PipelineError(code, path, cause, {
    code,
    severity: "error",
    path,
    problem,
    cause,
    fixes,
    documentationUrl: `/guide/color-scales#${code}`,
  });
}

function colorOptions(config: ColorScaleSpec | undefined) {
  return {
    ...(config?.timezone !== undefined && { timezone: config.timezone }),
    ...(config?.disambiguation !== undefined && { disambiguation: config.disambiguation }),
  };
}

function validateColorTemporal(input: {
  name: "color" | "fill";
  config: ColorScaleSpec | undefined;
  parsed: ReturnType<typeof runtimeParseColumn>;
  temporal: boolean;
  requestsTemporal: boolean;
  warnings: PipelineWarning[];
}): void {
  const { name, config, parsed, temporal, requestsTemporal, warnings } = input;
  if (
    (temporal || requestsTemporal) &&
    config?.transform !== undefined &&
    config.transform !== "identity"
  ) {
    throw colorScaleError(
      name,
      "scale-type-transform-conflict",
      `The ${name} scale combines temporal values with a quantitative transform.`,
      `Temporal ${name} values permit only the identity transform, but transform: "${config.transform}" was requested.`,
      [
        { description: "Remove the transform to keep temporal color semantics." },
        { description: "Map a non-temporal quantitative field to use log10 or sqrt." },
      ],
      "/transform",
    );
  }
  if (requestsTemporal && !temporal) {
    const cause =
      parsed.decision.status === "ambiguous"
        ? `Temporal ${name} values are ambiguous between ${parsed.decision.candidates.join(", ")}.`
        : `Temporal ${name} parsing rejected ${String(parsed.decision.failedCount)} value(s).`;
    if (config?.parseFailure !== "censor") {
      throw colorScaleError(
        name,
        "color-temporal-parse",
        `The ${name} scale requested temporal values but the complete column did not parse.`,
        cause,
        [
          { description: `Set scales.${name}.parse to the exact source order.` },
          {
            description:
              'Use parseFailure: "censor" only when dropping invalid colors is intended.',
          },
        ],
      );
    }
    warnings.push({ code: "color-temporal-censored", message: cause });
  }
  if (
    config?.temporalKind !== undefined &&
    parsed.decision.kind !== null &&
    parsed.decision.kind !== undefined &&
    parsed.decision.kind !== config.temporalKind
  ) {
    throw colorScaleError(
      name,
      "color-temporal-kind",
      `The ${name} scale requested ${config.temporalKind} values.`,
      `The parsed column has ${parsed.decision.kind ?? "unknown"} precision.`,
      [
        {
          description: `Use the ${parsed.decision.kind ?? "matching"} helper or correct the source.`,
        },
      ],
    );
  }
}

function temporalColorView(input: {
  name: "color" | "fill";
  values: readonly CellValue[];
  config: ColorScaleSpec | undefined;
  parsed: ReturnType<typeof runtimeParseColumn>;
  options: ReturnType<typeof colorOptions>;
}): ColorValueView {
  const { values, config, parsed, options } = input;
  const parser =
    config?.parse ??
    (parsed.decision.parser === null ? null : (parsed.decision.parser as TemporalParserSpec));
  const byKey = new Map<string, number>();
  for (let index = 0; index < values.length; index++) {
    if (parsed.valid[index] !== 1) continue;
    byKey.set(encodeKey(values[index]), parsed.semantic[index]!);
  }
  return {
    semantic: parsed.semantic,
    temporalKind: parsed.decision.kind ?? config?.temporalKind ?? null,
    parser,
    semanticOf(value: unknown): number | undefined {
      if (value === null || value === undefined) return undefined;
      try {
        const cached = byKey.get(encodeKey(value));
        if (cached !== undefined) return cached;
      } catch {
        return undefined;
      }
      if (parser === null) return undefined;
      const result = runtimeParseOne(value as CellValue, parser, options);
      return result.ok ? result.epochMs : undefined;
    },
  };
}

export function resolveColorValueView(input: {
  name: "color" | "fill";
  values: readonly CellValue[];
  config: ColorScaleSpec | undefined;
  warnings: PipelineWarning[];
}): ColorValueView {
  const { name, values, config, warnings } = input;
  const requestsTemporal =
    config?.temporalKind !== undefined ||
    config?.parse !== undefined ||
    config?.timezone !== undefined ||
    config?.disambiguation !== undefined;
  const options = colorOptions(config);
  const parsed = runtimeParseColumn(values, config?.parse ?? "auto", options);
  const temporal = parsed.decision.status === "temporal";
  validateColorTemporal({ name, config, parsed, temporal, requestsTemporal, warnings });

  if (temporal || requestsTemporal)
    return temporalColorView({ name, values, config, parsed, options });

  const semantic = new Float64Array(values.length);
  for (let index = 0; index < values.length; index++) {
    semantic[index] = cellToNumber(values[index]!);
  }
  return {
    semantic,
    temporalKind: null,
    parser: null,
    semanticOf(value: unknown): number | undefined {
      const number = cellToNumber(value as CellValue);
      return Number.isFinite(number) ? number : undefined;
    },
  };
}
