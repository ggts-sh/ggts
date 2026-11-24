/**
 * Labs-scoped spec-lint rules: missing-chart-title, missing-axis-title.
 * Orchestrator: lint.ts.
 */
import { humanizeFieldTitle } from "./humanize-field.js";
import type { SpecAdvisory } from "./lint.js";
import type { Aes } from "./schema.js";
import { effectiveChannel } from "./validate-data.js";
import { hasGeomIntercepts } from "./validate-structure-layer-rule.js";

const POSITIONAL_AXES = ["x", "y"] as const;
type PositionalAxis = (typeof POSITIONAL_AXES)[number];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonBlankString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function inlineRefHasRows(ref: unknown): boolean {
  if (!isRecord(ref)) return false;
  if (Array.isArray(ref["values"]) && ref["values"].length > 0) return true;
  if (isRecord(ref["columns"])) {
    for (const col of Object.values(ref["columns"])) {
      if (Array.isArray(col) && col.length > 0) return true;
    }
  }
  return false;
}

function dataRefHasData(ref: unknown, datasets: Record<string, unknown> | undefined): boolean {
  if (!isRecord(ref)) return false;
  if (isNonBlankString(ref["name"])) {
    if (datasets !== undefined && Object.hasOwn(datasets, ref["name"])) {
      return inlineRefHasRows(datasets[ref["name"]]);
    }
    // Runtime / host-supplied named dataset (e.g. CLI --data).
    return true;
  }
  return inlineRefHasRows(ref);
}

function anyLayerHasData(spec: Record<string, unknown>, layers: readonly unknown[]): boolean {
  const plotData = spec["data"];
  const datasets = isRecord(spec["datasets"]) ? spec["datasets"] : undefined;
  for (const layer of layers) {
    if (!isRecord(layer)) continue;
    const ref = layer["data"] === undefined ? plotData : layer["data"];
    if (dataRefHasData(ref, datasets)) return true;
  }
  return false;
}

/** Collect `missing-chart-title` advisories for one lintSpec pass (spec-only: needs "spec"). */
export function collectChartTitleAdvisories(spec: Record<string, unknown>): SpecAdvisory[] {
  const labs = isRecord(spec["labs"]) ? spec["labs"] : undefined;
  if (isNonBlankString(labs?.["title"])) return [];
  const hasSubtitle = isNonBlankString(labs?.["subtitle"]);
  const layers = Array.isArray(spec["layers"]) ? (spec["layers"] as unknown[]) : [];
  if (!hasSubtitle && !anyLayerHasData(spec, layers)) return [];

  return [
    {
      code: "missing-chart-title",
      path: "/labs",
      message: hasSubtitle
        ? "labs.subtitle is set without labs.title — the subtitle becomes the chart's top line with no title stating the chart's message."
        : "This chart has layer data without labs.title — add a one-line title stating the chart's message.",
      suggestion: {
        description: hasSubtitle
          ? "Add labs.title with the chart's message in one line, keeping labs.subtitle as the subordinate line under it."
          : "Add labs.title with the chart's message in one line.",
        example: { labs: { title: "..." } },
      },
    },
  ];
}

function resolvedLayerAxisField(
  layer: Record<string, unknown>,
  plotAes: Aes | undefined,
  axis: PositionalAxis,
): string | null {
  const geom = typeof layer["geom"] === "string" ? layer["geom"] : "";
  const layerAes = isRecord(layer["aes"]) ? (layer["aes"] as Aes) : undefined;
  const intercepts =
    (geom === "hline" || geom === "vline" || geom === "rule") && hasGeomIntercepts(geom, layer);
  if (!intercepts && geom === "hline" && axis === "x") return null;
  if (!intercepts && geom === "vline" && axis === "y") return null;
  const effectivePlotAes = geom === "abline" || intercepts ? undefined : plotAes;
  const mapped = effectiveChannel(effectivePlotAes, layerAes, axis);
  if (!isRecord(mapped) || !("field" in mapped)) return null;
  return typeof mapped.field === "string" && mapped.field.length > 0 ? mapped.field : null;
}

function firstMappedAxisField(
  layers: readonly unknown[],
  plotAes: Aes | undefined,
  axis: PositionalAxis,
): string | null {
  for (const layer of layers) {
    if (!isRecord(layer)) continue;
    const field = resolvedLayerAxisField(layer, plotAes, axis);
    if (field !== null) return field;
  }
  return null;
}

function axisTitleAdvisory(
  axis: PositionalAxis,
  field: string,
  rawTitle: unknown,
): SpecAdvisory | null {
  if (typeof rawTitle === "string" && rawTitle.trim().length > 0) return null;
  if (rawTitle !== undefined && rawTitle !== null && typeof rawTitle !== "string") return null;
  const humanized = humanizeFieldTitle(field) || field;
  const isBlank = typeof rawTitle === "string";
  const message = isBlank
    ? `labs.${axis} is blank for mapped field "${field}", so the ${axis} axis renders nothing instead of an authored title.`
    : `labs.${axis} is absent for mapped field "${field}", so the ${axis} axis falls back to the humanized column name "${humanized}".`;
  return {
    code: "missing-axis-title",
    path: `/labs/${axis}`,
    message,
    suggestion: {
      description: `Set labs.${axis} to a title that names the measure and its unit rather than accepting the column name "${humanized}".`,
      example: { labs: { [axis]: humanized } },
    },
  };
}

/** Collect `missing-axis-title` advisories for positional channels mapped to fields. */
export function collectAxisTitleAdvisories(spec: Record<string, unknown>): SpecAdvisory[] {
  const layers = Array.isArray(spec["layers"]) ? (spec["layers"] as unknown[]) : [];
  const plotAes = isRecord(spec["aes"]) ? (spec["aes"] as Aes) : undefined;
  const labs = isRecord(spec["labs"]) ? spec["labs"] : undefined;
  const advisories: SpecAdvisory[] = [];
  for (const axis of POSITIONAL_AXES) {
    const field = firstMappedAxisField(layers, plotAes, axis);
    if (field === null) continue;
    const advisory = axisTitleAdvisory(axis, field, labs?.[axis]);
    if (advisory !== null) advisories.push(advisory);
  }
  return advisories;
}
