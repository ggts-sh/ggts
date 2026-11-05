/**
 * Polar projection of completed geometry batches (rects → annular sectors).
 */
import type { PanelCoordProjector } from "../coord-projector.js";
import type { GeometryBatch, PathsBatch, RectsBatch } from "../scene.js";

import {
  MAX_COORD_VERTICES_PER_SUBPATH,
  projectPoint,
  type CoordTessellationBudget,
} from "./coord-tessellation.js";
import type { PipelineWarning } from "./types.js";

/** Samples per rect edge under polar (outer/inner arcs need denser sampling). */
const POLAR_RECT_EDGE_SAMPLES = 16;

/**
 * Convert axis-aligned panel rects into closed polar sector paths and project
 * point/glyph anchors. Mutates `batches` in place where possible; rect batches
 * are replaced with path batches in the returned array.
 */
export function projectPolarGeometryBatches(
  batches: GeometryBatch[],
  projector: PanelCoordProjector,
  width: number,
  height: number,
  _warnings: PipelineWarning[],
  _sharedBudget?: CoordTessellationBudget,
): GeometryBatch[] {
  if (projector.polar === undefined) return batches;
  const out: GeometryBatch[] = [];
  for (const batch of batches) {
    if (batch.kind === "rects") {
      out.push(rectsToPolarPaths(batch, projector, width, height));
      continue;
    }
    if (batch.kind === "points" || batch.kind === "glyphs") {
      const pos = batch.positions;
      for (let i = 0; i < pos.length; i += 2) {
        const [x, y] = projectPoint(projector, width, height, pos[i]!, pos[i + 1]!);
        pos[i] = x;
        pos[i + 1] = y;
      }
      out.push(batch);
      continue;
    }
    // paths / segments: handled by projectGeometryBatch tessellation
    out.push(batch);
  }
  return out;
}

function rectsToPolarPaths(
  batch: RectsBatch,
  projector: PanelCoordProjector,
  width: number,
  height: number,
): PathsBatch {
  const n = batch.rects.length / 4;
  const positions: number[] = [];
  const rowIndex: number[] = [];
  const pathOffsets: number[] = [0];
  const semanticAnchors: number[] = [];
  const semanticIndex: number[] = [];
  const fills: (string | null)[] = [];
  const strokes: (string | null)[] = [];
  const alphas: number[] = [];
  const hasAlphas = batch.alphas !== undefined;
  const hasStrokeWidths = batch.strokeWidths !== undefined;
  const strokeWidths: number[] = [];
  const hasLinetypes = batch.linetypeIndexes !== undefined;
  const linetypeIndexes: number[] = [];

  for (let i = 0; i < n; i++) {
    const path = polarRectPath(batch, i, projector, width, height);
    appendPolarRect(
      path,
      batch,
      i,
      positions,
      rowIndex,
      semanticAnchors,
      semanticIndex,
      pathOffsets,
      fills,
      strokes,
      alphas,
      strokeWidths,
      linetypeIndexes,
      hasAlphas,
      hasStrokeWidths,
      hasLinetypes,
    );
  }

  const hasStroke =
    strokes.some((s) => s !== null) || batch.strokeWidth !== undefined || hasStrokeWidths;
  const pathBatch: PathsBatch = {
    kind: "paths",
    layerIndex: batch.layerIndex,
    panelIndex: batch.panelIndex,
    positions: Float32Array.from(positions),
    rowIndex: Uint32Array.from(rowIndex),
    semanticAnchors: Uint8Array.from(semanticAnchors),
    semanticIndex: Uint32Array.from(semanticIndex),
    pathOffsets: Uint32Array.from(pathOffsets),
    strokes,
    fills,
    closed: true,
    // Preserve author outlines: explicit strokeWidth, else a 1px hairline when a
    // stroke color is present. No stroke color + no width → unstroked sectors.
    linewidth: batch.strokeWidth ?? (hasStroke ? 1 : 0),
    alpha: hasAlphas ? 1 : batch.alpha,
    curve: "linear",
  };
  if (hasAlphas) pathBatch.alphas = Float32Array.from(alphas);
  if (hasStrokeWidths) pathBatch.linewidths = Float32Array.from(strokeWidths);
  if (batch.linetype !== undefined) pathBatch.linetype = batch.linetype;
  if (hasLinetypes) pathBatch.linetypeIndexes = Uint8Array.from(linetypeIndexes);
  if (batch.frameRowIndex !== undefined) pathBatch.frameRowIndex = batch.frameRowIndex;
  if (batch.fillPaint !== undefined) pathBatch.fillPaint = batch.fillPaint;
  if (batch.strokePaint !== undefined) pathBatch.strokePaint = batch.strokePaint;
  if (batch.glow !== undefined) pathBatch.glow = batch.glow;
  return pathBatch;
}

function polarRectPath(
  batch: RectsBatch,
  index: number,
  projector: PanelCoordProjector,
  width: number,
  height: number,
): number[] {
  const o = index * 4;
  const x = batch.rects[o]!;
  const y = batch.rects[o + 1]!;
  const w = batch.rects[o + 2]!;
  const h = batch.rects[o + 3]!;
  const corners: Array<readonly [number, number]> = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
  const ring: number[] = [];
  for (let e = 0; e < 4; e++) {
    const [x0, y0] = corners[e]!;
    const [x1, y1] = corners[(e + 1) % 4]!;
    for (let s = 0; s < POLAR_RECT_EDGE_SAMPLES; s++) {
      const t = s / POLAR_RECT_EDGE_SAMPLES;
      const [qx, qy] = projectPoint(
        projector,
        width,
        height,
        x0 + (x1 - x0) * t,
        y0 + (y1 - y0) * t,
      );
      ring.push(qx, qy);
    }
  }
  return ring;
}

function appendPolarRect(
  path: readonly number[],
  batch: RectsBatch,
  index: number,
  positions: number[],
  rowIndex: number[],
  semanticAnchors: number[],
  semanticIndex: number[],
  pathOffsets: number[],
  fills: (string | null)[],
  strokes: (string | null)[],
  alphas: number[],
  strokeWidths: number[],
  linetypeIndexes: number[],
  hasAlphas: boolean,
  hasStrokeWidths: boolean,
  hasLinetypes: boolean,
): void {
  const vertCount = Math.min(path.length / 2, MAX_COORD_VERTICES_PER_SUBPATH);
  const row = batch.rowIndex[index] ?? 0xffffffff;
  for (let v = 0; v < vertCount; v++) {
    positions.push(path[v * 2]!, path[v * 2 + 1]!);
    rowIndex.push(row);
    semanticAnchors.push(v === 0 ? 1 : 0);
    semanticIndex.push(index);
  }
  pathOffsets.push(positions.length / 2);
  fills.push(batch.fills?.[index] ?? batch.fill);
  const stroke = batch.strokes?.[index] ?? (batch.stroke === undefined ? null : batch.stroke);
  strokes.push(stroke);
  if (hasAlphas) alphas.push(batch.alphas![index] ?? batch.alpha);
  if (hasStrokeWidths) strokeWidths.push(batch.strokeWidths![index] ?? batch.strokeWidth ?? 1);
  if (hasLinetypes) linetypeIndexes.push(batch.linetypeIndexes![index] ?? 0);
}
