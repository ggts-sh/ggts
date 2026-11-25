import type { BarsColumns } from "../scenarios";

export function pivotStackedBars(bars: BarsColumns) {
  const rows = new Map<string, Record<string, string | number>>();
  for (let i = 0; i < bars.category.length; i++) {
    const category = bars.category[i]!;
    let row = rows.get(category);
    if (row === undefined) {
      row = { category };
      rows.set(category, row);
    }
    row[bars.stack[i]!] = bars.value[i]!;
  }
  return {
    categories: [...rows.keys()],
    stacks: [...new Set(bars.stack)],
    wide: [...rows.values()],
  };
}
