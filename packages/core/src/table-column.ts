/**
 * ColumnTable — the pipeline's columnar data container.
 *
 * Temporal meaning is owned by @ggts-sh/spec's strict parser registry. A
 * ColumnTable caches immutable parsed views by field + parser semantics;
 * subsets gather parent views so filters/facets never reclassify or reparse.
 */
import type { TemporalParserSpec } from "@ggts-sh/spec";

import {
  COLUMN_TRANSFORM_EVENT,
  type ColumnTransformConfig,
  executeColumnTransform,
} from "./scales/transform.js";
import { discretenessOf, nonTemporalFieldType } from "./table-coerce.js";
import { getTemporalRuntime } from "./temporal-runtime.js";
import {
  fallbackNumericColumn,
  fieldTypeFromLiteDecision,
  parseLiteColumn,
  parsedOptionsKey,
  parsedRequestKey,
} from "./table-parse-lite.js";
import type {
  CellValue,
  Columns,
  Discreteness,
  FieldType,
  ParsedColumnOptions,
  ParsedColumnView,
  Rows,
  TransformedColumnView,
} from "./table-types.js";

function transformConfigKey(config: ColumnTransformConfig): string {
  const limits =
    config.sourceLimits === null ? "none" : `${config.sourceLimits[0]},${config.sourceLimits[1]}`;
  const na = config.naValue === null ? "null" : String(config.naValue);
  return `${config.transform.key}|${limits}|${config.oob}|${na}`;
}

export class ColumnTable {
  readonly #columns: Record<string, readonly CellValue[]>;
  readonly #rowCount: number;
  readonly #parsedCache = new Map<string, ParsedColumnView>();
  readonly #transformedCache = new Map<string, TransformedColumnView>();
  readonly #typeCache = new Map<string, FieldType>();
  readonly #parent: ColumnTable | null;
  readonly #parentRows: readonly number[] | Uint32Array | null;

  private constructor(
    columns: Record<string, readonly CellValue[]>,
    rowCount: number,
    parent: ColumnTable | null = null,
    parentRows: readonly number[] | Uint32Array | null = null,
  ) {
    this.#columns = columns;
    this.#rowCount = rowCount;
    this.#parent = parent;
    this.#parentRows = parentRows;
  }

  /** Build from row objects (missing keys become null). */
  static fromRows(rows: Rows): ColumnTable {
    const names = new Set<string>();
    for (const row of rows) for (const key of Object.keys(row)) names.add(key);
    const columns: Record<string, CellValue[]> = {};
    for (const name of names) {
      const column = Array.from<CellValue>({ length: rows.length });
      for (let index = 0; index < rows.length; index++) {
        const value = rows[index]![name];
        column[index] = value === undefined ? null : value;
      }
      columns[name] = column;
    }
    return new ColumnTable(columns, rows.length);
  }

  /** Build from column arrays (all columns must have equal length). */
  static fromColumns(columns: Columns): ColumnTable {
    const names = Object.keys(columns);
    const rowCount = names.length === 0 ? 0 : columns[names[0]!]!.length;
    for (const name of names) {
      if (columns[name]!.length !== rowCount) {
        throw new Error(
          `ColumnTable: column "${name}" has length ${columns[name]!.length}, expected ${rowCount}`,
        );
      }
    }
    return new ColumnTable({ ...columns }, rowCount);
  }

  get rowCount(): number {
    return this.#rowCount;
  }

  get fields(): string[] {
    return Object.keys(this.#columns);
  }

  has(name: string): boolean {
    return name in this.#columns;
  }

  columns(): Columns {
    return this.#columns;
  }

  column(name: string): readonly CellValue[] {
    const column = this.#columns[name];
    if (column === undefined) {
      throw new Error(
        `ColumnTable: unknown field "${name}" (available: ${this.fields.join(", ") || "none"})`,
      );
    }
    return column;
  }

  /** Immutable semantic view, cached by parser and conversion options. */
  parsed(
    name: string,
    parser: TemporalParserSpec | "auto" = "auto",
    options: ParsedColumnOptions = {},
  ): ParsedColumnView {
    const cacheKey = `${name}|${parsedRequestKey(parser, options)}`;
    const cached = this.#parsedCache.get(cacheKey);
    if (cached !== undefined) return cached;

    if (this.#parent !== null && this.#parentRows !== null) {
      const parent = this.#parent.parsed(name, parser, options);
      const semantic = new Float64Array(this.#parentRows.length);
      const valid = new Uint8Array(this.#parentRows.length);
      for (let index = 0; index < this.#parentRows.length; index++) {
        const sourceIndex = this.#parentRows[index]!;
        semantic[index] = parent.semantic[sourceIndex]!;
        valid[index] = parent.valid[sourceIndex]!;
      }
      const view: ParsedColumnView = {
        raw: this.column(name),
        semantic,
        valid,
        parserKey: parent.parserKey,
        ...(parent.temporalKind !== undefined && { temporalKind: parent.temporalKind }),
        ...(parent.temporalPrecision !== undefined && {
          temporalPrecision: parent.temporalPrecision,
        }),
        decision: parent.decision,
      };
      this.#parsedCache.set(cacheKey, view);
      return view;
    }

    const raw = this.column(name);
    const runtime = getTemporalRuntime();
    const parsed =
      runtime === null
        ? parseLiteColumn(raw, parser, options)
        : runtime.parseColumn(raw, parser, options);
    const inferTemporal = options.inferTemporal !== false;
    const temporal = parser !== "auto" || (inferTemporal && parsed.decision.status === "temporal");
    // Lean parseLiteColumn already materializes semantic/valid for every
    // decision (including nominal). Re-running fallbackNumericColumn doubled
    // the per-cell coerce cost on every non-temporal column (line-3×10k bind
    // was ~half of runPipeline). Full temporal runtime still falls back for
    // nominal auto columns so mixed/non-ISO cells get cellsToNumeric.
    const values =
      temporal || runtime === null
        ? { semantic: parsed.semantic, valid: parsed.valid }
        : fallbackNumericColumn(raw, inferTemporal);
    const view: ParsedColumnView = {
      raw,
      semantic: values.semantic,
      valid: values.valid,
      parserKey: `${parsed.decision.parserKey}|${parsedOptionsKey(options)}`,
      ...(parsed.decision.kind !== null &&
        parsed.decision.kind !== undefined && { temporalKind: parsed.decision.kind }),
      ...(parsed.decision.precision !== null &&
        parsed.decision.precision !== undefined && {
          temporalPrecision: parsed.decision.precision,
        }),
      decision: parsed.decision,
    };
    this.#parsedCache.set(cacheKey, view);
    return view;
  }

  /** Cached numeric view; explicit parser semantics are optional. */
  numeric(
    name: string,
    parser: TemporalParserSpec | "auto" = "auto",
    options: ParsedColumnOptions = {},
  ): Float64Array {
    return this.parsed(name, parser, options).semantic;
  }

  /**
   * Immutable transformed (scale-space) view, cached by the parsed request key
   * plus (transform, source limits, OOB, naValue). Identity with no OOB/NA
   * aliases the semantic arrays (no O(rows) copy). Subsets gather the parent's
   * transformed values by source row, so the transform runs once per source key
   * regardless of facet count.
   */
  transformed(
    name: string,
    parser: TemporalParserSpec | "auto",
    options: ParsedColumnOptions,
    config: ColumnTransformConfig,
  ): TransformedColumnView {
    const transformKey = transformConfigKey(config);
    const cacheKey = `${name}|${parsedRequestKey(parser, options)}|${transformKey}`;
    const cached = this.#transformedCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const parsedView = this.parsed(name, parser, options);

    // Fast path: identity with no OOB/NA rewrite aliases the semantic arrays.
    if (
      config.transform.key === "identity" &&
      config.sourceLimits === null &&
      config.naValue === null
    ) {
      const view: TransformedColumnView = {
        raw: parsedView.raw,
        semantic: parsedView.semantic,
        transformed: parsedView.semantic,
        valid: parsedView.valid,
        events: new Uint8Array(parsedView.valid.length),
        parserKey: parsedView.parserKey,
        transformKey,
        censored: 0,
        squished: 0,
        invalidTransform: 0,
      };
      this.#transformedCache.set(cacheKey, view);
      return view;
    }

    if (this.#parent !== null && this.#parentRows !== null) {
      const parent = this.#parent.transformed(name, parser, options, config);
      const length = this.#parentRows.length;
      const transformed = new Float64Array(length);
      const valid = new Uint8Array(length);
      const events = new Uint8Array(length);
      let censored = 0;
      let squished = 0;
      let invalidTransform = 0;
      for (let index = 0; index < length; index++) {
        const sourceIndex = this.#parentRows[index]!;
        transformed[index] = parent.transformed[sourceIndex]!;
        valid[index] = parent.valid[sourceIndex]!;
        const event = parent.events[sourceIndex]!;
        events[index] = event;
        if ((event & COLUMN_TRANSFORM_EVENT.censored) !== 0) censored++;
        if ((event & COLUMN_TRANSFORM_EVENT.squished) !== 0) squished++;
        if ((event & COLUMN_TRANSFORM_EVENT.invalidTransform) !== 0) invalidTransform++;
      }
      const view: TransformedColumnView = {
        raw: parsedView.raw,
        semantic: parsedView.semantic,
        transformed,
        valid,
        events,
        parserKey: parsedView.parserKey,
        transformKey,
        censored,
        squished,
        invalidTransform,
      };
      this.#transformedCache.set(cacheKey, view);
      return view;
    }

    const result = executeColumnTransform(parsedView.semantic, parsedView.valid, config);
    const view: TransformedColumnView = {
      raw: parsedView.raw,
      semantic: parsedView.semantic,
      transformed: result.transformed,
      valid: result.valid,
      events: result.events,
      parserKey: parsedView.parserKey,
      transformKey,
      censored: result.censored,
      squished: result.squished,
      invalidTransform: result.invalidTransform,
    };
    this.#transformedCache.set(cacheKey, view);
    return view;
  }

  /**
   * Row subset (facet/filter partition). Parsed views gather from this table,
   * preserving source decisions and avoiding per-panel parsing.
   */
  subset(rows: readonly number[] | Uint32Array): ColumnTable {
    const columns: Record<string, CellValue[]> = {};
    for (const name of this.fields) {
      const source = this.#columns[name]!;
      const column = Array.from<CellValue>({ length: rows.length });
      for (let index = 0; index < rows.length; index++) column[index] = source[rows[index]!]!;
      columns[name] = column;
    }
    return new ColumnTable(columns, rows.length, this, rows);
  }

  /** Inferred or explicitly parsed field type. */
  fieldType(
    name: string,
    parser: TemporalParserSpec | "auto" = "auto",
    options: ParsedColumnOptions = {},
  ): FieldType {
    if (parser !== "auto") return "temporal";
    const cacheKey = `${name}|${parsedRequestKey(parser, options)}`;
    const cached = this.#typeCache.get(cacheKey);
    if (cached !== undefined) return cached;
    if (this.#parent !== null) {
      const inherited = this.#parent.fieldType(name, parser, options);
      this.#typeCache.set(cacheKey, inherited);
      return inherited;
    }
    const view = this.parsed(name, parser, options);
    const type =
      options.inferTemporal === false
        ? this.column(name).every(
            (value, index) => value === null || Number.isFinite(view.semantic[index]!),
          )
          ? "quantitative"
          : "nominal"
        : view.decision.status === "temporal"
          ? "temporal"
          : // Monomorphic lean keys (lite:numbers / lite:labels) skip the
            // second O(n) typeof walk; mixed/Date fall through to
            // nonTemporalFieldType so lean and full agree (#1477 review).
            (fieldTypeFromLiteDecision(view.decision) ?? nonTemporalFieldType(this.column(name)));
    this.#typeCache.set(cacheKey, type);
    return type;
  }

  discreteness(
    name: string,
    parser: TemporalParserSpec | "auto" = "auto",
    options: ParsedColumnOptions = {},
  ): Discreteness {
    return discretenessOf(this.fieldType(name, parser, options));
  }
}
