/**
 * Layer lint rules for per-period totals on regular calendar grids:
 *  - area-over-period-totals (issue #1882): an `area` layer whose x sits on a
 *    regular calendar grid (year/quarter/month starts, or integer years on a
 *    linear scale) while its y holds one total per period. Two signals reach
 *    this rule: an interior gap (fires on its own) or fewer than 30 distinct x
 *    with non-negative jagged integer counts (`countsShaped`).
 *  - line-over-period-totals (issue #1963): a `line` or `step` layer (with
 *    identity/default stat) over the same regular grid with >= 8 distinct
 *    periods (no upper cap) and `countsShaped` y values.
 *
 * Layer rules: lint-layer-rules.ts. Orchestrator: lint.ts.
 */
import { LINT_CATALOG } from "./lint-catalog.js";
import { MIN_YEAR_LIKE_SAMPLES, YEAR_LIKE_MIN } from "./lint-scale-rules.js";
import type { SpecAdvisory } from "./lint.js";
import type { Aes, CellValue } from "./schema.js";
import { parseTemporalColumn } from "./temporal-column.js";
import {
  effectiveChannel,
  type FieldEvidenceEntry,
  type FieldEvidenceMap,
} from "./validate-data.js";
import { isRecord } from "./validate-structure-layer-shared.js";

/** About 30 x values per the issue heuristic: too few to read as a surface. */
const MAX_PERIOD_GRID_POINTS = 30;
/** Minimum distinct periods for line/step per-period totals (no upper cap). */
const MIN_LINE_PERIOD_GRID_POINTS = 8;
/** Month indices a quarter-start grid may land on (Jan/Apr/Jul/Oct). */
const QUARTER_START_MONTHS: ReadonlySet<number> = new Set([0, 3, 6, 9]);
/**
 * Charted integer years run to about 2500. YEAR_LIKE_MAX (10_000) stays wider
 * because fractional-calendar-year detection needs it; admitting the full
 * range here would read rpm or magnitude look-alikes as year grids.
 */
const INTEGER_YEAR_GRID_MAX = 2500;

/** A regular period grid detected on a layer's x column. */
interface PeriodGrid {
  /** Grid name for advisory copy ("year grid", "integer-year grid"). */
  label: string;
  /** What every x value is ("every value is 1 January"). */
  detail: string;
  /** Epoch-ms (temporal) or the numeric year itself, per input index. */
  order: number[];
}

/**
 * Temporal grid: every non-null value parses, and every parsed value is a
 * year/quarter/month start in UTC. DateTime values with non-midnight times
 * still pass when UTC month/day match.
 */
function temporalGrid(values: readonly CellValue[], entry: FieldEvidenceEntry): PeriodGrid | null {
  if (entry.temporal?.status !== "temporal") return null;
  const parsed = parseTemporalColumn(values);
  const order: number[] = [];
  const distinct = new Set<number>();
  let year = true;
  let quarter = true;
  let monthStart = true;
  for (let index = 0; index < values.length; index++) {
    const epoch = parsed.semantic[index]!;
    order.push(epoch);
    if (values[index] === null || values[index] === undefined) continue;
    if (parsed.valid[index] !== 1 || !Number.isFinite(epoch)) return null;
    const date = new Date(epoch);
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    distinct.add(epoch);
    monthStart &&= day === 1;
    quarter &&= day === 1 && QUARTER_START_MONTHS.has(month);
    year &&= day === 1 && month === 0;
  }
  if (!monthStart || distinct.size < 2) return null;
  if (year) return { label: "year grid", detail: "every value is 1 January", order };
  if (quarter) {
    return {
      label: "quarter grid",
      detail: "every value is 1 January, 1 April, 1 July, or 1 October",
      order,
    };
  }
  return { label: "month grid", detail: "every value is the first day of a month", order };
}

/**
 * Numeric grid: x is an integer year on an untyped/linear scale (a band or
 * time scale already orders the column differently, so skip those).
 */
function numericGrid(
  values: readonly CellValue[],
  entry: FieldEvidenceEntry,
  scaleType: string | undefined,
): PeriodGrid | null {
  if (entry.type !== "quantitative") return null;
  if (scaleType !== undefined && scaleType !== "linear") return null;
  const order: number[] = [];
  const distinct = new Set<number>();
  let sampled = 0;
  for (const value of values) {
    if (value === null || value === undefined) {
      order.push(Number.NaN);
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    order.push(value);
    sampled++;
    if (!Number.isInteger(value) || value < YEAR_LIKE_MIN || value >= INTEGER_YEAR_GRID_MAX) {
      return null;
    }
    distinct.add(value);
  }
  if (sampled < MIN_YEAR_LIKE_SAMPLES) return null;
  if (distinct.size < 2) return null;
  return {
    label: "integer-year grid",
    detail: "every value is a whole year number on a linear scale",
    order,
  };
}

/** Grouping column: aes group wins over fill, then color; null = one series. */
function groupValues(
  plotAes: Aes | undefined,
  layerAes: Aes | undefined,
  fields: FieldEvidenceMap,
): readonly CellValue[] | null {
  for (const channel of ["group", "fill", "color"] as const) {
    const mapped = effectiveChannel(plotAes, layerAes, channel);
    if (mapped === undefined || !("field" in mapped)) continue;
    const values = fields.get(mapped.field)?.values;
    if (values !== null && values !== undefined) return values;
  }
  return null;
}

/** One row of a layer's period totals, keyed for the shape test. */
interface PeriodRow {
  /** Parsed order value: epoch-ms on the temporal path, the year on the numeric. */
  order: number;
  group: string;
  y: number;
}

/**
 * B2 gate: the layer must read as per-period counts — every y a non-negative
 * integer and at least one series falling somewhere. A monotone series is
 * cumulative-shaped, and fractional or negative y is a rate or measurement;
 * issue #1882 endorses cumulative and rate series, and negative y belongs to
 * stacked-area-negative. Gap (B1) firings skip this gate.
 */
function countsShaped(
  rows: readonly PeriodRow[],
  byGroup: ReadonlyMap<string, ReadonlyMap<number, number>>,
  keys: readonly number[],
): boolean {
  if (!rows.every((row) => Number.isInteger(row.y) && row.y >= 0)) return false;
  for (const series of byGroup.values()) {
    const size = series.size;
    if (size <= 1) continue;
    // Sparse groups can sort their observed periods for less than a full scan.
    const ordered =
      size * Math.log2(size) <= keys.length
        ? [...series.keys()].toSorted((left, right) => left - right)
        : keys;
    let previous: number | undefined;
    for (const key of ordered) {
      const y = series.get(key);
      if (y === undefined) continue;
      if (previous !== undefined && y < previous) return true;
      previous = y;
    }
  }
  return false;
}

/** Resolved x/y/group columns for one layer, or null when evidence is missing. */
interface LayerColumns {
  xField: string;
  xInfo: FieldEvidenceEntry;
  xValues: readonly CellValue[];
  yValues: readonly CellValue[];
  groups: readonly CellValue[] | null;
}

function layerColumns(
  layer: Record<string, unknown>,
  fields: FieldEvidenceMap,
  plotAes: Aes | undefined,
): LayerColumns | null {
  const layerAes = isRecord(layer["aes"]) ? (layer["aes"] as Aes) : undefined;
  const xMapped = effectiveChannel(plotAes, layerAes, "x");
  if (xMapped === undefined || !("field" in xMapped)) return null;
  const xInfo = fields.get(xMapped.field);
  const xValues = xInfo?.values;
  if (xInfo === undefined || xValues === null || xValues === undefined) return null;

  const yMapped = effectiveChannel(plotAes, layerAes, "y");
  const yValues =
    yMapped !== undefined && "field" in yMapped ? fields.get(yMapped.field)?.values : undefined;
  if (yValues === null || yValues === undefined) return null;
  return {
    xField: xMapped.field,
    xInfo,
    xValues,
    yValues,
    groups: groupValues(plotAes, layerAes, fields),
  };
}

/** The layer's grid, cached per values array (layers often share one table). */
function resolveGrid(
  columns: LayerColumns,
  scaleType: string | undefined,
  grids: Map<readonly CellValue[], PeriodGrid | null>,
): PeriodGrid | null {
  const cached = grids.get(columns.xValues);
  if (cached !== undefined) return cached;
  const grid =
    temporalGrid(columns.xValues, columns.xInfo) ??
    numericGrid(columns.xValues, columns.xInfo, scaleType);
  grids.set(columns.xValues, grid);
  return grid;
}

/** Union-x and per-group sums for one layer, or null on a non-numeric y. */
interface PeriodSeries {
  rows: PeriodRow[];
  keys: number[];
  indexByKey: Map<number, number>;
  byGroup: Map<string, Map<number, number>>;
}

function periodSeries(columns: LayerColumns, grid: PeriodGrid): PeriodSeries | null {
  const { xValues, yValues, groups } = columns;
  const rows: PeriodRow[] = [];
  const union = new Set<number>();
  for (let row = 0; row < xValues.length; row++) {
    const x = xValues[row];
    if (x === null || x === undefined) continue;
    const order = grid.order[row]!;
    if (!Number.isFinite(order)) continue;
    // A null-y row still marks its period: another series may cover it, which
    // is exactly the missing-x gap this rule looks for.
    union.add(order);
    const y = yValues[row];
    if (y === null || y === undefined) continue;
    if (typeof y !== "number" || !Number.isFinite(y)) return null;
    rows.push({
      order,
      group: groups === null ? "" : String(groups[row] ?? ""),
      y,
    });
  }

  // Union of period keys across series, in x order. Keying on the parsed order
  // value (epoch or year) unifies different spellings of the same date.
  const keys = [...union].toSorted((a, b) => a - b);
  const indexByKey = new Map(keys.map((key, keyIndex) => [key, keyIndex]));

  // Duplicate group+x rows are sub-period contributions to the same total.
  const byGroup = new Map<string, Map<number, number>>();
  for (const row of rows) {
    let series = byGroup.get(row.group);
    if (series === undefined) {
      series = new Map();
      byGroup.set(row.group, series);
    }
    series.set(row.order, (series.get(row.order) ?? 0) + row.y);
  }
  return { rows, keys, indexByKey, byGroup };
}

/**
 * Interior gap: a zero inside a series' non-zero span, or a union-x key the
 * series never covers there. A series with a single non-zero value has no span.
 */
function hasInteriorGap(series: PeriodSeries): boolean {
  for (const groupSeries of series.byGroup.values()) {
    let first = -1;
    let last = -1;
    for (const [key, y] of groupSeries) {
      if (y === 0) continue;
      const keyIndex = series.indexByKey.get(key)!;
      if (first === -1 || keyIndex < first) first = keyIndex;
      if (keyIndex > last) last = keyIndex;
    }
    if (first === -1) continue;
    for (let keyIndex = first; keyIndex <= last; keyIndex++) {
      const y = groupSeries.get(series.keys[keyIndex]!);
      if (y === undefined || y === 0) return true;
    }
  }
  return false;
}

/** Advisory object for an `area` layer whose x sits on `grid`. */
function areaPeriodAdvisory(index: number, xField: string, grid: PeriodGrid): SpecAdvisory {
  const catalog = LINT_CATALOG["area-over-period-totals"];
  return {
    code: "area-over-period-totals",
    path: `/layers/${index}/aes/x`,
    message: `This area layer's x field "${xField}" is a regular ${grid.label} (${grid.detail}) — the area interpolates between period boundaries where the data holds one total per period.`,
    suggestion: {
      description: catalog.rationale,
      example: { geom: "col", position: "stack" },
    },
  };
}

/** Advisory object for a `line` or `step` layer plotting jagged period counts. */
function linePeriodAdvisory(
  index: number,
  geom: "line" | "step",
  xField: string,
  grid: PeriodGrid,
  periodCount: number,
): SpecAdvisory {
  return {
    code: "line-over-period-totals",
    path: `/layers/${index}/aes/x`,
    message: `This ${geom} layer's x field "${xField}" is a regular ${grid.label} (${grid.detail}) across ${periodCount} periods with jagged integer counts — connecting per-period totals implies a continuous trend where each point is a discrete period flow.`,
    suggestion: {
      description:
        'Plot the cumulative stock (or signed deltas) from the finest dated data; keep the per-period count only when the question is "how many were published this period", with the title saying so.',
    },
  };
}

interface PeriodContext {
  columns: LayerColumns;
  grid: PeriodGrid;
  series: PeriodSeries;
}

function resolvePeriodContext(input: {
  layer: Record<string, unknown>;
  fields: FieldEvidenceMap;
  plotAes: Aes | undefined;
  scaleType: string | undefined;
  grids: Map<readonly CellValue[], PeriodGrid | null>;
}): PeriodContext | null {
  const columns = layerColumns(input.layer, input.fields, input.plotAes);
  if (columns === null) return null;
  const grid = resolveGrid(columns, input.scaleType, input.grids);
  if (grid === null) return null;
  const series = periodSeries(columns, grid);
  if (series === null) return null;
  return { columns, grid, series };
}

function areaLayerAdvisory(index: number, ctx: PeriodContext): SpecAdvisory | null {
  const { columns, grid, series } = ctx;
  if (hasInteriorGap(series)) return areaPeriodAdvisory(index, columns.xField, grid);
  if (series.keys.length >= MAX_PERIOD_GRID_POINTS) return null;
  if (!countsShaped(series.rows, series.byGroup, series.keys)) return null;
  return areaPeriodAdvisory(index, columns.xField, grid);
}

function lineLayerAdvisory(
  index: number,
  geom: "line" | "step",
  ctx: PeriodContext,
): SpecAdvisory | null {
  const { columns, grid, series } = ctx;
  if (series.keys.length < MIN_LINE_PERIOD_GRID_POINTS) return null;
  if (!countsShaped(series.rows, series.byGroup, series.keys)) return null;
  return linePeriodAdvisory(index, geom, columns.xField, grid, series.keys.length);
}

function isPeriodTargetGeom(geom: unknown): geom is "area" | "line" | "step" {
  return geom === "area" || geom === "line" || geom === "step";
}

function readXScaleType(spec: Record<string, unknown>): string | undefined {
  const scales = isRecord(spec["scales"]) ? spec["scales"] : undefined;
  const xScale = isRecord(scales?.["x"]) ? scales["x"] : undefined;
  return typeof xScale?.["type"] === "string" ? xScale["type"] : undefined;
}

function layerAdvisory(input: {
  index: number;
  layer: Record<string, unknown>;
  fields: FieldEvidenceMap;
  plotAes: Aes | undefined;
  scaleType: string | undefined;
  grids: Map<readonly CellValue[], PeriodGrid | null>;
}): SpecAdvisory | null {
  const geom = input.layer["geom"];
  if (!isPeriodTargetGeom(geom)) return null;
  if (geom !== "area" && input.layer["stat"] !== undefined && input.layer["stat"] !== "identity") {
    return null;
  }
  const ctx = resolvePeriodContext(input);
  if (ctx === null) return null;
  return geom === "area"
    ? areaLayerAdvisory(input.index, ctx)
    : lineLayerAdvisory(input.index, geom, ctx);
}

/**
 * Advisories for `area`, `line`, and `step` layers plotting per-period totals
 * over a regular calendar grid. Evidence is per layer (a layer's own data wins
 * over the plot's); profile evidence has no raw values, so those layers skip
 * silently.
 */
export function collectPeriodTotalAdvisories(
  spec: Record<string, unknown>,
  layerEvidence: readonly (FieldEvidenceMap | null)[],
  plotEvidence: FieldEvidenceMap | null,
): SpecAdvisory[] {
  const layers = spec["layers"] as unknown[];
  if (!Array.isArray(layers)) return [];
  if (!layers.some((layer) => isRecord(layer) && isPeriodTargetGeom(layer["geom"]))) return [];

  const plotAes = isRecord(spec["aes"]) ? (spec["aes"] as Aes) : undefined;
  const scaleType = readXScaleType(spec);
  // Layers often read one table; key on the values array (evidence is per
  // layer, so a field name does not identify the same data).
  const grids = new Map<readonly CellValue[], PeriodGrid | null>();

  const advisories: SpecAdvisory[] = [];
  for (let index = 0; index < layers.length; index++) {
    const layer = layers[index];
    if (!isRecord(layer)) continue;
    const fields = index < layerEvidence.length ? layerEvidence[index] : plotEvidence;
    if (fields === null || fields === undefined) continue;
    const advisory = layerAdvisory({ index, layer, fields, plotAes, scaleType, grids });
    if (advisory !== null) advisories.push(advisory);
  }
  return advisories;
}
