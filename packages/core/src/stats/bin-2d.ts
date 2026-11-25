/**
 * The bin_2d stat (ggplot2's stat_bin_2d / geom_bin2d).
 *
 * Clean-room from published contracts:
 *  - required inputs: continuous x and y
 *  - generated: count, density, ncount, ndensity; xmin/xmax/ymin/ymax; x/y centers
 *  - default drop=true omits zero-count bins
 *  - weights: missing weights count as 0 (ggplot2)
 *  - missing/non-finite x or y rows dropped
 *
 * Break grids reuse 1D bin-breaks helpers (one shared bins default per axis).
 */
import type { CellValue } from "../table.js";

import { binBreaksBins, binBreaksWidth, binIndexOf } from "./bin-breaks.js";

const SPARSE_CELLS_PER_ROW = 32;

interface Bin2dParamsInput {
  bins?: number | undefined;
  binwidth?: number | undefined;
  drop?: boolean | undefined;
}

export interface Bin2dStatInput {
  x: Float64Array;
  y: Float64Array;
  groups: readonly number[];
  weights?: Float64Array | null;
  carried?: Readonly<Record<string, readonly CellValue[]>>;
  params?: Bin2dParamsInput;
  /** Optional shared x range (fixed-x facets). */
  xRange?: [number, number];
  /** Optional shared y range (fixed-y facets). */
  yRange?: [number, number];
}

export interface Bin2dStatResult {
  x: Float64Array;
  y: Float64Array;
  xmin: Float64Array;
  xmax: Float64Array;
  ymin: Float64Array;
  ymax: Float64Array;
  count: Float64Array;
  density: Float64Array;
  ncount: Float64Array;
  ndensity: Float64Array;
  groups: number[];
  carried: Record<string, CellValue[]>;
  dropped: number;
  usedDefaultBins: boolean;
}

function finiteRange(values: Float64Array): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min > max) return null;
  return [min, max];
}

type BinBreaks = ReturnType<typeof binBreaksBins>;

function indexGroups(input: Bin2dStatInput, rowCount: number) {
  const order: number[] = [];
  const slots = new Map<number, number>();
  const sampleRows: number[] = [];
  for (let i = 0; i < rowCount; i++) {
    const group = input.groups[i]!;
    if (slots.has(group)) continue;
    slots.set(group, order.length);
    order.push(group);
    sampleRows.push(i);
  }
  return { order, slots, sampleRows };
}

function countCells(
  input: Bin2dStatInput,
  rowCount: number,
  xBreaks: BinBreaks,
  yBreaks: BinBreaks,
  groupSlots: Map<number, number>,
) {
  const nx = xBreaks.breaks.length - 1;
  const cellCount = nx * (yBreaks.breaks.length - 1);
  const counts = new Float64Array(groupSlots.size * cellCount);
  let dropped = 0;
  for (let i = 0; i < rowCount; i++) {
    const x = input.x[i]!;
    const y = input.y[i]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      dropped++;
      continue;
    }
    const ix = binIndexOf(x, xBreaks.fuzzy, xBreaks.rightClosed);
    const iy = binIndexOf(y, yBreaks.fuzzy, yBreaks.rightClosed);
    if (ix === -1 || iy === -1) {
      dropped++;
      continue;
    }
    const rawWeight = input.weights?.[i];
    const weight = rawWeight === undefined ? 1 : Number.isFinite(rawWeight) ? rawWeight : 0;
    const slot = groupSlots.get(input.groups[i]!)! * cellCount + iy * nx + ix;
    counts[slot] = counts[slot]! + weight;
  }
  return { counts, dropped };
}

function countSparseCells(
  input: Bin2dStatInput,
  rowCount: number,
  xBreaks: BinBreaks,
  yBreaks: BinBreaks,
  groupSlots: Map<number, number>,
) {
  const nx = xBreaks.breaks.length - 1;
  const counts: Map<number, number>[] = [];
  let dropped = 0;
  for (let i = 0; i < rowCount; i++) {
    const x = input.x[i]!;
    const y = input.y[i]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      dropped++;
      continue;
    }
    const ix = binIndexOf(x, xBreaks.fuzzy, xBreaks.rightClosed);
    const iy = binIndexOf(y, yBreaks.fuzzy, yBreaks.rightClosed);
    if (ix === -1 || iy === -1) {
      dropped++;
      continue;
    }
    const rawWeight = input.weights?.[i];
    const weight = rawWeight === undefined ? 1 : Number.isFinite(rawWeight) ? rawWeight : 0;
    const group = groupSlots.get(input.groups[i]!)!;
    if (weight === 0) continue;
    const cell = iy * nx + ix;
    const bins = (counts[group] ??= new Map());
    const value = (bins.get(cell) ?? 0) + weight;
    if (value === 0) bins.delete(cell);
    else bins.set(cell, value);
  }
  return { counts, dropped };
}

function outputRowCount(
  counts: Float64Array,
  groupCount: number,
  cellCount: number,
  drop: boolean,
) {
  let result = 0;
  for (let group = 0; group < groupCount; group++) {
    for (let cell = 0; cell < cellCount; cell++) {
      if (!drop || counts[group * cellCount + cell] !== 0) result++;
    }
  }
  return result;
}

function density(count: number, area: number, total: number): number {
  return total > 0 && area > 0 ? count / area / total : 0;
}

function normalized(value: number, max: number): number {
  return max > 0 ? value / max : 0;
}

function createOutput(rowCount: number, carriedNames: string[]) {
  const x = new Float64Array(rowCount);
  const y = new Float64Array(rowCount);
  const xmin = new Float64Array(rowCount);
  const xmax = new Float64Array(rowCount);
  const ymin = new Float64Array(rowCount);
  const ymax = new Float64Array(rowCount);
  const count = new Float64Array(rowCount);
  const densities = new Float64Array(rowCount);
  const ncount = new Float64Array(rowCount);
  const ndensity = new Float64Array(rowCount);
  const groups: number[] = [];
  const carried: Record<string, CellValue[]> = {};
  for (const name of carriedNames) carried[name] = [];
  return {
    x,
    y,
    xmin,
    xmax,
    ymin,
    ymax,
    count,
    densities,
    ncount,
    ndensity,
    groups,
    carried,
  };
}

function emitCells(
  input: Bin2dStatInput,
  counts: Float64Array,
  xBreaks: BinBreaks,
  yBreaks: BinBreaks,
  groupOrder: number[],
  sampleRows: number[],
  carriedNames: string[],
  drop: boolean,
  rowCount: number,
) {
  const output = createOutput(rowCount, carriedNames);
  const { x, y, xmin, xmax, ymin, ymax, count, densities, ncount, ndensity, groups, carried } =
    output;

  const nx = xBreaks.breaks.length - 1;
  const ny = yBreaks.breaks.length - 1;
  const cellCount = nx * ny;
  let row = 0;
  for (let group = 0; group < groupOrder.length; group++) {
    let total = 0;
    let maxCount = 0;
    for (let cell = 0; cell < cellCount; cell++) {
      const value = counts[group * cellCount + cell]!;
      total += Math.abs(value);
      if (Math.abs(value) > maxCount) maxCount = Math.abs(value);
    }
    let maxDensity = 0;
    for (let iy = 0; iy < ny; iy++) {
      const height = yBreaks.breaks[iy + 1]! - yBreaks.breaks[iy]!;
      for (let ix = 0; ix < nx; ix++) {
        const width = xBreaks.breaks[ix + 1]! - xBreaks.breaks[ix]!;
        const value = density(counts[group * cellCount + iy * nx + ix]!, width * height, total);
        if (value > maxDensity) maxDensity = value;
      }
    }
    for (let iy = 0; iy < ny; iy++) {
      const yLo = yBreaks.breaks[iy]!;
      const yHi = yBreaks.breaks[iy + 1]!;
      for (let ix = 0; ix < nx; ix++) {
        const xLo = xBreaks.breaks[ix]!;
        const xHi = xBreaks.breaks[ix + 1]!;
        const value = counts[group * cellCount + iy * nx + ix]!;
        if (drop && value === 0) continue;
        const cellDensity = density(value, (xHi - xLo) * (yHi - yLo), total);
        x[row] = (xLo + xHi) / 2;
        y[row] = (yLo + yHi) / 2;
        xmin[row] = xLo;
        xmax[row] = xHi;
        ymin[row] = yLo;
        ymax[row] = yHi;
        count[row] = value;
        densities[row] = cellDensity;
        ncount[row] = normalized(value, maxCount);
        ndensity[row] = normalized(cellDensity, maxDensity);
        groups.push(groupOrder[group]!);
        for (const name of carriedNames) {
          carried[name]!.push(input.carried![name]![sampleRows[group]!]!);
        }
        row++;
      }
    }
  }
  return output;
}

function emitSparseCells(
  input: Bin2dStatInput,
  counts: readonly Map<number, number>[],
  xBreaks: BinBreaks,
  yBreaks: BinBreaks,
  groupOrder: number[],
  sampleRows: number[],
  carriedNames: string[],
  rowCount: number,
) {
  const output = createOutput(rowCount, carriedNames);
  const { x, y, xmin, xmax, ymin, ymax, count, densities, ncount, ndensity, groups, carried } =
    output;

  const nx = xBreaks.breaks.length - 1;
  let row = 0;
  for (let group = 0; group < groupOrder.length; group++) {
    const bins = counts[group];
    if (bins === undefined || bins.size === 0) continue;
    // Match the dense traversal and the order of floating-point additions.
    const cells = [...bins.keys()].toSorted((left, right) => left - right);
    let total = 0;
    let maxCount = 0;
    for (const cell of cells) {
      const magnitude = Math.abs(bins.get(cell)!);
      total += magnitude;
      if (magnitude > maxCount) maxCount = magnitude;
    }
    const start = row;
    let maxDensity = 0;
    for (const cell of cells) {
      const ix = cell % nx;
      const iy = (cell - ix) / nx;
      const value = bins.get(cell)!;
      const xLo = xBreaks.breaks[ix]!;
      const xHi = xBreaks.breaks[ix + 1]!;
      const yLo = yBreaks.breaks[iy]!;
      const yHi = yBreaks.breaks[iy + 1]!;
      const cellDensity = density(value, (xHi - xLo) * (yHi - yLo), total);
      if (cellDensity > maxDensity) maxDensity = cellDensity;
      x[row] = (xLo + xHi) / 2;
      y[row] = (yLo + yHi) / 2;
      xmin[row] = xLo;
      xmax[row] = xHi;
      ymin[row] = yLo;
      ymax[row] = yHi;
      count[row] = value;
      densities[row] = cellDensity;
      ncount[row] = normalized(value, maxCount);
      groups.push(groupOrder[group]!);
      for (const name of carriedNames) {
        carried[name]!.push(input.carried![name]![sampleRows[group]!]!);
      }
      row++;
    }
    for (let i = start; i < row; i++) ndensity[i] = normalized(densities[i]!, maxDensity);
  }
  return output;
}

export function statBin2d(input: Bin2dStatInput): Bin2dStatResult {
  const { x, y } = input;
  const params = input.params ?? {};
  const drop = params.drop !== false;
  const carriedNames = Object.keys(input.carried ?? {});
  const usedDefaultBins = params.bins === undefined && params.binwidth === undefined;
  const nIn = Math.min(x.length, y.length);

  const empty = (dropped: number): Bin2dStatResult => ({
    x: new Float64Array(0),
    y: new Float64Array(0),
    xmin: new Float64Array(0),
    xmax: new Float64Array(0),
    ymin: new Float64Array(0),
    ymax: new Float64Array(0),
    count: new Float64Array(0),
    density: new Float64Array(0),
    ncount: new Float64Array(0),
    ndensity: new Float64Array(0),
    groups: [],
    carried: Object.fromEntries(carriedNames.map((n) => [n, []])),
    dropped,
    usedDefaultBins,
  });

  const dataXRange = finiteRange(x);
  const dataYRange = finiteRange(y);
  if (dataXRange === null || dataYRange === null) return empty(nIn);

  const closed = "right" as const;
  const xRange = input.xRange ?? dataXRange;
  const yRange = input.yRange ?? dataYRange;
  const bins = params.bins ?? 30;
  const xBreaks =
    params.binwidth === undefined
      ? binBreaksBins(xRange, bins, undefined, undefined, closed)
      : binBreaksWidth(xRange, params.binwidth, undefined, undefined, closed);
  const yBreaks =
    params.binwidth === undefined
      ? binBreaksBins(yRange, bins, undefined, undefined, closed)
      : binBreaksWidth(yRange, params.binwidth, undefined, undefined, closed);
  const nx = xBreaks.breaks.length - 1;
  const ny = yBreaks.breaks.length - 1;
  if (nx <= 0 || ny <= 0) return empty(nIn);

  const { order: groupOrder, slots: groupSlot, sampleRows: sampleRow } = indexGroups(input, nIn);
  const gCount = groupOrder.length;
  const cellCount = nx * ny;
  let output: ReturnType<typeof createOutput>;
  let dropped: number;
  // Even with one occupied cell per input row, this grid is mostly empty.
  if (drop && Number.isSafeInteger(cellCount) && gCount * cellCount > SPARSE_CELLS_PER_ROW * nIn) {
    const sparse = countSparseCells(input, nIn, xBreaks, yBreaks, groupSlot);
    dropped = sparse.dropped;
    const nOut = sparse.counts.reduce((sum, cells) => sum + cells.size, 0);
    if (nOut === 0) return empty(dropped);
    output = emitSparseCells(
      input,
      sparse.counts,
      xBreaks,
      yBreaks,
      groupOrder,
      sampleRow,
      carriedNames,
      nOut,
    );
  } else {
    const dense = countCells(input, nIn, xBreaks, yBreaks, groupSlot);
    dropped = dense.dropped;
    const nOut = outputRowCount(dense.counts, gCount, cellCount, drop);
    if (nOut === 0) return empty(dropped);
    output = emitCells(
      input,
      dense.counts,
      xBreaks,
      yBreaks,
      groupOrder,
      sampleRow,
      carriedNames,
      drop,
      nOut,
    );
  }

  return {
    x: output.x,
    y: output.y,
    xmin: output.xmin,
    xmax: output.xmax,
    ymin: output.ymin,
    ymax: output.ymax,
    count: output.count,
    density: output.densities,
    ncount: output.ncount,
    ndensity: output.ndensity,
    groups: output.groups,
    carried: output.carried,
    dropped,
    usedDefaultBins,
  };
}
