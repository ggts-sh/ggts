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
  const x = measureLabelAxis(boxes, n, 0);
  const y = measureLabelAxis(boxes, n, 1);
  const bandAxis = x.count > y.count ? x : y;
  const grid = !options.clip && n >= 1_024 ? createLabelGrid(boxes, n, x, y) : undefined;
  const bands = grid ?? createLabelBands(boxes, bandAxis);
  const overlapping = new Uint8Array(n);
  const dropped: number[] = [];
  let count = 0;
  // Keep each label that overlaps no label kept before it.
  for (let i = 0; i < n; i++) {
    if (!hasArea(boxes, i)) continue;
    if (bands.overlaps(i) > 0) {
      overlapping[i] = 1;
      count++;
      dropped.push(i);
    } else {
      bands.add(i);
    }
  }
  if (checkOverlap) {
    if (count > 0) compactGlyphs(batch, overlapping);
    return;
  }
  // Kept labels do not overlap each other, so a kept label overlaps another
  // label only when a dropped label touches it.
  for (const i of dropped) count += bands.overlaps(i, overlapping);
  if (count > 0)
    warnings.push({
      code: "text-label-overlap",
      message: `${count} labels overlap another label in layer ${batch.layerIndex}, panel ${batch.panelIndex}. Set params.checkOverlap to true to omit later overlapping labels.`,
    });
}

function hasArea(boxes: Float64Array, i: number): boolean {
  const a = i * 4;
  return boxes[a]! < boxes[a + 2]! && boxes[a + 1]! < boxes[a + 3]!;
}

function boxesOverlap(boxes: Float64Array, i: number, j: number): boolean {
  const a = i * 4;
  const b = j * 4;
  return (
    boxes[a]! < boxes[b + 2]! &&
    boxes[b]! < boxes[a + 2]! &&
    boxes[a + 1]! < boxes[b + 3]! &&
    boxes[b + 1]! < boxes[a + 3]!
  );
}

function measureLabelAxis(boxes: Float64Array, n: number, axis: 0 | 1) {
  let start = Infinity;
  let end = -Infinity;
  let totalLength = 0;
  let measured = 0;
  let maxLength = 0;
  let minLength = Infinity;
  for (let i = 0; i < n; i++) {
    if (!hasArea(boxes, i)) continue;
    const offset = i * 4 + axis;
    const first = boxes[offset]!;
    const last = boxes[offset + 2]!;
    const length = last - first;
    start = Math.min(start, first);
    end = Math.max(end, last);
    totalLength += length;
    measured++;
    maxLength = Math.max(maxLength, length);
    minLength = Math.min(minLength, length);
  }
  // A non-finite box gives one band. A far outlier gives coarse bands, which
  // costs time and never changes the result.
  const wanted = Math.ceil(((end - start) * measured) / totalLength);
  return {
    axis,
    start,
    end,
    count: wanted >= 1 ? Math.min(wanted, n) : 1,
    maxLength,
    minLength,
  };
}

/**
 * Kept label boxes in bands about one mean label long, cut along the axis that
 * gives more bands. A box is listed in each band it touches. Kept boxes do not
 * overlap, so labels inside the panel leave few in each band, and a lookup does
 * not grow with the label count.
 *
 * Large unclipped runs can crowd one band. Use the sparse grid when the
 * caller detects likely aligned labels.
 */
function createLabelBands(
  boxes: Float64Array,
  { axis, start, end, count }: ReturnType<typeof measureLabelAxis>,
) {
  const bandLength = (end - start) / count;
  // Monotonic, so two overlapping boxes always share a band.
  const bandOf = (position: number): number => {
    const band = Math.floor((position - start) / bandLength);
    return band >= 0 ? Math.min(band, count - 1) : 0;
  };
  const bands: number[][] = [];

  return {
    add(i: number): void {
      const last = bandOf(boxes[i * 4 + 2 + axis]!);
      for (let band = bandOf(boxes[i * 4 + axis]!); band <= last; band++) {
        (bands[band] ??= []).push(i);
      }
    },
    /**
     * With no `marks`, returns 1 at the first kept label that overlaps label i, else 0.
     * With `marks`, marks each unmarked kept label that overlaps label i, and returns how many.
     */
    overlaps(i: number, marks?: Uint8Array): number {
      let marked = 0;
      const last = bandOf(boxes[i * 4 + 2 + axis]!);
      for (let band = bandOf(boxes[i * 4 + axis]!); band <= last; band++) {
        for (const j of bands[band] ?? []) {
          if (!boxesOverlap(boxes, i, j)) continue;
          if (marks === undefined) return 1;
          if (marks[j] === 0) {
            marks[j] = 1;
            marked++;
          }
        }
      }
      return marked;
    },
  };
}

/**
 * Large unclipped runs can span vastly more cells than they have labels.
 * Size cells from box extents instead of the position range and allocate
 * buckets only where kept labels occur.
 */
function createLabelGrid(
  boxes: Float64Array,
  n: number,
  xAxis: ReturnType<typeof measureLabelAxis>,
  yAxis: ReturnType<typeof measureLabelAxis>,
) {
  // Sample two boxes two rows apart around the first quarter of the batch.
  const sample = n - (n % 4);
  if (boxes[sample] !== boxes[sample + 8] && boxes[sample + 1] !== boxes[sample + 9]) {
    return;
  }

  const columns = (xAxis.end - xAxis.start) / xAxis.maxLength;
  const rows = (yAxis.end - yAxis.start) / yAxis.maxLength;
  // This bounds the area ratio of any two positive-area boxes. Kept labels
  // are disjoint, so a grid cell can only be occupied by a bounded number.
  const boxAreaRatio = (xAxis.maxLength / xAxis.minLength) * (yAxis.maxLength / yAxis.minLength);
  // Bands handle single rows or columns. Grid indices need safe integer increments.
  if (!(columns > 1 && rows > 1 && Math.max(columns, rows) < 2 ** 53 && boxAreaRatio <= 32)) {
    return;
  }
  const cells = new Map<number, Map<number, number[]>>();

  function visit(i: number, insert: boolean, marks?: Uint8Array): number {
    const offset = i * 4;
    const left = Math.floor((boxes[offset]! - xAxis.start) / xAxis.maxLength);
    const right = Math.floor((boxes[offset + 2]! - xAxis.start) / xAxis.maxLength);
    const top = Math.floor((boxes[offset + 1]! - yAxis.start) / yAxis.maxLength);
    const bottom = Math.floor((boxes[offset + 3]! - yAxis.start) / yAxis.maxLength);
    let marked = 0;
    for (let y = top; y <= bottom; y++) {
      let row = cells.get(y);
      if (!row && insert) {
        row = new Map<number, number[]>();
        cells.set(y, row);
      }
      if (!row) continue;
      for (let x = left; x <= right; x++) {
        const bucket = row.get(x);
        if (insert) {
          if (bucket) bucket.push(i);
          else row.set(x, [i]);
          continue;
        }
        for (const j of bucket ?? []) {
          if (marks?.[j] || !boxesOverlap(boxes, i, j)) continue;
          if (marks === undefined) return 1;
          marks[j] = 1;
          marked++;
        }
      }
    }
    return marked;
  }

  return {
    add(i: number): void {
      visit(i, true);
    },
    overlaps(i: number, marks?: Uint8Array): number {
      return visit(i, false, marks);
    },
  };
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
