/**
 * Layer-pair lint rule: bar-end-label-offset (issue #1966) — a `text` or
 * `label` layer whose `params.anchor` is `"start"` or `"end"` and that shares
 * a panel and categorical `x` (plus `y` for `col`) with a `col` or `bar`
 * (`stat !== "bin"`) layer.
 *
 * Uses `effectiveChannel` directly (never `fieldOf`) so `needs: "spec"` holds
 * without inline data or a DataProfile. When `spec.facet` and inline
 * `layerEvidence` values are both present, disjoint facet panels suppress the
 * advisory; otherwise panels are assumed to overlap.
 */
import type { SpecAdvisory } from "./lint.js";
import type { Aes, ChannelName } from "./schema.js";
import { effectiveChannel, type FieldEvidenceMap } from "./validate-data.js";
import { isRecord } from "./validate-structure-layer-shared.js";

interface BarLayerInfo {
  index: number;
  geom: "col" | "bar";
  xField: string;
  yField: string | null;
}

interface LabelLayerInfo {
  index: number;
  geom: "text" | "label";
  anchor: "start" | "end";
  dx: number | undefined;
  dy: number | undefined;
  nudgeX: number;
  nudgeY: number;
  xField: string;
  yField: string | null;
  hasStatY: boolean;
}

interface FacetAxis {
  field: string;
  levels?: Set<string>;
}

function channelField(
  plotAes: Aes | undefined,
  layerAes: Aes | undefined,
  channel: ChannelName,
): string | null {
  const mapped = effectiveChannel(plotAes, layerAes, channel);
  if (!isRecord(mapped) || !("field" in mapped)) return null;
  return typeof mapped.field === "string" ? mapped.field : null;
}

function hasStatChannel(
  plotAes: Aes | undefined,
  layerAes: Aes | undefined,
  channel: ChannelName,
): boolean {
  const mapped = effectiveChannel(plotAes, layerAes, channel);
  return isRecord(mapped) && "stat" in mapped && typeof mapped.stat === "string";
}

function finiteNonZero(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value !== 0 ? value : undefined;
}

function finiteOffset(value: unknown): number {
  return finiteNonZero(value) ?? 0;
}

function extractBarLayer(
  layer: unknown,
  index: number,
  plotAes: Aes | undefined,
): BarLayerInfo | null {
  if (!isRecord(layer)) return null;
  const geom = layer["geom"];
  if (geom !== "col" && geom !== "bar") return null;
  if (geom === "bar" && layer["stat"] === "bin") return null;
  const layerAes = isRecord(layer["aes"]) ? (layer["aes"] as Aes) : undefined;
  const xField = channelField(plotAes, layerAes, "x");
  if (xField === null) return null;
  const yField = channelField(plotAes, layerAes, "y");
  if (geom === "col" && yField === null) return null;
  return { index, geom, xField, yField };
}

function extractLabelLayer(
  layer: unknown,
  index: number,
  plotAes: Aes | undefined,
): LabelLayerInfo | null {
  if (!isRecord(layer)) return null;
  const geom = layer["geom"];
  if (geom !== "text" && geom !== "label") return null;
  const params = layer["params"];
  if (!isRecord(params)) return null;
  const anchor = params["anchor"];
  if (anchor !== "start" && anchor !== "end") return null;
  const layerAes = isRecord(layer["aes"]) ? (layer["aes"] as Aes) : undefined;
  const xField = channelField(plotAes, layerAes, "x");
  if (xField === null) return null;
  const yField = channelField(plotAes, layerAes, "y");
  const hasStatY = yField === null && hasStatChannel(plotAes, layerAes, "y");
  const posParams =
    layer["position"] === "nudge" && isRecord(layer["positionParams"])
      ? layer["positionParams"]
      : undefined;
  return {
    index,
    geom,
    anchor,
    dx: finiteNonZero(params["dx"]),
    dy: finiteNonZero(params["dy"]),
    nudgeX: finiteOffset(posParams?.["x"]),
    nudgeY: finiteOffset(posParams?.["y"]),
    xField,
    yField,
    hasStatY,
  };
}

function channelsMatch(bar: BarLayerInfo, label: LabelLayerInfo): boolean {
  if (bar.xField !== label.xField) return false;
  if (bar.geom === "col") return label.yField === bar.yField;
  if (bar.yField !== null) return label.yField === bar.yField;
  return label.yField !== null || label.hasStatY;
}

function facetKey(value: unknown): string {
  return Object.is(value, -0) ? "-0" : (JSON.stringify(value) ?? "undefined");
}

function extractFacetAxes(spec: Record<string, unknown>): FacetAxis[] {
  const facet = spec["facet"];
  if (!isRecord(facet)) return [];
  const axes: FacetAxis[] = [];
  for (const key of ["wrap", "rows", "cols"]) {
    const ref = facet[key];
    if (typeof ref === "string") {
      axes.push({ field: ref });
      continue;
    }
    if (!isRecord(ref) || typeof ref["field"] !== "string") continue;
    axes.push({
      field: ref["field"],
      ...(Array.isArray(ref["levels"]) && {
        levels: new Set(ref["levels"].map(facetKey)),
      }),
    });
  }
  return axes;
}

function layerSurvivingPanels(
  fields: FieldEvidenceMap,
  ownAxes: readonly FacetAxis[],
  sharedAxes: readonly FacetAxis[],
): Set<string> | null {
  if (ownAxes.length === 0) return null;
  const ownColumns = ownAxes.map((axis) => fields.get(axis.field)!.values!);
  const rowCount = ownColumns.reduce((min, column) => Math.min(min, column.length), Infinity);
  const sharedColumns = sharedAxes.map((axis) => fields.get(axis.field)!.values!);
  const panels = new Set<string>();
  for (let row = 0; row < rowCount; row++) {
    let included = true;
    for (let a = 0; a < ownAxes.length; a++) {
      const levels = ownAxes[a]!.levels;
      if (levels !== undefined && !levels.has(facetKey(ownColumns[a]![row]))) {
        included = false;
        break;
      }
    }
    if (!included) continue;
    panels.add(
      sharedAxes.length === 0
        ? "[]"
        : JSON.stringify(sharedColumns.map((column) => facetKey(column[row]))),
    );
  }
  return panels;
}

function panelsOverlap(
  facetAxes: readonly FacetAxis[],
  barFields: FieldEvidenceMap | null,
  labelFields: FieldEvidenceMap | null,
): boolean {
  if (facetAxes.length === 0 || barFields === null || labelFields === null) return true;
  const hasValues = (fields: FieldEvidenceMap, axis: FacetAxis) =>
    Array.isArray(fields.get(axis.field)?.values);
  const barOwnAxes = facetAxes.filter((axis) => hasValues(barFields, axis));
  const labelOwnAxes = facetAxes.filter((axis) => hasValues(labelFields, axis));
  const sharedAxes = barOwnAxes.filter((axis) => hasValues(labelFields, axis));
  const barPanels = layerSurvivingPanels(barFields, barOwnAxes, sharedAxes);
  if (barPanels !== null && barPanels.size === 0) return false;
  const labelPanels = layerSurvivingPanels(labelFields, labelOwnAxes, sharedAxes);
  if (labelPanels !== null && labelPanels.size === 0) return false;
  if (sharedAxes.length === 0 || barPanels === null || labelPanels === null) return true;
  for (const panel of labelPanels) {
    if (barPanels.has(panel)) return true;
  }
  return false;
}

function isCleanFlippedOffset(label: LabelLayerInfo): boolean {
  if (label.dx !== undefined || label.nudgeX !== 0) return false;
  const dir = label.anchor === "start" ? 1 : -1;
  // Under coord: flip, positive data-y (nudgeY > 0) and negative pixel dy (dy < 0) both shift +x.
  const dyDir = label.dy === undefined ? 0 : -label.dy * dir;
  const nudgeDir = label.nudgeY * dir;
  return dyDir >= 0 && nudgeDir >= 0 && (dyDir > 0 || nudgeDir > 0);
}

function buildCartesianAdvisory(label: LabelLayerInfo, bar: BarLayerInfo): SpecAdvisory {
  const dxDetail = label.dx === undefined ? "" : ` with dx: ${label.dx}`;
  return {
    code: "bar-end-label-offset",
    path: `/layers/${label.index}/params/anchor`,
    message: `This ${label.geom} layer sets params.anchor "${label.anchor}"${dxDetail} over ${bar.geom} layer ${bar.index} — the anchor places the label's edge at the bar's value end instead of centering it over the mark.`,
    suggestion: {
      description:
        "Use params: { anchor: \"middle\" } (the default) to center horizontally over the bar (pair with params.dy for vertical offset). Note: a label inside a stacked segment needs a dedicated position rule because the text layer's y is the segment's cumulative top, not the segment's center.",
      example: { params: { anchor: "middle" } },
    },
  };
}

function buildFlippedAdvisory(label: LabelLayerInfo, bar: BarLayerInfo): SpecAdvisory {
  const offsetParts: string[] = [];
  if (label.dx !== undefined) offsetParts.push(`dx: ${label.dx}`);
  if (label.dy !== undefined) offsetParts.push(`dy: ${label.dy}`);
  const offsetDetail = offsetParts.length === 0 ? "" : ` with ${offsetParts.join(", ")}`;
  return {
    code: "bar-end-label-offset",
    path: `/layers/${label.index}/params/anchor`,
    message: `This ${label.geom} layer sets params.anchor "${label.anchor}"${offsetDetail} over ${bar.geom} layer ${bar.index} under coord: { type: "flip" } — params.anchor aligns horizontally at the bar's value end (y axis) and params.dx shifts vertically off the bar's centerline (whereas params.dy shifts horizontally: negative past the bar end, positive inside the bar).`,
    suggestion: {
      description:
        'For labels past the bar end, use params: { anchor: "start", dy: -6 } (or position: "nudge" with positive positionParams.y, and dx: 0 or omitted). For labels inside the bar end, use params: { anchor: "end", dy: 6 }. Note: a label inside a stacked segment needs a dedicated position rule because the text layer\'s y is the segment\'s cumulative top, not the segment\'s center.',
      example:
        label.anchor === "end"
          ? { params: { anchor: "end", dy: 6 } }
          : { params: { anchor: "start", dy: -6 } },
    },
  };
}

function collectLayers(layers: readonly unknown[], plotAes: Aes | undefined) {
  const bars: BarLayerInfo[] = [];
  const labels: LabelLayerInfo[] = [];
  for (let i = 0; i < layers.length; i++) {
    const bar = extractBarLayer(layers[i], i, plotAes);
    if (bar !== null) bars.push(bar);
    const label = extractLabelLayer(layers[i], i, plotAes);
    if (label !== null) labels.push(label);
  }
  return { bars, labels };
}

/**
 * Advisories for `text`/`label` layers placing `anchor: "start" | "end"` at
 * a `col`/`bar` value end (`needs: "spec"`).
 */
export function collectBarEndLabelAdvisories(
  spec: Record<string, unknown>,
  layerEvidence?: readonly (FieldEvidenceMap | null)[] | null,
  evidence?: FieldEvidenceMap | null,
): SpecAdvisory[] {
  const layers = spec["layers"];
  if (!Array.isArray(layers) || layers.length < 2) return [];
  const coordType = isRecord(spec["coord"]) ? spec["coord"]["type"] : undefined;
  if (coordType === "radial") return [];

  const isFlipped = coordType === "flip";
  const plotAes = isRecord(spec["aes"]) ? (spec["aes"] as Aes) : undefined;
  const { bars, labels } = collectLayers(layers, plotAes);
  if (bars.length === 0 || labels.length === 0) return [];

  const facetAxes = extractFacetAxes(spec);
  const fieldsFor = (index: number): FieldEvidenceMap | null =>
    layerEvidence !== undefined && layerEvidence !== null
      ? (layerEvidence[index] ?? null)
      : (evidence ?? null);

  const advisories: SpecAdvisory[] = [];
  for (const label of labels) {
    if (isFlipped && isCleanFlippedOffset(label)) continue;
    const labelFields = fieldsFor(label.index);
    const matchedBar = bars.find(
      (bar) =>
        channelsMatch(bar, label) && panelsOverlap(facetAxes, fieldsFor(bar.index), labelFields),
    );
    if (matchedBar !== undefined) {
      advisories.push(
        isFlipped
          ? buildFlippedAdvisory(label, matchedBar)
          : buildCartesianAdvisory(label, matchedBar),
      );
    }
  }
  return advisories;
}
