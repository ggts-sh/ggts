import type { GlyphsBatch } from "../scene.js";
import type { PipelineWarning } from "./types.js";

interface OverlapOptions {
  withBox: boolean;
  checkOverlap: boolean;
  width: number;
  height: number;
  clip: boolean;
}

/** Check final panel-local glyph boxes, not data-space distances or hit padding. */
export function checkTextLabelOverlap(
  batch: GlyphsBatch,
  options: OverlapOptions,
  warnings: PipelineWarning[],
): void {
  const { checkOverlap } = options;
  const n = batch.texts.length;
  if (n < 2) return;
  const boxes = glyphBounds(batch, options);
  const overlapping = new Uint8Array(n);
  let count = 0;
  // ponytail: pairwise checks are quadratic; use a spatial index if dense label layers become a bottleneck.
  for (let i = 0; i < n; i++) {
    const a = i * 4;
    if (!(boxes[a]! < boxes[a + 2]! && boxes[a + 1]! < boxes[a + 3]!)) continue;
    for (let j = 0; j < i; j++) {
      const b = j * 4;
      if (checkOverlap && overlapping[j] === 1) continue;
      if (
        boxes[b]! < boxes[b + 2]! &&
        boxes[b + 1]! < boxes[b + 3]! &&
        boxes[a]! < boxes[b + 2]! &&
        boxes[b]! < boxes[a + 2]! &&
        boxes[a + 1]! < boxes[b + 3]! &&
        boxes[b + 1]! < boxes[a + 3]!
      ) {
        if (overlapping[i] === 0) {
          overlapping[i] = 1;
          count++;
        }
        if (checkOverlap) break;
        if (overlapping[j] === 0) {
          overlapping[j] = 1;
          count++;
        }
      }
    }
  }
  if (checkOverlap) {
    if (count > 0) compactGlyphs(batch, overlapping);
    return;
  }
  if (count > 0)
    warnings.push({
      code: "text-label-overlap",
      message: `${count} labels overlap another label in layer ${batch.layerIndex}, panel ${batch.panelIndex}. Set params.checkOverlap to true to omit later overlapping labels.`,
    });
}

function glyphBounds(batch: GlyphsBatch, options: OverlapOptions): Float64Array {
  const { withBox, clip } = options;
  const n = batch.texts.length;
  const padding = batch.boxPadding ?? 0;
  const extra = withBox ? (batch.boxStrokeWidth ?? 0.5) / 2 : -padding;
  const boxes = new Float64Array(n * 4);
  for (let i = 0; i < n; i++) {
    if ((!withBox && batch.texts[i] === "") || (batch.alphas?.[i] ?? batch.alpha) <= 0) continue;
    const width = batch.boxWidths![i]! + 2 * extra;
    const height = batch.boxHeights![i]! + 2 * extra;
    const x = batch.positions[i * 2]!;
    const y = batch.positions[i * 2 + 1]!;
    const left =
      batch.anchor === "start"
        ? x - padding - extra
        : batch.anchor === "end"
          ? x + padding + extra - width
          : x - width / 2;
    boxes[i * 4] = clip ? Math.max(0, left) : left;
    boxes[i * 4 + 1] = clip ? Math.max(0, y - height / 2) : y - height / 2;
    boxes[i * 4 + 2] = clip ? Math.min(options.width, left + width) : left + width;
    boxes[i * 4 + 3] = clip ? Math.min(options.height, y + height / 2) : y + height / 2;
  }
  return boxes;
}

function compactGlyphs(batch: GlyphsBatch, removed: Uint8Array): void {
  let kept = 0;
  const numericFields = ["sizes", "alphas", "boxWidths", "boxHeights"] as const;
  const stringFields = ["texts", "colors", "boxFills", "boxStrokes"] as const;
  for (let i = 0; i < removed.length; i++) {
    if (removed[i] === 1) continue;
    if (kept !== i) {
      batch.positions[kept * 2] = batch.positions[i * 2]!;
      batch.positions[kept * 2 + 1] = batch.positions[i * 2 + 1]!;
      batch.rowIndex[kept] = batch.rowIndex[i]!;
      for (const key of numericFields) {
        const values = batch[key];
        if (values !== undefined) values[kept] = values[i]!;
      }
      for (const key of stringFields) {
        const values = batch[key];
        if (values !== undefined) values[kept] = values[i]!;
      }
    }
    kept++;
  }
  batch.positions = batch.positions.subarray(0, kept * 2);
  batch.rowIndex = batch.rowIndex.subarray(0, kept);
  for (const key of numericFields) {
    const values = batch[key];
    if (values !== undefined) batch[key] = values.subarray(0, kept);
  }
  for (const key of stringFields) {
    const values = batch[key];
    if (values !== undefined) values.length = kept;
  }
}
