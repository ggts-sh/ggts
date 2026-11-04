/**
 * Field-evidence construction for tier-2 validation and lint.
 *
 * `resolveLayerFieldEvidence` builds plot + per-layer maps in one pass
 * (pivot + type inference, under input limits). validate() runs that once and
 * shares the result with dataChecks and lintSpec so large inline data is not
 * scanned twice. Standalone lintSpec / resolveFieldEvidence still use the
 * plot-only path.
 */
import type { SpecError } from "./errors.js";
import type { Aes, CellValue, ChannelName } from "./schema.js";
import { inferTemporalColumn, type TemporalDecision } from "./temporal-column.js";
import type { ProfileFieldType, ValidateLimits, ValidateOptions } from "./validate-data.js";

// ---------------------------------------------------------------------------
// Field evidence types
// ---------------------------------------------------------------------------

/**
 * One field's type evidence for tier-2 checks and lint. Built once per
 * validate() when both dataChecks and lintSpec run, so large inline data is
 * not pivoted/type-scanned twice.
 */
export interface FieldEvidenceEntry {
  type: ProfileFieldType | null;
  /** True when the column exists but has only null values (inline data only). */
  allNull: boolean;
  /** Raw column values (inline data only; null for profile-backed fields). */
  values: readonly CellValue[] | null;
  /** Shared value-driven temporal decision (inline data only). */
  temporal: TemporalDecision | null;
}

export type FieldEvidenceMap = Map<string, FieldEvidenceEntry>;

/** Plot + per-layer field evidence from one pass over inline tables / profile. */
export type ResolveLayerFieldEvidenceResult =
  /**
   * `layers[i]` may be the same object as `plot` or as another layer's entry
   * when those layers read one dataset. Treat every map as read-only; copy
   * before writing.
   */
  | { status: "ok"; plot: FieldEvidenceMap | null; layers: Array<FieldEvidenceMap | null> }
  | { status: "none" }
  | { status: "errors"; errors: SpecError[] };

// ---------------------------------------------------------------------------
// Channel helper (shared by structure checks, data checks, and lint)
// ---------------------------------------------------------------------------

/**
 * The channel a layer effectively sees (layer wins; null unsets).
 *
 * Canonicalizes authoring sugar: a bare string ("col" as in `aes({ x: "col" })`)
 * becomes `{ field: "col" }`. Callers (structure checks, data checks, lint) run
 * `"field" in mapped` on the result, and lintSpec() receives builder output
 * before normalize(), so returning the primitive would throw a TypeError.
 */
export function effectiveChannel(
  plotAes: Aes | undefined,
  layerAes: Aes | undefined,
  channel: ChannelName,
): Exclude<Aes[ChannelName], null | undefined> | undefined {
  const own = layerAes?.[channel];
  if (own === null) return undefined;
  const chosen = own ?? plotAes?.[channel];
  if (chosen === undefined || chosen === null) return undefined;
  if (typeof chosen === "string") return { field: chosen };
  return chosen;
}

// ---------------------------------------------------------------------------
// Type inference + profile / inline resolution
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const PROFILE_TYPES: ReadonlySet<string> = new Set([
  "quantitative",
  "temporal",
  "ordinal",
  "nominal",
]);

function inferProfileType(column: readonly CellValue[]): {
  type: ProfileFieldType | null;
  temporal: TemporalDecision;
} {
  const temporal = inferTemporalColumn(column);
  if (temporal.status === "temporal") return { type: "temporal", temporal };
  let sawNumber = false;
  let sawValue = false;
  for (const value of column) {
    if (value === null) continue;
    sawValue = true;
    if (typeof value === "boolean" || typeof value === "string") {
      return { type: "nominal", temporal };
    }
    if (typeof value === "number") sawNumber = true;
  }
  return { type: sawNumber ? "quantitative" : sawValue ? "nominal" : null, temporal };
}

function badProfile(message: string): SpecError[] {
  return [
    {
      code: "invalid-data-profile",
      path: "",
      message: `Invalid DataProfile: ${message}`,
      fix: {
        description:
          'Provide { fields: [{ name, type: "quantitative"|"temporal"|"ordinal"|"nominal" }], rowCount? }.',
        example: { fields: [{ name: "displ", type: "quantitative" }], rowCount: 234 },
      },
    },
  ];
}

function profileErrors(profile: unknown): SpecError[] {
  if (!isRecord(profile)) return badProfile("expected an object.");
  if (!Array.isArray(profile["fields"])) return badProfile('"fields" must be an array.');
  for (const field of profile["fields"] as unknown[]) {
    if (!isRecord(field) || typeof field["name"] !== "string") {
      return badProfile('every field needs a string "name".');
    }
    if (typeof field["type"] !== "string" || !PROFILE_TYPES.has(field["type"])) {
      return badProfile(
        `field "${field["name"]}" has type ${JSON.stringify(field["type"])}; allowed: quantitative, temporal, ordinal, nominal.`,
      );
    }
  }
  if (profile["rowCount"] !== undefined && typeof profile["rowCount"] !== "number") {
    return badProfile('"rowCount" must be a number when present.');
  }
  return [];
}

/**
 * Resolve inline columns from a data ref against optional named datasets.
 * Named refs that are not present in datasets return null (runtime-only data).
 */
function columnsFromDataRef(
  data: unknown,
  datasets: unknown,
): Record<string, readonly CellValue[]> | null {
  let ref = data;
  if (isRecord(ref) && typeof ref["name"] === "string") {
    ref = isRecord(datasets) ? datasets[ref["name"]] : undefined;
  }
  if (!isRecord(ref)) return null;
  if (Array.isArray(ref["values"])) {
    const rows = ref["values"] as Record<string, CellValue>[];
    const columns: Record<string, CellValue[]> = {};
    for (const row of rows) {
      if (!isRecord(row)) continue;
      for (const key of Object.keys(row)) columns[key] ??= [];
    }
    for (const key of Object.keys(columns)) {
      const column = columns[key]!;
      for (const row of rows) column.push(isRecord(row) ? (row[key] ?? null) : null);
    }
    return columns;
  }
  if (isRecord(ref["columns"])) {
    return ref["columns"] as Record<string, readonly CellValue[]>;
  }
  return null;
}

/** Resolve the spec's plot-level inline columns ({values}, {columns}, or named). */
function inlineColumns(spec: Record<string, unknown>): Record<string, readonly CellValue[]> | null {
  return columnsFromDataRef(spec["data"], spec["datasets"]);
}

function evidenceFromColumns(columns: Record<string, readonly CellValue[]>): FieldEvidenceMap {
  const fields: FieldEvidenceMap = new Map();
  for (const name of Object.keys(columns)) {
    const column = columns[name]!;
    const inferred = inferProfileType(column);
    fields.set(name, {
      type: inferred.type,
      allNull: column.length > 0 && inferred.type === null,
      values: column,
      temporal: inferred.temporal,
    });
  }
  return fields;
}

/**
 * Per-layer field evidence (#589). Each layer inherits plot-level evidence
 * unless it supplies its own inline/named-inline data.
 * Layers with only unresolved named (runtime) data get `null` (skip type checks).
 */
export function resolveLayerFieldEvidence(
  spec: Record<string, unknown>,
  options: ValidateOptions,
  limits: ValidateLimits,
): ResolveLayerFieldEvidenceResult {
  if (options.profile !== undefined) {
    return evidenceFromProfile(options.profile, spec);
  }

  const datasets = spec["datasets"];
  const plotColumns = inlineColumns(spec);
  let totalRows = 0;
  let totalBytes = 0;
  const countedTables = new Set<string>();
  const countTable = (key: string, columns: Record<string, readonly CellValue[]>) => {
    if (countedTables.has(key)) return;
    countedTables.add(key);
    const names = Object.keys(columns);
    const rowCount = names.length === 0 ? 0 : (columns[names[0]!]?.length ?? 0);
    totalRows += rowCount;
    totalBytes += estimateBytes(columns, rowCount);
  };
  if (plotColumns !== null) {
    // Prefer name: key so plot-level { name } matching a layer named ref is not
    // double-counted toward maxRows (same embedded/named dataset once).
    const plotData = spec["data"];
    const plotKey =
      isRecord(plotData) && typeof plotData["name"] === "string"
        ? `name:${plotData["name"]}`
        : "__plot__";
    countTable(plotKey, plotColumns);
  }

  const layers = Array.isArray(spec["layers"]) ? (spec["layers"] as unknown[]) : [];
  // Several layers commonly name one dataset. Pivoting {values} rows into
  // columns is O(rows x columns), so resolve each name once rather than once
  // per reference. Inline data keeps its own table: equal content is not the
  // same table.
  const columnsByName = new Map<string, Record<string, readonly CellValue[]>>();
  const plotData = spec["data"];
  const plotName =
    isRecord(plotData) && typeof plotData["name"] === "string" ? plotData["name"] : null;
  // The plot's own table seeds it, so a layer naming the plot's dataset reuses
  // that pivot instead of building a second one.
  if (plotColumns !== null && plotName !== null) columnsByName.set(plotName, plotColumns);
  const { layerColumns, layerNames } = resolveLayerColumns(
    layers,
    datasets,
    columnsByName,
    countTable,
  );

  if (plotColumns === null && layerColumns.every((c) => c === null || c === "runtime")) {
    return { status: "none" };
  }

  if (totalRows > limits.maxRows) {
    return {
      status: "errors",
      errors: [
        {
          code: "validation-limit",
          path: "/data",
          message: `Inline data has ${totalRows} rows across plot/layers, more than the documented maxRows limit (${limits.maxRows}); data-aware checks skipped. Validate with a DataProfile instead.`,
        },
      ],
    };
  }
  if (totalBytes > limits.maxBytes) {
    return {
      status: "errors",
      errors: [
        {
          code: "validation-limit",
          path: "/data",
          message: `Inline data exceeds the documented maxBytes limit (${limits.maxBytes} bytes, estimated across plot/layers); data-aware checks skipped. Validate with a DataProfile instead.`,
        },
      ],
    };
  }

  const plot = plotColumns === null ? null : evidenceFromColumns(plotColumns);
  // Type inference walks every value of every column, so it too runs once per
  // named dataset. The plot's own table seeds it, matching the row accounting
  // above, which already treats a name the plot and a layer share as one table.
  const evidenceByName = new Map<string, FieldEvidenceMap>();
  if (plot !== null && plotName !== null) evidenceByName.set(plotName, plot);
  const layerMaps: Array<FieldEvidenceMap | null> = layerColumns.map((cols, index) => {
    if (cols === "runtime") return null;
    if (cols === null) return plot;
    const name = layerNames[index] ?? null;
    if (name === null) return evidenceFromColumns(cols);
    const cached = evidenceByName.get(name);
    if (cached !== undefined) return cached;
    const built = evidenceFromColumns(cols);
    evidenceByName.set(name, built);
    return built;
  });
  return { status: "ok", plot, layers: layerMaps };
}

function evidenceFromProfile(
  profile: NonNullable<ValidateOptions["profile"]>,
  spec: Record<string, unknown>,
): ResolveLayerFieldEvidenceResult {
  const bad = profileErrors(profile);
  if (bad.length > 0) return { status: "errors", errors: bad };
  const fields: FieldEvidenceMap = new Map();
  for (const field of profile.fields) {
    fields.set(field.name, { type: field.type, allNull: false, values: null, temporal: null });
  }
  const layers = Array.isArray(spec["layers"]) ? (spec["layers"] as unknown[]) : [];
  return { status: "ok", plot: fields, layers: layers.map(() => fields) };
}

function resolveLayerColumns(
  layers: unknown[],
  datasets: unknown,
  columnsByName: Map<string, Record<string, readonly CellValue[]>>,
  countTable: (key: string, columns: Record<string, readonly CellValue[]>) => void,
): {
  layerColumns: Array<Record<string, readonly CellValue[]> | null | "runtime">;
  layerNames: Array<string | null>;
} {
  const layerColumns: Array<Record<string, readonly CellValue[]> | null | "runtime"> = [];
  const layerNames: Array<string | null> = [];
  for (const layer of layers) {
    if (!isRecord(layer) || layer["data"] === undefined) {
      layerColumns.push(null);
      layerNames.push(null);
      continue;
    }
    const data = layer["data"];
    const name = isRecord(data) && typeof data["name"] === "string" ? data["name"] : null;
    let columns = name === null ? undefined : columnsByName.get(name);
    if (columns === undefined) {
      const resolved = columnsFromDataRef(data, datasets);
      if (resolved === null) {
        layerColumns.push("runtime");
        layerNames.push(null);
        continue;
      }
      columns = resolved;
      if (name !== null) columnsByName.set(name, columns);
    }
    const key = name === null ? `inline:${layerColumns.length}` : `name:${name}`;
    countTable(key, columns);
    layerColumns.push(columns);
    layerNames.push(name);
  }
  return { layerColumns, layerNames };
}

function estimateBytes(columns: Record<string, readonly CellValue[]>, rowCount: number): number {
  // Estimate from a bounded sample so the limit check itself stays cheap.
  const sample = Math.min(rowCount, 100);
  if (sample === 0) return 0;
  let sampleBytes = 0;
  for (const column of Object.values(columns)) {
    sampleBytes += JSON.stringify(column.slice(0, sample))?.length ?? 0;
  }
  return Math.round((sampleBytes / sample) * rowCount);
}
