import type { SeriesColumns } from "../scenarios";

export function groupSeriesValues(data: SeriesColumns): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (let i = 0; i < data.series.length; i++) {
    const name = data.series[i]!;
    const value = data.y[i]!;
    const values = groups.get(name);
    if (values === undefined) groups.set(name, [value]);
    else values.push(value);
  }
  return groups;
}
