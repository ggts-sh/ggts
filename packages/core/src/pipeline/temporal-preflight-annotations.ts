/** Temporal preflight for rowless annotation intercepts. */
import type { TemporalDecision } from "@ggts-sh/spec";

import { getTemporalRuntime } from "../temporal-runtime.js";

import type { CellValue } from "../table.js";

import { kindReducesFullValue, type PositionConversionContext } from "./temporal-position.js";
import { temporalPreflightDocs } from "./temporal-preflight-shared.js";
import type { LayerBinding, PipelineWarning, ScaleDiagnostic } from "./types.js";
import { PipelineError } from "./types.js";

type AnnotationAxis = "x" | "y";

function annotationPath(binding: LayerBinding, axis: AnnotationAxis): string {
  return `/layers/${binding.index}/params/${axis}intercept`;
}

function assertAutoAnnotationParsed(
  binding: LayerBinding,
  axis: AnnotationAxis,
  conversion: PositionConversionContext,
  inferredTemporalAxes: ReadonlySet<string>,
  decision: TemporalDecision,
): void {
  if (
    conversion.parser !== "auto" ||
    !inferredTemporalAxes.has(axis) ||
    decision.status === "temporal"
  )
    return;
  throw new PipelineError(
    "temporal-parse-failed",
    annotationPath(binding, axis),
    `The ${axis} axis is temporal, but the annotation intercept could not be parsed unambiguously. Set a concrete intercept format or force a band scale.`,
  );
}

function assertAnnotationKind(
  binding: LayerBinding,
  axis: AnnotationAxis,
  conversion: PositionConversionContext,
  decision: TemporalDecision,
): void {
  if (
    decision.kind === null ||
    conversion.requestedKind === undefined ||
    decision.kind === conversion.requestedKind ||
    (kindReducesFullValue(conversion) && decision.kind !== "time")
  )
    return;
  throw new PipelineError(
    "temporal-parse-failed",
    annotationPath(binding, axis),
    `The annotation parses as ${decision.kind}, not ${conversion.requestedKind}.`,
  );
}

function reportCensoredAnnotation(
  binding: LayerBinding,
  axis: AnnotationAxis,
  conversion: PositionConversionContext,
  decision: TemporalDecision,
  warnings: PipelineWarning[],
  diagnostics: ScaleDiagnostic[],
): boolean {
  if (
    conversion.parser === "auto" ||
    decision.failedCount === 0 ||
    conversion.options.failurePolicy !== "censor"
  )
    return false;
  const message = `Temporal parser ${JSON.stringify(conversion.parser)} censored ${decision.failedCount} annotation intercept value(s) in layer ${binding.index}.`;
  warnings.push({ code: "temporal-values-censored", message });
  diagnostics.push({
    code: "temporal-values-censored",
    severity: "warning",
    path: annotationPath(binding, axis),
    problem: `${decision.failedCount} temporal annotation value(s) were censored.`,
    cause: message,
    fixes: [{ description: "Correct the rejected annotation values." }],
    evidence: { failedCount: decision.failedCount },
    documentationUrl: temporalPreflightDocs("temporal-values-censored"),
  });
  return true;
}

function assertAnnotationTemporal(
  binding: LayerBinding,
  axis: AnnotationAxis,
  decision: TemporalDecision,
): void {
  if (decision.status === "temporal") return;
  const message = `The ${axis} scale requests temporal values, but ${axis}intercept in layer ${binding.index} could not be parsed strictly.`;
  throw new PipelineError("temporal-parse-failed", annotationPath(binding, axis), message, {
    code: "temporal-parse-failed",
    severity: "error",
    path: annotationPath(binding, axis),
    problem: "Temporal annotation parsing failed.",
    cause: message,
    fixes: [{ description: "Correct the annotation value or choose its parser." }],
    evidence: { values: decision.evidence, failedCount: decision.failedCount },
    documentationUrl: temporalPreflightDocs("temporal-parse-failed"),
  });
}

function preflightTemporalAnnotationAxis(input: {
  binding: LayerBinding;
  axis: AnnotationAxis;
  warnings: PipelineWarning[];
  diagnostics: ScaleDiagnostic[];
  inferredTemporalAxes: ReadonlySet<string>;
}): void {
  const { binding, axis, warnings, diagnostics, inferredTemporalAxes } = input;
  const params = binding.layer.params as
    | { xintercept?: CellValue | CellValue[]; yintercept?: CellValue | CellValue[] }
    | undefined;
  const raw = axis === "x" ? params?.xintercept : params?.yintercept;
  if (raw === undefined) return;
  const values = Array.isArray(raw) ? raw : [raw];
  const conversion = axis === "x" ? binding.xConversion : binding.yConversion;
  if (
    conversion.forcedDiscrete ||
    (!conversion.requestedTime && conversion.parser === "auto" && !inferredTemporalAxes.has(axis))
  )
    return;
  // Annotation numbers are already-semantic epoch milliseconds. Source
  // epoch-unit parsing happens earlier for mapped columns/domains/breaks.
  const sourceValues = values.filter(
    (value) => typeof value !== "number" || !Number.isFinite(value),
  );
  if (sourceValues.length === 0) return;
  const runtime = getTemporalRuntime();
  // Lean builds without temporal install cannot preflight annotation
  // strings; full package installs the runtime for time scales.
  if (runtime === null) return;
  const decision = runtime.parseColumn(
    sourceValues,
    conversion.parser,
    conversion.options,
  ).decision;
  assertAutoAnnotationParsed(binding, axis, conversion, inferredTemporalAxes, decision);
  assertAnnotationKind(binding, axis, conversion, decision);
  if (reportCensoredAnnotation(binding, axis, conversion, decision, warnings, diagnostics)) return;
  assertAnnotationTemporal(binding, axis, decision);
}

export function preflightTemporalAnnotations(input: {
  bindings: readonly LayerBinding[];
  warnings: PipelineWarning[];
  diagnostics: ScaleDiagnostic[];
  xConversion: PositionConversionContext;
  yConversion: PositionConversionContext;
  inferredTemporalAxes: ReadonlySet<string>;
}): void {
  const { bindings, warnings, diagnostics, xConversion, yConversion, inferredTemporalAxes } = input;
  for (const binding of bindings) {
    if (binding.xField === null) binding.xConversion = xConversion;
    if (binding.yField === null) binding.yConversion = yConversion;
    for (const axis of ["x", "y"] as const) {
      preflightTemporalAnnotationAxis({
        binding,
        axis,
        warnings,
        diagnostics,
        inferredTemporalAxes,
      });
    }
  }
}
