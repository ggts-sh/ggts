/**
 * Stacked-band visibility diagnostic (#1883).
 *
 * A stack with many groups compresses some bands below the point of
 * visibility. When the fill legend still lists every key, the reader cannot
 * tell which keys the panel hides. This collector reads the committed panel
 * placements and post-position frame bounds, measures each group's thickest
 * band in rendered pixels, and emits at most one aggregated warning naming
 * the groups that never reach the threshold.
 *
 * The measurement assumes a linear value→pixel mapping: plain, flipped, and
 * fixed-aspect Cartesian coordinates qualify, as does a coordinate transform
 * whose y projection is identity with no viewport limits (`reverse` only
 * mirrors the panel, leaving thickness unchanged). Radial, sf, limited, and
 * nonlinear-y transforms are skipped.
 */
import type { PortableSpec } from "@ggts-sh/spec";

import type { PositionScale } from "../scales/train.js";
import type { CellValue } from "../table.js";

import type { PanelLayoutResult, PanelPlacement } from "./panel-layout-types.js";
import type { PreparedPanels } from "./prepare-panels.js";
import { isBarLike } from "./scale-axis-types.js";
import type { TrainedPipelineScales } from "./train-pipeline-scales.js";
import type { FinalizedLayerFrame } from "./types-layer-frame.js";
import type { PipelineWarning } from "./types.js";

/** Minimum visible band thickness in px; issue #1883 starting threshold. */
const MIN_STACK_BAND_PX = 2;

/** Cap on named groups in one warning before `+N more`. */
const MAX_WARNING_GROUP_NAMES = 8;

export interface StackBandDiagnosticsInput {
  prepared: PreparedPanels;
  trained: TrainedPipelineScales;
  panelLayout: PanelLayoutResult;
  /** coord_flip renders the value axis along the panel width. */
  flip: boolean;
  /** Coordinate system; only a linear value→pixel y projection is measurable. */
  coord: PortableSpec["coord"];
}

interface MeasuredBand {
  layer: number;
  label: string;
  maxPx: number;
}

/** True when the y coordinate projection keeps a linear value→pixel mapping. */
function hasLinearValueAxis(coord: PortableSpec["coord"]): boolean {
  if (coord === undefined) return true;
  const type = coord.type;
  if (type === "cartesian" || type === "flip" || type === "fixed") return true;
  if (type !== "transform") return false;
  const y = coord.y;
  return y === undefined || (y.transform === "identity" && y.limits === undefined);
}

/**
 * Legend labels keyed by `String(value)` for the rendered discrete fill
 * legend, or `null` when no such legend exists. Without swatches the warning's
 * premise ("the legend shows keys the panel hides") does not hold.
 */
function discreteFillLegendLabels(panelLayout: PanelLayoutResult): Map<string, string> | null {
  let labels: Map<string, string> | null = null;
  for (const legend of panelLayout.legendBlock.legends) {
    if (legend.type !== "discrete" || legend.scale !== "fill") continue;
    labels ??= new Map();
    for (const entry of legend.entries) labels.set(String(entry.value), entry.label);
  }
  return labels;
}

/**
 * Per-group legend label and band key, built once per frame so the row loop
 * allocates nothing. Fill values are mapped through the rendered legend entry
 * labels; null/NA fill falls back to `group N`.
 */
function groupBandInfo(
  frame: FinalizedLayerFrame,
  layerIndex: number,
  legendLabels: Map<string, string>,
): Map<number, { label: string; key: string }> {
  const info = new Map<number, { label: string; key: string }>();
  for (let row = 0; row < frame.n; row++) {
    const group = frame.groups[row] ?? 0;
    if (info.has(group)) continue;
    const value: CellValue | undefined = frame.fillValues?.[row] ?? undefined;
    let label =
      value === null || value === undefined
        ? ""
        : (legendLabels.get(String(value)) ?? String(value));
    if (label === "") label = `group ${group + 1}`;
    info.set(group, { label, key: `${layerIndex}\u0000${label}` });
  }
  return info;
}

/**
 * Whether some x slot in this frame holds at least two distinct groups — a
 * real stack. A degenerate stack (fill === x, one row per slot) renders
 * ordinary bars and must not trip the warning.
 */
function hasStackedXSlot(frame: FinalizedLayerFrame): boolean {
  const firstGroupBySlot = new Map<string | number, number>();
  for (let row = 0; row < frame.n; row++) {
    const numeric = frame.xNumeric?.[row];
    const key = numeric ?? String(frame.xValues?.[row]);
    const group = frame.groups[row] ?? 0;
    const first = firstGroupBySlot.get(key);
    if (first === undefined) firstGroupBySlot.set(key, group);
    else if (first !== group) return true;
  }
  return false;
}

/** Merge one measured band into the per-(layer, label) maxima. */
function recordBand(
  bands: Map<string, MeasuredBand>,
  key: string,
  layer: number,
  label: string,
  thickness: number,
): void {
  const existing = bands.get(key);
  if (existing === undefined) {
    bands.set(key, { layer, label, maxPx: thickness });
  } else {
    existing.maxPx = Math.max(existing.maxPx, thickness);
  }
}

/**
 * Measure one layer's frame in one panel, recording each group's thickest
 * band. Skips panels where no key exists or no band can be visible.
 */
function measurePanelBands(
  frame: FinalizedLayerFrame | undefined,
  layerIndex: number,
  placement: PanelPlacement | undefined,
  scale: PositionScale | undefined,
  flip: boolean,
  legendLabels: Map<string, string>,
  bands: Map<string, MeasuredBand>,
): void {
  if (frame === undefined || frame.n === 0 || frame.ymin === null || frame.ymax === null) {
    return;
  }
  // No legend key exists for rows the layer itself does not map to fill.
  if (frame.fillValues === null) return;
  if (placement === undefined || scale === undefined || scale.type === "band") return;
  const extent = flip ? placement.width : placement.height;
  // A sub-threshold panel has no room for a visible band.
  if (!(Number.isFinite(extent) && extent >= MIN_STACK_BAND_PX)) return;
  if (!hasStackedXSlot(frame)) return;

  const infoByGroup = groupBandInfo(frame, layerIndex, legendLabels);
  for (let row = 0; row < frame.n; row++) {
    const ymin = frame.ymin[row];
    const ymax = frame.ymax[row];
    if (ymin === undefined || ymax === undefined) continue;
    const t0 = scale.normalizeTransformed(ymin);
    const t1 = scale.normalizeTransformed(ymax);
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) continue;
    const info = infoByGroup.get(frame.groups[row] ?? 0);
    if (info === undefined) continue;
    recordBand(bands, info.key, layerIndex, info.label, Math.abs(t1 - t0) * extent);
  }
}

/** Collect every measured band that stays under the visibility threshold. */
function hiddenBands(
  input: StackBandDiagnosticsInput,
  legendLabels: Map<string, string>,
): MeasuredBand[] {
  const { prepared, trained, panelLayout, flip } = input;
  const bands = new Map<string, MeasuredBand>();

  for (let index = 0; index < prepared.bindings.length; index++) {
    const layer = prepared.bindings[index]!.layer;
    if (!isBarLike(layer.geom)) continue;
    const position = layer.position ?? "identity";
    if (position !== "stack" && position !== "fill") continue;

    for (let panel = 0; panel < prepared.panelFrames.length; panel++) {
      measurePanelBands(
        prepared.panelFrames[panel]?.[index],
        index,
        panelLayout.placements[panel],
        trained.panelScales[panel]?.y,
        flip,
        legendLabels,
        bands,
      );
    }
  }

  return [...bands.values()].filter((band) => band.maxPx < MIN_STACK_BAND_PX);
}

function formatLayers(indices: readonly number[]): string {
  if (indices.length === 1) return `layer ${indices[0]}`;
  if (indices.length === 2) return `layers ${indices[0]} and ${indices[1]}`;
  return `layers ${indices.slice(0, -1).join(", ")}, and ${indices.at(-1)}`;
}

function formatGroups(labels: readonly string[]): string {
  if (labels.length <= MAX_WARNING_GROUP_NAMES) return labels.join(", ");
  const shown = labels.slice(0, MAX_WARNING_GROUP_NAMES);
  return `${shown.join(", ")}, +${labels.length - MAX_WARNING_GROUP_NAMES} more`;
}

/** Build the single aggregated warning for the hidden bands. */
function hiddenBandWarning(hidden: readonly MeasuredBand[]): PipelineWarning {
  const groupNames = [...new Set(hidden.map((band) => band.label))];
  const layers = [...new Set(hidden.map((band) => band.layer))].toSorted((a, b) => a - b);

  return {
    code: "stack-band-hidden",
    message:
      `Stacked bands for ${groupNames.length === 1 ? "group" : "groups"} ` +
      `${formatGroups(groupNames)} in ${formatLayers(layers)} ` +
      `never reach ${MIN_STACK_BAND_PX} px of thickness at the rendered size — ` +
      "the legend shows keys the panel hides. " +
      'Merge small groups into "Other", facet by group with free y scales, ' +
      'use position: "fill" to compare shares, or draw one line per group on a log y scale.',
  };
}

/**
 * Compute the hidden-band warning. At most one warning aggregates every layer
 * and group whose thickest measured band never reaches the threshold.
 */
export function collectStackBandWarnings(input: StackBandDiagnosticsInput): PipelineWarning[] {
  if (!hasLinearValueAxis(input.coord)) return [];
  const legendLabels = discreteFillLegendLabels(input.panelLayout);
  if (legendLabels === null) return [];
  const hidden = hiddenBands(input, legendLabels);
  if (hidden.length === 0) return [];
  return [hiddenBandWarning(hidden)];
}
