/** Occupied one-dimensional histogram bins in first-seen group order. */
import { binIndexOf, type Breaks } from "./bin-breaks.js";

interface GroupBins {
  group: number;
  bins: Map<number, number[]>;
}

export function collectOccupiedBins(
  x: Float64Array,
  groups: readonly number[],
  breaks: Breaks,
  y?: Float64Array,
) {
  const occupied = new Map<number, GroupBins>();
  const binCount = breaks.breaks.length - 1;
  let dropped = 0;
  for (let i = 0; i < x.length; i++) {
    const value = x[i]!;
    if (!Number.isFinite(value) || (y !== undefined && !Number.isFinite(y[i]))) {
      dropped++;
      continue;
    }
    const bin = binIndexOf(value, breaks.fuzzy, breaks.rightClosed);
    if (bin < 0 || bin >= binCount) {
      dropped++;
      continue;
    }
    const group = groups[i]!;
    let groupBins = occupied.get(group);
    if (groupBins === undefined) {
      // Retain the first original key, including negative zero.
      groupBins = { group, bins: new Map() };
      occupied.set(group, groupBins);
    }
    const rows = groupBins.bins.get(bin);
    if (rows === undefined) groupBins.bins.set(bin, [i]);
    else rows.push(i);
  }
  return { occupied, dropped };
}

/** Ascending occupied bins; scanning the grid caps work for dense groups. */
export function orderedOccupiedBins(bins: ReadonlyMap<number, number[]>, binCount: number) {
  const count = bins.size;
  if (count <= 1 || count * Math.log2(count) <= binCount) {
    return [...bins].toSorted(([left], [right]) => left - right);
  }
  const ordered: [number, number[]][] = [];
  for (let bin = 0; bin < binCount; bin++) {
    const rows = bins.get(bin);
    if (rows !== undefined) ordered.push([bin, rows]);
  }
  return ordered;
}
