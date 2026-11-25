/** Row-major cell index for contour levels. */
export type ContourGrid = readonly (readonly (number | null)[])[];

function firstGreater(levels: readonly number[], value: number): number {
  let low = 0;
  let high = levels.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (levels[middle]! <= value) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Index row-major cells for ascending finite levels with O(grid cells + levels) scratch. */
export function indexCellsByLevel(
  columns: number,
  rows: number,
  grid: ContourGrid,
  levels: readonly number[],
) {
  if (levels.length < 4 || !Number.isSafeInteger(columns * rows)) return null;
  const index: number[][] = Array.from({ length: levels.length }, () => []);
  // Bound scratch even when most cells span many levels.
  let remaining = 4 * columns * rows;
  for (let j = 0; j < rows; j++) {
    const bottom = grid[j]!;
    const top = grid[j + 1]!;
    for (let i = 0; i < columns; i++) {
      const z00 = bottom[i] ?? NaN;
      const z10 = bottom[i + 1] ?? NaN;
      const z01 = top[i] ?? NaN;
      const z11 = top[i + 1] ?? NaN;
      const min = Math.min(z00, z10, z01, z11);
      const max = Math.max(z00, z10, z01, z11);
      if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) continue;
      const from = firstGreater(levels, min);
      const to = firstGreater(levels, max);
      remaining -= to - from;
      if (remaining < 0) return null;
      const cell = j * columns + i;
      for (let level = from; level < to; level++) index[level]!.push(cell);
    }
  }
  return index;
}
