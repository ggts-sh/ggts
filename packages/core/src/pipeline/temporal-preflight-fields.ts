/** Temporal preflight for mapped field columns (parse, infer, mutate binding conversions). */
import {
  TEMPORAL_PARSER_NAMES,
  type PositionScaleSpec,
  type TemporalDecision,
  type TemporalParserName,
} from "@ggts-sh/spec";

import type { ColumnTable } from "../table.js";

import { kindReducesFullValue, type PositionConversionContext } from "./temporal-position.js";
import { assertTemporalConfiguration, temporalPreflightDocs } from "./temporal-preflight-shared.js";
import type {
  Advisory,
  LayerBinding,
  PipelineWarning,
  ScaleDecision,
  ScaleDiagnostic,
} from "./types.js";
import { PipelineError } from "./types.js";

/**
 * Time-of-day scales (#831) accept portable seconds-since-midnight numbers and
 * Date values (UTC clock portion) without requiring string temporal parse.
 */
function columnAcceptsTimeOfDay(table: ColumnTable, field: string): boolean {
  const raw = table.column(field);
  let saw = false;
  for (const value of raw) {
    if (value === null || value === undefined) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      saw = true;
      continue;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      saw = true;
      continue;
    }
    return false;
  }
  return saw;
}

type Axis = "x" | "y";

interface PreflightOutputs {
  warnings: PipelineWarning[];
  advisories: Advisory[];
  decisions: ScaleDecision[];
  diagnostics: ScaleDiagnostic[];
}

function axisFields(binding: LayerBinding, axis: Axis): (string | null)[] {
  const isSegment = binding.layer.geom === "segment";
  if (axis === "y") {
    return [
      binding.yField,
      binding.yminField,
      binding.ymaxField,
      ...(isSegment ? [binding.yendField] : []),
    ];
  }
  // xmin/xmax are only consumed by rect/ribbon (frame-identity gates the same
  // way). Preflighting them on other geoms rejects unused non-temporal bounds.
  const consumesBounds = binding.layer.geom === "rect" || binding.layer.geom === "ribbon";
  return [
    binding.xField,
    ...(consumesBounds ? [binding.xminField, binding.xmaxField] : []),
    ...(isSegment ? [binding.xendField] : []),
  ];
}

function reportExplicitFailures(input: {
  axis: Axis;
  field: string;
  conversion: PositionConversionContext;
  decision: TemporalDecision;
  outputs: PreflightOutputs;
}): boolean {
  const { axis, field, conversion, decision, outputs } = input;
  if (conversion.parser === "auto" || decision.failedCount === 0) return false;
  const sample = decision.failures?.[0];
  const message =
    `Temporal parser ${JSON.stringify(conversion.parser)} rejected ${decision.failedCount} value(s) in field "${field}".` +
    (sample === undefined
      ? ""
      : ` First failure at row ${sample.index}: ${JSON.stringify(sample.value)} (${sample.reason}).`);
  const evidence = {
    ...(decision.failures !== undefined && {
      values: decision.failures.map((failure) => failure.value),
    }),
    failedCount: decision.failedCount,
  };
  if (conversion.options.failurePolicy !== "censor") {
    throw new PipelineError("temporal-parse-failed", `/scales/${axis}/parse`, message, {
      code: "temporal-parse-failed",
      severity: "error",
      path: `/scales/${axis}/parse`,
      problem: `Temporal parsing failed for ${decision.failedCount} value(s).`,
      cause: message,
      fixes: [
        { description: "Correct the rejected values or choose the matching parser." },
        {
          description: "Censor rejected values explicitly.",
          portable: { scales: { [axis]: { parseFailure: "censor" } } },
        },
      ],
      evidence,
      documentationUrl: temporalPreflightDocs("temporal-parse-failed"),
    });
  }
  outputs.warnings.push({ code: "temporal-values-censored", message });
  outputs.diagnostics.push({
    code: "temporal-values-censored",
    severity: "warning",
    path: `/scales/${axis}/parse`,
    problem: `${decision.failedCount} temporal value(s) were censored.`,
    cause: message,
    fixes: [
      { description: "Correct the rejected values or choose the matching parser." },
      {
        description: "Use strict failure handling.",
        portable: { scales: { [axis]: { parseFailure: "error" } } },
      },
    ],
    evidence,
    documentationUrl: temporalPreflightDocs("temporal-values-censored"),
  });
  return true;
}

function assertRequestedTemporal(input: {
  table: ColumnTable;
  axis: Axis;
  field: string;
  conversion: PositionConversionContext;
  decision: TemporalDecision;
}): void {
  const { table, axis, field, conversion, decision } = input;
  const acceptsCyclicalValue =
    (conversion.requestedKind === "time" || conversion.requestedKind === "monthDay") &&
    columnAcceptsTimeOfDay(table, field);
  if (!conversion.requestedTime || decision.status === "temporal" || acceptsCyclicalValue) return;
  const candidates =
    decision.candidates.length > 0 ? ` Candidates: ${decision.candidates.join(", ")}.` : "";
  const message = `The ${axis} scale requests temporal values, but field "${field}" could not be parsed strictly.${candidates} Set scales.${axis}.parse explicitly or use type: "band".`;
  throw new PipelineError("temporal-parse-failed", `/scales/${axis}/parse`, message, {
    code: "temporal-parse-failed",
    severity: "error",
    path: `/scales/${axis}/parse`,
    problem: `Field "${field}" could not satisfy the requested temporal scale.`,
    cause: message,
    fixes: [
      {
        description: "Choose an explicit temporal parser.",
        portable: { scales: { [axis]: { type: "time", parse: "dmy" } } },
      },
      {
        description: "Keep the field discrete.",
        portable: { scales: { [axis]: { type: "band" } } },
      },
    ],
    evidence: { values: decision.evidence, candidates: decision.candidates },
    documentationUrl: temporalPreflightDocs("temporal-parse-failed"),
  });
}

function assertTemporalKind(input: {
  axis: Axis;
  field: string;
  conversion: PositionConversionContext;
  decision: TemporalDecision;
}): void {
  const { axis, field, conversion, decision } = input;
  const reducesFullValue = kindReducesFullValue(conversion);
  const compatibleReduction =
    reducesFullValue && (decision.kind === "date" || decision.kind === "datetime");
  if (
    decision.kind === null ||
    conversion.requestedKind === undefined ||
    decision.kind === conversion.requestedKind ||
    compatibleReduction
  )
    return;
  const message = `The ${axis} scale requests ${conversion.requestedKind} values, but field "${field}" parses as ${decision.kind}. Choose the matching date/datetime scale or parser.`;
  throw new PipelineError("temporal-parse-failed", `/scales/${axis}/temporalKind`, message, {
    code: "temporal-parse-failed",
    severity: "error",
    path: `/scales/${axis}/temporalKind`,
    problem: `Field "${field}" does not match temporalKind "${conversion.requestedKind}".`,
    cause: message,
    fixes: [
      { description: `Use temporalKind "${decision.kind}" for this field.` },
      { description: `Choose a parser that produces ${conversion.requestedKind} values.` },
    ],
    evidence: { values: decision.evidence },
    documentationUrl: temporalPreflightDocs("temporal-parse-failed"),
  });
}

function reportInference(input: {
  axis: Axis;
  field: string;
  conversion: PositionConversionContext;
  decision: TemporalDecision;
  outputs: PreflightOutputs;
}): void {
  const { axis, field, conversion, decision, outputs } = input;
  if (
    conversion.parser === "auto" &&
    decision.status === "temporal" &&
    decision.parser === "year"
  ) {
    outputs.advisories.push({
      code: "temporal-year-inferred",
      path: `scales.${axis}`,
      chosen: `four-digit strings in "${field}" treated as calendar years`,
      howToOverride: `Use scale${axis.toUpperCase()}Discrete() or set scales.${axis}.type to "band" for year-like identifiers.`,
    });
    outputs.diagnostics.push({
      code: "temporal-year-inferred",
      severity: "advisory",
      path: `/scales/${axis}`,
      problem: `Four-digit strings in "${field}" were interpreted as calendar years.`,
      cause: "Value-only evidence cannot distinguish calendar years from four-digit identifiers.",
      fixes: [
        {
          description: "Keep the values as discrete identifiers.",
          portable: { scales: { [axis]: { type: "band" } } },
          typescript: `.scale${axis.toUpperCase()}Discrete()`,
        },
      ],
      evidence: { values: decision.evidence },
      documentationUrl: temporalPreflightDocs("temporal-year-inferred"),
    });
    return;
  }
  if (conversion.requestedTime || decision.status !== "ambiguous") {
    reportInvalidInference(input);
    return;
  }
  outputs.advisories.push({
    code: "temporal-inference-ambiguous",
    path: `scales.${axis}`,
    chosen: `field "${field}" kept discrete because date order is ambiguous (${decision.candidates.join(", ")})`,
    howToOverride: `Set scales.${axis}.parse to the intended order, such as "dmy" or "mdy".`,
  });
  outputs.diagnostics.push({
    code: "temporal-inference-ambiguous",
    severity: "advisory",
    path: `/scales/${axis}`,
    problem: `Field "${field}" was kept discrete because its date order is ambiguous.`,
    cause: `The sampled values match multiple parser orders: ${decision.candidates.join(", ")}.`,
    fixes: decision.candidates.map((parser) => ({
      description: `Parse with ${parser}.`,
      portable: { scales: { [axis]: { type: "time", parse: parser } } },
    })),
    evidence: { values: decision.evidence, candidates: decision.candidates },
    documentationUrl: temporalPreflightDocs("temporal-inference-ambiguous"),
  });
}

function reportInvalidInference(input: {
  axis: Axis;
  field: string;
  conversion: PositionConversionContext;
  decision: TemporalDecision;
  outputs: PreflightOutputs;
}): void {
  const { axis, field, conversion, decision, outputs } = input;
  if (conversion.requestedTime || decision.status !== "invalid") return;
  outputs.advisories.push({
    code: "temporal-inference-invalid",
    path: `scales.${axis}`,
    chosen: `field "${field}" kept discrete because ${decision.failedCount} value(s) failed whole-column temporal validation`,
    howToOverride: `Correct the values, set scales.${axis}.parse explicitly, or force type: "band".`,
  });
  outputs.diagnostics.push({
    code: "temporal-inference-invalid",
    severity: "advisory",
    path: `/scales/${axis}`,
    problem: `Field "${field}" was kept discrete after whole-column validation failed.`,
    cause: `${decision.failedCount} value(s) did not match the sampled temporal family.`,
    fixes: [
      { description: "Correct the rejected values or supply an explicit parser." },
      {
        description: "Keep the field discrete.",
        portable: { scales: { [axis]: { type: "band" } } },
      },
    ],
    evidence: {
      ...(decision.failures !== undefined && {
        values: decision.failures.map((failure) => failure.value),
      }),
      failedCount: decision.failedCount,
    },
    documentationUrl: temporalPreflightDocs("temporal-inference-invalid"),
  });
}

function inferredParser(decision: TemporalDecision): TemporalParserName | undefined {
  return TEMPORAL_PARSER_NAMES.find(
    (candidate): candidate is TemporalParserName => candidate === decision.parser,
  );
}

function recordScaleDecision(input: {
  axis: Axis;
  field: string;
  conversion: PositionConversionContext;
  decision: TemporalDecision;
  parser: TemporalParserName | undefined;
  decisions: ScaleDecision[];
}): void {
  const { axis, field, conversion, decision, parser, decisions } = input;
  const reportable =
    decision.status === "temporal" ||
    decision.status === "ambiguous" ||
    decision.status === "invalid" ||
    conversion.requestedTime;
  if (!reportable) return;
  const portableParser = conversion.parser === "auto" ? parser : conversion.parser;
  const portableOverride: PositionScaleSpec =
    decision.status === "temporal"
      ? {
          type: "time",
          ...(decision.kind !== null && { temporalKind: decision.kind }),
          ...(portableParser === undefined ? {} : { parse: portableParser }),
        }
      : { type: "band" };
  decisions.push({
    aesthetic: axis,
    field,
    status: decision.status === "temporal" ? "temporal" : "nominal",
    parser: decision.status === "temporal" ? decision.parser : null,
    kind: decision.kind,
    precision: decision.precision,
    evidence: decision.evidence,
    validatedCount: decision.validatedCount,
    ambiguity: decision.status === "ambiguous" ? decision.candidates : [],
    portableOverride,
  });
}

function resolvedConversion(
  conversion: PositionConversionContext,
  decision: TemporalDecision,
  parser: TemporalParserName | undefined,
): PositionConversionContext {
  if (conversion.parser !== "auto" || decision.status !== "temporal" || parser === undefined) {
    return conversion;
  }
  return Object.freeze({
    ...conversion,
    parser,
    options: Object.freeze({ ...conversion.options }),
  });
}

function resolutionKey(
  binding: LayerBinding,
  axis: Axis,
  field: string,
  conversion: PositionConversionContext,
): string {
  const parser = conversion.parser === "auto" ? "auto" : JSON.stringify(conversion.parser);
  return `${binding.sourceId}|${axis}|${field}|${parser}|${JSON.stringify(conversion.options)}`;
}

function processTemporalAxis(input: {
  binding: LayerBinding;
  layerTable: ColumnTable;
  axis: Axis;
  resolvedByKey: Map<string, PositionConversionContext>;
  outputs: PreflightOutputs;
}): void {
  const { binding, layerTable, axis, resolvedByKey, outputs } = input;
  const axisConversion = axis === "x" ? binding.xConversion : binding.yConversion;
  if (axisConversion.forcedDiscrete || axisConversion.forcedNonTemporal) return;
  assertTemporalConfiguration(axis, axisConversion);
  const fieldResolutions: PositionConversionContext[] = [];
  for (const field of new Set(axisFields(binding, axis))) {
    if (field === null || !layerTable.has(field)) continue;
    const key = resolutionKey(binding, axis, field, axisConversion);
    const cachedResolution = resolvedByKey.get(key);
    if (cachedResolution !== undefined) {
      fieldResolutions.push(cachedResolution);
      continue;
    }
    const decision = layerTable.parsed(
      field,
      axisConversion.sourceParser,
      axisConversion.options,
    ).decision;
    const explicitFailure = reportExplicitFailures({
      axis,
      field,
      conversion: axisConversion,
      decision,
      outputs,
    });
    if (!explicitFailure) {
      assertRequestedTemporal({
        table: layerTable,
        axis,
        field,
        conversion: axisConversion,
        decision,
      });
    }
    assertTemporalKind({ axis, field, conversion: axisConversion, decision });
    reportInference({ axis, field, conversion: axisConversion, decision, outputs });
    const parser = inferredParser(decision);
    recordScaleDecision({
      axis,
      field,
      conversion: axisConversion,
      decision,
      parser,
      decisions: outputs.decisions,
    });
    const resolution = resolvedConversion(axisConversion, decision, parser);
    resolvedByKey.set(key, resolution);
    fieldResolutions.push(resolution);
  }
  const uniqueResolutions = new Map(
    fieldResolutions.map((resolution) => [JSON.stringify(resolution), resolution]),
  );
  const resolvedAxisConversion =
    uniqueResolutions.size === 1 ? uniqueResolutions.values().next().value! : axisConversion;
  if (axis === "x") binding.xConversion = resolvedAxisConversion;
  else binding.yConversion = resolvedAxisConversion;
}

export function preflightTemporalFields(input: {
  table: ColumnTable;
  bindings: readonly LayerBinding[];
  warnings: PipelineWarning[];
  advisories: Advisory[];
}): { decisions: ScaleDecision[]; diagnostics: ScaleDiagnostic[] } {
  const { table, bindings, warnings, advisories } = input;
  const resolvedByKey = new Map<string, PositionConversionContext>();
  const decisions: ScaleDecision[] = [];
  const diagnostics: ScaleDiagnostic[] = [];
  const outputs: PreflightOutputs = { warnings, advisories, decisions, diagnostics };
  for (const binding of bindings) {
    const layerTable = binding.sourceTable ?? table;
    for (const axis of ["x", "y"] as const) {
      processTemporalAxis({ binding, layerTable, axis, resolvedByKey, outputs });
    }
  }
  return { decisions, diagnostics };
}
