/**
 * Labs-scoped lint rules: missing-chart-title.
 * Orchestrator: lint.ts.
 */
import type { SpecAdvisory } from "./lint.js";

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

/** Labs-level advisories for one lintSpec pass (spec-only: needs "spec"). */
export function collectLabsLintAdvisories(spec: Record<string, unknown>): SpecAdvisory[] {
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
