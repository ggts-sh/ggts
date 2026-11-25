/**
 * Color/fill data-aware scale checks (manual domain/range, sequential, temporal).
 * Prefers per-use evidenceForUse over the last-wins union so multi-table same-name
 * fields keep independent types (#609 / #844).
 * Shared temporal memoization: validate-data-checks-temporal.ts.
 * Temporal censor recovery: validate-data-checks-color-temporal.ts.
 * Position: validate-data-checks-position.ts. Style: validate-data-checks-style.ts (finite + numeric).
 * Orchestrator: validate-data-checks.ts.
 */
import type { SpecError } from "./errors.js";
import { configuredColorScaleType } from "./scale-helpers.js";
import type { ColorScaleSpec } from "./schema.js";
import { SEQUENTIAL_SCHEME_NAMES } from "./schema-names.js";
import type { FieldEvidenceEntry, FieldEvidenceMap } from "./validate-data-evidence.js";
import {
  temporalDecisionForField,
  temporalParserUsable,
  type ChannelFieldUse,
  type TemporalDecisionCache,
} from "./validate-data-checks-temporal.js";
import {
  censoredTemporalColorRecovers,
  colorTemporalCensorRecovery,
} from "./validate-data-checks-color-temporal.js";

const COLOR_CHANNELS = ["color", "fill"] as const;
const SEQUENTIAL_SCHEMES = new Set<string>(SEQUENTIAL_SCHEME_NAMES);

/** Type-preserving key for discrete domain identity (mirrors core encodeKey). */
function discreteDomainKey(value: unknown): string {
  switch (typeof value) {
    case "string":
      return value.startsWith("@") ? "@" + value : value;
    case "number":
      if (Number.isNaN(value)) return "@n:NaN";
      if (Object.is(value, -0)) return "@n:-0";
      return "@n:" + String(value);
    case "boolean":
      return "@b:" + String(value);
    case "bigint":
      return "@i:" + value.toString();
    case "undefined":
      return "@undefined";
    default:
      if (value === null) return "@null";
      if (value instanceof Date) {
        const t = value.getTime();
        return "@d:" + (Number.isNaN(t) ? "NaN" : String(t));
      }
      return JSON.stringify(value);
  }
}

/** Exact domain size, or a lower bound when some field values are unknown. */
type ManualDomainEstimate = { readonly kind: "exact" | "min"; readonly size: number };

function expectedManualDomainLength(
  domain: unknown,
  fieldValueLists: readonly (readonly unknown[] | null | undefined)[],
  scaledConstants: readonly unknown[] = [],
): ManualDomainEstimate | null {
  if (Array.isArray(domain)) {
    return { kind: "exact", size: domain.filter((value) => value !== null).length };
  }
  // DataProfile fields have values: null. Unknown field values disable an
  // exact inference, but known scaled constants still yield a lower bound
  // (runtime domain is at least those constants, plus any field categories).
  const seen = new Set<string>();
  const seenColumns = fieldValueLists.length > 1 ? new Set<readonly unknown[]>() : null;
  let sawValues = false;
  let unknownFieldValues = false;
  for (const values of fieldValueLists) {
    if (values === null || values === undefined) {
      unknownFieldValues = true;
      continue;
    }
    if (seenColumns?.has(values) === true) continue;
    seenColumns?.add(values);
    sawValues = true;
    for (const value of values) {
      if (value === null) continue;
      seen.add(discreteDomainKey(value));
    }
  }
  for (const value of scaledConstants) {
    if (value === null) continue;
    sawValues = true;
    seen.add(discreteDomainKey(value));
  }
  if (!sawValues) return null;
  return { kind: unknownFieldValues ? "min" : "exact", size: seen.size };
}

function manualColorRangeErrors(input: {
  channel: "color" | "fill";
  config: ColorScaleSpec | undefined;
  effectiveType: string | undefined;
  uses: readonly ChannelFieldUse[];
  constants: readonly unknown[];
  evidenceOf: (use: ChannelFieldUse) => FieldEvidenceEntry | undefined;
}): SpecError[] {
  const { channel, config, effectiveType, uses, constants, evidenceOf } = input;
  if (effectiveType !== "manual" && config?.type !== "manual") return [];
  if (!Array.isArray(config?.range)) return [];
  const expected = expectedManualDomainLength(
    config.domain,
    uses.map((use) => evidenceOf(use)?.values),
    constants,
  );
  if (expected === null) return [];
  const mismatch =
    expected.kind === "exact"
      ? config.range.length !== expected.size
      : config.range.length < expected.size;
  if (!mismatch) return [];
  return [
    {
      code: "color-manual-domain-range",
      path: `/scales/${channel}`,
      message:
        expected.kind === "exact"
          ? `The manual ${channel} scale needs one range color per domain value (${String(expected.size)} values, ${String(config.range.length)} colors).`
          : `The manual ${channel} scale has at least ${String(expected.size)} known domain values (scaled constants and/or observed categories) but only ${String(config.range.length)} range colors.`,
      fix: {
        description: `Provide at least ${String(expected.size)} range colors, or set scales.${channel}.domain explicitly to match the range length.`,
      },
    },
  ];
}

type ColorFieldInput = {
  channel: "color" | "fill";
  config: ColorScaleSpec | undefined;
  effectiveType: string | undefined;
  inferredFromSequentialScheme: boolean;
  requestsTemporal: boolean;
  recovery: ReturnType<typeof colorTemporalCensorRecovery>;
  use: ChannelFieldUse;
  evidenceOf: (use: ChannelFieldUse) => FieldEvidenceEntry | undefined;
  typeOf: (use: ChannelFieldUse) => string | null;
  temporalDecisionCache: TemporalDecisionCache;
};

function colorFieldErrors(input: ColorFieldInput): SpecError[] {
  const type = input.typeOf(input.use);
  const transformError = temporalColorTransformError(input, type);
  if (transformError !== null) return [transformError];
  if (type === "quantitative" && input.requestsTemporal) {
    return quantitativeTemporalColorErrors(input);
  }
  if (type !== "nominal" && type !== "ordinal") return [];
  if (input.requestsTemporal && !temporalParserUsable(input.config?.parse)) return [];
  return input.requestsTemporal
    ? discreteTemporalColorErrors(input, type)
    : [discreteSequentialColorError(input, type)];
}

function temporalColorTransformError(
  input: ColorFieldInput,
  type: string | null,
): SpecError | null {
  const transform = input.config?.transform;
  if (type !== "temporal" || transform === undefined || transform === "identity") return null;
  return {
    code: "scale-type-mismatch",
    path: input.use.path,
    message: `scales.${input.channel}.transform is "${transform}" but field "${input.use.field}" is temporal; temporal color scales permit only the identity transform.`,
    fix: {
      description: `Remove scales.${input.channel}.transform to keep temporal inference, or map a non-temporal quantitative field.`,
    },
  };
}

function colorTemporalDecision(input: ColorFieldInput) {
  return temporalDecisionForField(
    input.temporalDecisionCache,
    input.use.field,
    input.evidenceOf(input.use),
    input.config?.parse ?? "auto",
    {
      ...(input.config?.timezone !== undefined && { timezone: input.config.timezone }),
      ...(input.config?.disambiguation !== undefined && {
        disambiguation: input.config.disambiguation,
      }),
    },
  );
}

function quantitativeTemporalColorErrors(input: ColorFieldInput): SpecError[] {
  if (!temporalParserUsable(input.config?.parse)) return [];
  const decision = colorTemporalDecision(input);
  const recovers = censoredTemporalColorRecovers({
    config: input.config,
    decision,
    field: input.use.field,
    recovery: input.recovery,
  });
  if (decision?.status !== "temporal" && !recovers) {
    return [
      {
        code: "scale-type-mismatch",
        path: input.use.path,
        message: `scales.${input.channel} requests temporal colors but field "${input.use.field}" is quantitative (numbers are not treated as temporal without a successful epoch parse).`,
        fix: {
          description: `Map a temporal field, use a working parse: { epoch: "ms" | "s" }, or remove temporal color options.`,
        },
      },
    ];
  }
  const kindError = temporalColorKindError(input, decision?.kind);
  return kindError === null ? [] : [kindError];
}

function temporalColorKindError(
  input: ColorFieldInput,
  actualKind: string | null | undefined,
): SpecError | null {
  const expectedKind = input.config?.temporalKind;
  if (
    expectedKind === undefined ||
    actualKind === null ||
    actualKind === undefined ||
    actualKind === expectedKind
  )
    return null;
  return {
    code: "scale-type-mismatch",
    path: input.use.path,
    message: `scales.${input.channel} requests temporal kind "${expectedKind}" but field "${input.use.field}" parses as "${actualKind}".`,
    fix: {
      description: `Use the ${actualKind} color helper or correct the source precision.`,
    },
  };
}

function discreteSequentialColorError(
  input: ColorFieldInput,
  type: "nominal" | "ordinal",
): SpecError {
  const { channel, config, effectiveType, inferredFromSequentialScheme, use } = input;
  return {
    code: "scale-type-mismatch",
    path: use.path,
    message: inferredFromSequentialScheme
      ? `scales.${channel}.scheme is "${config?.scheme}" and selects a sequential scale, but field "${use.field}" is ${type}; sequential color ramps need quantitative values.`
      : `scales.${channel}.type is "${effectiveType}" but field "${use.field}" is ${type}; quantitative color scales need quantitative or temporal values.`,
    fix: inferredFromSequentialScheme
      ? {
          description: `Set scales.${channel}.scheme to a categorical scheme, remove it to infer an ordinal scale from "${use.field}", or map a quantitative field.`,
          example: { scheme: "observable10" },
        }
      : { description: `Set scales.${channel}.type to "ordinal".` },
  };
}

function discreteTemporalColorErrors(
  input: ColorFieldInput,
  type: "nominal" | "ordinal",
): SpecError[] {
  const decision = colorTemporalDecision(input);
  const recovers = censoredTemporalColorRecovers({
    config: input.config,
    decision,
    field: input.use.field,
    recovery: input.recovery,
  });
  if (decision?.status === "temporal" || recovers) {
    const kindError = temporalColorKindError(input, decision?.kind);
    return kindError === null ? [] : [kindError];
  }
  const detail = colorTemporalDecisionDetail(decision);
  return [
    {
      code: "scale-type-mismatch",
      path: input.use.path,
      message: `scales.${input.channel} requests temporal colors but field "${input.use.field}" is ${type}.${detail}`,
      fix: {
        description:
          input.config?.parse === undefined
            ? `Set scales.${input.channel}.parse to the exact temporal order, or use type: "ordinal".`
            : `Correct the rejected values, choose the matching parser, or set parseFailure: "censor" explicitly.`,
      },
    },
  ];
}

function colorTemporalDecisionDetail(decision: ReturnType<typeof colorTemporalDecision>): string {
  if (decision?.status === "ambiguous") {
    return ` Automatic temporal inference was ambiguous between: ${decision.candidates.join(", ")}.`;
  }
  if (decision?.status === "invalid") {
    return ` Temporal parsing rejected ${String(decision.failedCount)} value(s).`;
  }
  return "";
}

/** Post-layer color/fill scale type compatibility against collected field uses. */
export function checkColorScaleDataCompatibility(input: {
  scales: Record<string, unknown> | undefined;
  fields: FieldEvidenceMap;
  /**
   * Optional per-use evidence lookup. When provided, prefer it over the
   * last-wins `fields` union so multi-table layers with the same field name
   * keep their own type evidence (#609 / #844).
   */
  evidenceForUse?: (use: ChannelFieldUse) => FieldEvidenceEntry | undefined;
  colorFields: Record<"color" | "fill", ChannelFieldUse[]>;
  /** Scaled constants (`{ value, scale: true }`) included in runtime domain training. */
  colorScaledConstants?: Record<"color" | "fill", readonly unknown[]>;
  temporalDecisionCache: TemporalDecisionCache;
}): SpecError[] {
  const { scales, fields, colorFields, temporalDecisionCache } = input;
  const colorScaledConstants = input.colorScaledConstants ?? { color: [], fill: [] };
  const errors: SpecError[] = [];
  const evidenceOf = (use: ChannelFieldUse) => input.evidenceForUse?.(use) ?? fields.get(use.field);
  const typeOf = (use: ChannelFieldUse) => evidenceOf(use)?.type ?? null;

  for (const channel of COLOR_CHANNELS) {
    const config = scales?.[channel] as ColorScaleSpec | undefined;
    const effectiveType = configuredColorScaleType(config);

    errors.push(
      ...manualColorRangeErrors({
        channel,
        config,
        effectiveType,
        uses: colorFields[channel],
        constants: colorScaledConstants[channel],
        evidenceOf,
      }),
    );

    const inferredFromSequentialScheme =
      config?.type === undefined &&
      config?.range === undefined &&
      config?.scheme !== undefined &&
      SEQUENTIAL_SCHEMES.has(config.scheme);
    if (effectiveType !== "sequential" && effectiveType !== "binned") continue;

    const requestsTemporal = [
      config?.temporalKind,
      config?.parse,
      config?.timezone,
      config?.disambiguation,
    ].some((value) => value !== undefined);
    const recovery = colorTemporalCensorRecovery({
      config,
      colorFields: colorFields[channel],
      colorScaledConstants: colorScaledConstants[channel],
      temporalDecisionCache,
      evidenceOf,
      typeOf,
    });
    // Runtime collects all channel values into one temporal column; a kind
    // conflict (sibling field or scaled constant) throws color-temporal-kind.
    const conflictError = colorChannelKindConflictError(channel, config, recovery);
    if (conflictError !== null) errors.push(conflictError);

    for (const use of colorFields[channel]) {
      errors.push(
        ...colorFieldErrors({
          channel,
          config,
          effectiveType,
          inferredFromSequentialScheme,
          requestsTemporal,
          recovery,
          use,
          evidenceOf,
          typeOf,
          temporalDecisionCache,
        }),
      );
    }
  }
  return errors;
}

function colorChannelKindConflictError(
  channel: "color" | "fill",
  config: ColorScaleSpec | undefined,
  recovery: ReturnType<typeof colorTemporalCensorRecovery>,
): SpecError | null {
  if (
    !recovery.kindConflicts ||
    typeof config?.temporalKind !== "string" ||
    recovery.conflictingKind === null
  )
    return null;
  return {
    code: "scale-type-mismatch",
    path: `/scales/${channel}`,
    message: `scales.${channel} requests temporal kind "${config.temporalKind}" but a channel value parses as "${recovery.conflictingKind}".`,
    fix: {
      description: `Use ${config.temporalKind} values for every color mapping and scaled constant, or set temporalKind to "${recovery.conflictingKind}".`,
    },
  };
}
