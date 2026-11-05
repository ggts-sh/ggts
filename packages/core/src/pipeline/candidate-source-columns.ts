import { defaultAutoMode } from "../candidate-geometry.js";
import type {
  CandidateBatchFacts,
  CandidateDatumColumns,
  CandidateStyleColumn,
} from "../candidate-store.js";
import { AUTO_MODE_CODE } from "../candidate-store-indexes.js";
import type { LineageStore } from "../identity.js";
import type { Scene } from "../scene.js";
import type { CellValue, ColumnTable } from "../table.js";
import type { SourceRegistry } from "./source-registry.js";
import type { StyleRead, createRawResolverState } from "./candidate-source-state.js";
import { sourceBackedInspectY, sourceBackedRewritesInspectY } from "./candidate-source-values.js";
import { candidateAutoMode } from "./frame-candidates-auto-mode.js";
import { NO_ROW } from "./types-no-row.js";
import type { FinalizedLayerFrame, LayerBinding, ResolvedColorScale } from "./types.js";

/** All-default columns (binding missing): mirrors the `{}` per-candidate return. */
const EMPTY_DATUM_COLUMNS: CandidateDatumColumns = {
  xValue: null,
  yValue: null,
  sizeValue: null,
  linewidthValue: null,
  alphaValue: null,
  shapeValue: null,
  linetypeValue: null,
  seriesId: null,
  seriesRank: null,
  sourceOrder: null,
  lineage: null,
  autoMode: null,
};

type OrdinalRankScale = NonNullable<ReturnType<typeof createRawResolverState>>["colorOrdinal"];
type RankLookup = ((value: CellValue) => number) | null;

/** Per-batch memo for ordinal `indexOf`: dense plots repeat values. */
function rankMemo(scale: OrdinalRankScale): ((value: CellValue) => number) | null {
  if (scale === null) return null;
  const memo = new Map<CellValue, number>();
  return (value) => {
    const prior = memo.get(value);
    if (prior !== undefined) return prior;
    const rank = scale.scale.indexOf(value) ?? -1;
    memo.set(value, rank);
    return rank;
  };
}

function ordinalRank(
  rankOf: RankLookup,
  column: readonly CellValue[] | null,
  localRow: number,
): number {
  if (rankOf === null) return -1;
  return rankOf(localRow < 0 || column === null ? null : column[localRow]!);
}

function seriesRanks(
  count: number,
  groups: readonly number[],
  colorColumn: readonly CellValue[] | null,
  fillColumn: readonly CellValue[] | null,
  colorRankOf: RankLookup,
  fillRankOf: RankLookup,
  localRow: (index: number) => number,
): ArrayLike<number> | null {
  if (colorRankOf === null && fillRankOf === null) return null;
  const ranks = Array.from<number>({ length: count });
  for (let i = 0; i < count; i++) {
    const row = localRow(i);
    const colorRank =
      colorRankOf === null || colorColumn === null ? -1 : colorRankOf(colorColumn[row]!);
    const fillRank = fillRankOf === null || fillColumn === null ? -1 : fillRankOf(fillColumn[row]!);
    const group = groups[row] ?? 0;
    ranks[i] = colorRank >= 0 ? colorRank : fillRank >= 0 ? fillRank : group;
  }
  return ranks;
}

function resolvedAutoModeCode(
  binding: LayerBinding,
  batch: Scene["batches"][number],
  primitiveIndex: number,
  semanticIndex: number,
): number {
  const mode = candidateAutoMode(binding, semanticIndex);
  return AUTO_MODE_CODE[mode ?? defaultAutoMode(batch, primitiveIndex)];
}

/** One style channel as a batch column: null-elided, constant, or a sliced source column. */
function styleColumn(
  style: StyleRead,
  slice: <T>(column: readonly T[]) => readonly T[],
): CandidateStyleColumn {
  if (style.column === null) {
    // Unmapped styles carry an undefined constant — elide to the null
    // column so the store skips the writes (callback pushes undefined,
    // which `fact()` also reads back as null).
    return style.constant === undefined || style.constant === null
      ? null
      : { kind: "constant", value: style.constant };
  }
  return { kind: "column", values: slice(style.column) };
}

/** Batch autoMode codes: whole-batch answers fill once; only `rule` varies. */
function autoModeColumn(binding: LayerBinding, facts: CandidateBatchFacts): Uint8Array | null {
  const count = facts.primitiveIds.length;
  const first = candidateAutoMode(binding, facts.semanticIds[0] ?? 0);
  // Undefined (spoke/segment → geometry default in the store) and constant
  // modes are whole-batch answers; only `rule` varies within a batch.
  if (first === undefined) return null;
  const code = AUTO_MODE_CODE[first];
  let constant = true;
  for (let i = 1; i < count; i++) {
    if (candidateAutoMode(binding, facts.semanticIds[i]!) !== first) {
      constant = false;
      break;
    }
  }
  if (constant) return new Uint8Array(count).fill(code);
  const column = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    column[i] = AUTO_MODE_CODE[candidateAutoMode(binding, facts.semanticIds[i]!) ?? first]!;
  }
  return column;
}

/** Null-only scratch reads as the null column (elided writes in the store). */
function styleColumnFrom(values: CellValue[]): CandidateStyleColumn {
  return values.every((v) => v === null) ? null : { kind: "column", values };
}

/**
 * Columnar twin of {@link createRawCandidateDatumResolver}: resolves the same
 * values a batch at a time, so dense source-backed layers never materialize
 * per-candidate objects. Two shapes:
 *
 * - CONTIGUOUS (all rows backed, ascending, one table — the dense common
 *   case): x/y/style/series columns are the table's own arrays (whole-column
 *   reuse) or ONE native slice per column; lineage is a single typed-array
 *   fill through `internSingleton`; ordinal ranks memoize `indexOf` per
 *   unique value.
 * - SCATTERED (NO_ROW gaps, multi-table, non-monotonic): per-candidate
 *   resolution mirroring the callback line-for-line, written into columns.
 *
 * Both reproduce the callback's observable semantics exactly, including the
 * early-`{}` cases: NO_ROW rows take store defaults everywhere (constants
 * dropped), while locatable-miss rows keep constants and singleton lineage.
 */
export function createRawCandidateDatumColumnsResolver(input: {
  scene: Scene;
  bindings: readonly LayerBinding[];
  sources: SourceRegistry;
  color: ResolvedColorScale | null;
  fill: ResolvedColorScale | null;
  lineage: LineageStore<number>;
  shared: ReturnType<typeof createRawResolverState>;
  panelFrames: readonly (readonly FinalizedLayerFrame[])[];
}): (facts: CandidateBatchFacts) => CandidateDatumColumns | null {
  const { scene, bindings, sources, lineage, shared, panelFrames } = input;
  const { stateFor, constantsFor, colorOrdinal, fillOrdinal } = shared;

  const contiguousColumns = (
    binding: LayerBinding,
    facts: CandidateBatchFacts,
    table: ColumnTable,
    localStart: number,
  ): CandidateDatumColumns | null => {
    const count = facts.primitiveIds.length;
    const state = stateFor(facts.layerIndex, table);
    // Slice semantics degrade exactly like the callback's out-of-bounds reads
    // (`column[localRow]` → undefined → null / `?? 0`), so columns shorter
    // than the run need no special-casing.
    const slice = <T>(column: readonly T[]): readonly T[] =>
      localStart === 0 && count === column.length
        ? column
        : column.slice(localStart, localStart + count);
    const localRow = (i: number): number => localStart + i;

    // Series: the groups array itself when the batch spans the table.
    const seriesId: ArrayLike<number> = slice(state.groups);

    // Ordinal ranks with the full colorRank → fillRank → group precedence.
    const colorRankOf =
      binding.color.field === null || state.color === null ? null : rankMemo(colorOrdinal);
    const fillRankOf =
      binding.fill.field === null || state.fill === null ? null : rankMemo(fillOrdinal);
    const seriesRank = seriesRanks(
      count,
      state.groups,
      state.color,
      state.fill,
      colorRankOf,
      fillRankOf,
      localRow,
    );

    const lineageCol = new Uint32Array(count);
    for (let i = 0; i < count; i++) lineageCol[i] = lineage.internSingleton(facts.rowIds[i]!);

    const sourceY = state.y === null ? null : slice(state.y);
    const rewriteY = sourceBackedRewritesInspectY(
      panelFrames[facts.panelIndex]?.[facts.layerIndex],
      scene.batches[facts.batchIndex]?.kind,
    );
    let yValue: CandidateDatumColumns["yValue"] = sourceY;
    if (rewriteY && sourceY !== null) {
      const rewritten = Array.from<CellValue>({ length: count });
      for (let i = 0; i < count; i++) {
        rewritten[i] = sourceBackedInspectY(
          panelFrames,
          scene,
          {
            panelIndex: facts.panelIndex,
            layerIndex: facts.layerIndex,
            batchIndex: facts.batchIndex,
            primitiveIndex: facts.semanticIds[i]!,
          },
          sourceY[i] ?? null,
        );
      }
      yValue = rewritten;
    }

    return {
      xValue: state.x === null ? null : slice(state.x),
      yValue,
      sizeValue: styleColumn(state.size, slice),
      linewidthValue: styleColumn(state.linewidth, slice),
      alphaValue: styleColumn(state.alpha, slice),
      shapeValue: styleColumn(state.shape, slice),
      linetypeValue: styleColumn(state.linetype, slice),
      seriesId,
      seriesRank,
      sourceOrder: facts.rowIds,
      lineage: lineageCol,
      autoMode: autoModeColumn(binding, facts),
    };
  };

  const scatteredColumns = (
    binding: LayerBinding,
    facts: CandidateBatchFacts,
  ): CandidateDatumColumns => {
    const count = facts.primitiveIds.length;
    const batch = scene.batches[facts.batchIndex]!;
    const colorRankOf = binding.color.field === null ? null : rankMemo(colorOrdinal);
    const fillRankOf = binding.fill.field === null ? null : rankMemo(fillOrdinal);
    const xValues: CellValue[] = Array.from<CellValue>({ length: count }).fill(null);
    const yValues: CellValue[] = Array.from<CellValue>({ length: count }).fill(null);
    const styleScratch: Record<"size" | "linewidth" | "alpha" | "shape" | "linetype", CellValue[]> =
      {
        size: Array.from<CellValue>({ length: count }).fill(null),
        linewidth: Array.from<CellValue>({ length: count }).fill(null),
        alpha: Array.from<CellValue>({ length: count }).fill(null),
        shape: Array.from<CellValue>({ length: count }).fill(null),
        linetype: Array.from<CellValue>({ length: count }).fill(null),
      };
    const seriesCol = new Uint32Array(count);
    const rankCol = new Uint32Array(count);
    const sourceOrderCol = new Uint32Array(count);
    const lineageCol = new Uint32Array(count);
    const autoModeCol = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const rowId = facts.rowIds[i]!;
      const primitiveIndex = facts.primitiveIds[i]!;
      if (rowId === NO_ROW) {
        // Early `{}` return in the callback: store defaults everywhere.
        sourceOrderCol[i] = primitiveIndex;
        autoModeCol[i] = AUTO_MODE_CODE[defaultAutoMode(batch, primitiveIndex)]!;
        continue;
      }
      const located = sources.locate(rowId);
      const state =
        located === null
          ? constantsFor(facts.layerIndex)
          : stateFor(facts.layerIndex, located.table);
      const localRow = located?.localRow ?? -1;
      const read = (column: readonly CellValue[] | null): CellValue =>
        column === null || localRow < 0 ? null : column[localRow]!;
      const readStyle = (style: StyleRead): CellValue =>
        style.column === null ? style.constant : localRow < 0 ? null : style.column[localRow]!;
      xValues[i] = read(state.x);
      yValues[i] = sourceBackedInspectY(
        panelFrames,
        scene,
        {
          panelIndex: facts.panelIndex,
          layerIndex: facts.layerIndex,
          batchIndex: facts.batchIndex,
          primitiveIndex: facts.semanticIds[i]!,
        },
        read(state.y),
      );
      styleScratch.size[i] = readStyle(state.size) ?? null;
      styleScratch.linewidth[i] = readStyle(state.linewidth) ?? null;
      styleScratch.alpha[i] = readStyle(state.alpha) ?? null;
      styleScratch.shape[i] = readStyle(state.shape) ?? null;
      styleScratch.linetype[i] = readStyle(state.linetype) ?? null;
      const group = localRow < 0 ? 0 : (state.groups[localRow] ?? 0);
      const cr = ordinalRank(colorRankOf, state.color, localRow);
      const fr = ordinalRank(fillRankOf, state.fill, localRow);
      seriesCol[i] = group;
      rankCol[i] = cr >= 0 ? cr : fr >= 0 ? fr : group;
      sourceOrderCol[i] = rowId;
      lineageCol[i] = lineage.internSingleton(rowId);
      autoModeCol[i] = resolvedAutoModeCode(binding, batch, primitiveIndex, facts.semanticIds[i]!);
    }
    return {
      xValue: xValues,
      yValue: yValues,
      sizeValue: styleColumnFrom(styleScratch.size),
      linewidthValue: styleColumnFrom(styleScratch.linewidth),
      alphaValue: styleColumnFrom(styleScratch.alpha),
      shapeValue: styleColumnFrom(styleScratch.shape),
      linetypeValue: styleColumnFrom(styleScratch.linetype),
      seriesId: seriesCol,
      seriesRank: rankCol,
      sourceOrder: sourceOrderCol,
      lineage: lineageCol,
      autoMode: autoModeCol,
    };
  };

  return (facts) => {
    const binding = bindings[facts.layerIndex];
    const count = facts.primitiveIds.length;
    if (binding === undefined || count === 0) return EMPTY_DATUM_COLUMNS;
    // Contiguity probe: every row backed and ascending by one, both ends in
    // the same table with matching local-row stride.
    const rowIds = facts.rowIds;
    let contiguous = rowIds[0] !== NO_ROW;
    for (let i = 1; contiguous && i < count; i++) {
      if (rowIds[i] !== rowIds[i - 1]! + 1) contiguous = false;
    }
    if (contiguous) {
      const first = sources.locate(rowIds[0]!);
      const last = sources.locate(rowIds[count - 1]!);
      if (
        first !== null &&
        last !== null &&
        first.table === last.table &&
        last.localRow - first.localRow === count - 1
      ) {
        return contiguousColumns(binding, facts, first.table, first.localRow);
      }
    }
    return scatteredColumns(binding, facts);
  };
}
