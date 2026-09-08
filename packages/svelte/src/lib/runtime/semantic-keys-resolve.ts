/**
 * Pure resolveSemanticKeys: durable row keys + interaction diagnostics.
 * Source identity / epoch tokens: semantic-source-identity.ts,
 * semantic-data-identity.ts. Projection cache: semantic-keys-projection.ts.
 */
import type { CellValue } from "@ggts-sh/core";

import type { InteractionDiagnostic } from "../interaction/interaction.js";
import { INTERACTION_DIAGNOSTIC_CATALOG } from "../interaction/interaction.js";

export type SemanticKeyCandidate = {
  readonly id: number;
  readonly rowIndex: number | null;
  readonly layerIndex: number;
  readonly lineage: number;
};

type SemanticKeyLayer = {
  readonly geom: string;
  readonly params?: Record<string, unknown> | undefined;
};

/** Narrow model surface needed for key resolution (no RenderModel import). */
export type SemanticKeyModelView = {
  readonly candidateCount: number;
  candidate(id: number): SemanticKeyCandidate | null;
  lineageKeys(lineageId: number): Iterable<number>;
  row(rowIndex: number): Record<string, CellValue> | null;
  readonly layers: readonly SemanticKeyLayer[];
};

export type ResolveSemanticKeysInput = {
  readonly model: SemanticKeyModelView;
  readonly datumKey:
    | string
    | number
    | symbol
    | ((row: never, index: number) => PropertyKey)
    | undefined;
  /**
   * Mutable per-component map of rowIdentity → last key. Caller owns lifetime;
   * this function mutates it in place (same as GGPlot historically).
   */
  readonly priorKeys: Map<string, PropertyKey>;
  /** Stable identity for a source row within the current data/spec epoch. */
  readonly rowIdentity: (rowIndex: number) => string;
};

export type ResolveSemanticKeysResult = {
  readonly keys: Map<number, PropertyKey | null>;
  readonly diagnostics: InteractionDiagnostic[];
};

/** Empty semantic-key bag when there is no render model. */
function emptySemanticKeysResult(): ResolveSemanticKeysResult {
  return {
    keys: new Map<number, PropertyKey | null>(),
    diagnostics: [],
  };
}

export type SemanticKeysPlotModel = {
  readonly candidates: {
    readonly size: number;
    candidate(id: number): SemanticKeyCandidate | null;
  };
  readonly lineage: { keys(lineageId: number): Iterable<number> };
  row(rowIndex: number): Record<string, CellValue> | null;
};

/**
 * Resolve semantic keys for a GGPlot host: null model → empty bag; else adapt
 * the render model into `SemanticKeyModelView` and call `resolveSemanticKeys`.
 */
export function resolveSemanticKeysForPlot(input: {
  readonly model: SemanticKeysPlotModel | null;
  readonly layers: readonly SemanticKeyLayer[];
  readonly datumKey: ResolveSemanticKeysInput["datumKey"];
  readonly priorKeys: Map<string, PropertyKey>;
  readonly dataToken: string;
  readonly specToken: string;
}): ResolveSemanticKeysResult {
  if (input.model === null) return emptySemanticKeysResult();
  const model = input.model;
  return resolveSemanticKeys({
    model: {
      candidateCount: model.candidates.size,
      candidate: (id) => model.candidates.candidate(id),
      lineageKeys: (lineageId) => model.lineage.keys(lineageId),
      row: (rowIndex) => model.row(rowIndex),
      layers: input.layers,
    },
    datumKey: input.datumKey,
    priorKeys: input.priorKeys,
    rowIdentity: (rowIndex) => `${input.dataToken}:${input.specToken}:${rowIndex}`,
  });
}

function sourceRowsForSemanticKeys(
  model: SemanticKeyModelView,
  diagnostics: InteractionDiagnostic[],
): Set<number> {
  const sourceRows = new Set<number>();
  if (
    model.candidateCount === 0 &&
    model.layers.some(
      (layer) =>
        layer.geom === "rule" &&
        (layer.params?.["xintercept"] !== undefined || layer.params?.["yintercept"] !== undefined),
    )
  )
    diagnostics.push({
      ...INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_MISSING_LINEAGE,
      actual: "synthetic rule has no source rows",
    });

  const lineageEmpty = new Map<number, boolean>();
  for (let id = 0; id < model.candidateCount; id++) {
    const candidate = model.candidate(id);
    if (candidate === null) continue;
    if (candidate.rowIndex !== null) sourceRows.add(candidate.rowIndex);
    const lineageId = candidate.lineage;
    let empty = lineageEmpty.get(lineageId);
    if (empty === undefined) {
      empty = true;
      for (const rowIndex of model.lineageKeys(lineageId)) {
        empty = false;
        sourceRows.add(rowIndex);
      }
      lineageEmpty.set(lineageId, empty);
    }
    if (candidate.rowIndex === null && empty)
      diagnostics.push({
        ...INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_MISSING_LINEAGE,
        actual: { layerIndex: candidate.layerIndex, candidateId: candidate.id },
      });
  }
  return sourceRows;
}

/**
 * Resolve durable semantic keys for interaction, emitting diagnostics in
 * encounter order: synthetic-rule missing lineage, per-candidate missing
 * lineage, then per-row invalid / unstable / duplicate key diagnostics.
 */
export function resolveSemanticKeys(input: ResolveSemanticKeysInput): ResolveSemanticKeysResult {
  const keys = new Map<number, PropertyKey | null>();
  const diagnostics: InteractionDiagnostic[] = [];
  const { model, datumKey, priorKeys, rowIdentity } = input;
  if (datumKey === undefined) return { keys, diagnostics };

  const owners = new Map<PropertyKey, number>();
  // Expand each lineage id once. Smooth / aggregate eval-grid marks share one
  // membership array across C marks (#1140) — re-spreading was O(C·L).
  const sourceRows = sourceRowsForSemanticKeys(model, diagnostics);

  for (const rowIndex of sourceRows) {
    const row = model.row(rowIndex);
    const value =
      row === null
        ? null
        : typeof datumKey === "function"
          ? (datumKey as (row: Record<string, CellValue>, index: number) => PropertyKey)(
              row,
              rowIndex,
            )
          : row[datumKey as string];
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "symbol") {
      keys.set(rowIndex, null);
      diagnostics.push({
        ...INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_INVALID_KEY,
        actual: value,
      });
      continue;
    }
    if (row !== null) {
      const identity = rowIdentity(rowIndex);
      const priorKey = priorKeys.get(identity);
      if (priorKey !== undefined && priorKey !== value) {
        keys.set(rowIndex, null);
        diagnostics.push({
          ...INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_UNSTABLE_KEY,
          actual: { previous: priorKey, current: value },
        });
        continue;
      }
      priorKeys.set(identity, value);
    }
    const prior = owners.get(value);
    if (prior !== undefined && prior !== rowIndex) {
      keys.set(prior, null);
      keys.set(rowIndex, null);
      diagnostics.push({
        ...INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_DUPLICATE_KEY,
        actual: value,
      });
    } else {
      owners.set(value, rowIndex);
      keys.set(rowIndex, value);
    }
  }
  return { keys, diagnostics };
}
