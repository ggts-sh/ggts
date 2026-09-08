/**
 * Reactive semantic-key service for GGPlot.
 *
 * Owns priorKeys, derived key resolution, candidate key cache, and diagnostics
 * delivery. Pure helpers: semantic-keys-resolve.ts, semantic-keys-projection.ts,
 * semantic-data-identity.ts, semantic-source-identity.ts.
 */
import type { CandidateFacts, CellValue, RenderModel } from "@ggts-sh/core";
import type { PortableSpec } from "@ggts-sh/spec";

import type { InteractionDiagnostic } from "../interaction/interaction.js";
import {
  candidateSemanticKeysFromCache,
  createCandidateKeysProjectionCache,
} from "./semantic-keys-projection.js";
import { resolveSemanticKeysForPlot } from "./semantic-keys-resolve.js";

export type SemanticKeyServiceDeps = {
  model: () => RenderModel | null;
  assembled: () => PortableSpec | null;
  datumKey: () =>
    | string
    | number
    | symbol
    | ((row: never, index: number) => PropertyKey)
    | undefined;
  data: () => unknown;
  spec: () => unknown;
  sourceIdentity: (value: unknown) => string;
  deliverDiagnostic: (diagnostic: InteractionDiagnostic) => void;
};

export type SemanticKeyService = {
  semanticKey(row: Record<string, CellValue> | null, index: number | null): PropertyKey | null;
  candidateSemanticKeys(candidate: CandidateFacts): PropertyKey[];
  /** Direct map lookup (inspection coordinator / mask paths). */
  keyAt(index: number): PropertyKey | null;
};

/**
 * Owns priorKeys, semantic key resolution, and diagnostics delivery.
 * Diagnostics `$effect` registers at construction (#627).
 */
export function createSemanticKeyService(deps: SemanticKeyServiceDeps): SemanticKeyService {
  // Owned for the component lifetime; resolveSemanticKeys mutates in place.
  const priorKeys = new Map<string, PropertyKey>();

  const semanticKeys = $derived.by(() => {
    const model = deps.model();
    return resolveSemanticKeysForPlot({
      model:
        model === null
          ? null
          : {
              candidates: model.candidates,
              lineage: model.lineage,
              row: (rowIndex) => model.row(rowIndex),
            },
      layers: deps.assembled()?.layers ?? [],
      datumKey: deps.datumKey(),
      priorKeys,
      dataToken: deps.sourceIdentity(deps.data()),
      specToken: deps.sourceIdentity(deps.spec()),
    });
  });

  $effect(() => {
    for (const diagnostic of semanticKeys.diagnostics) deps.deliverDiagnostic(diagnostic);
  });

  function semanticKey(
    row: Record<string, CellValue> | null,
    index: number | null,
  ): PropertyKey | null {
    if (row === null || index === null || deps.datumKey() === undefined) return null;
    return semanticKeys.keys.get(index) ?? null;
  }

  /**
   * Shared candidate→semantic-keys cache for the current model/key epoch.
   * Interval, selection anchors, and interaction masks all used to re-walk
   * lineage independently (~3× O(C×L) per reactive turn). Entries fill lazily
   * on first lookup so single-candidate paths (point toggle) stay O(L); full
   * store consumers share one projection after the first walk. Smooth
   * eval-grid marks that share a lineage expand membership once, not once
   * per mark. Cache bags are mutated after the derived produces them —
   * intentional memoization, not reactive state. Fresh bag when model/keys change.
   */
  const candidateKeysEpoch = $derived.by(() => {
    const model = deps.model();
    // Depend on the row-key bag so key invalidation clears the cache.
    const rowKeys = semanticKeys.keys;
    return {
      model,
      rowKeys,
      cache: createCandidateKeysProjectionCache(),
    };
  });

  function candidateSemanticKeys(candidate: CandidateFacts): PropertyKey[] {
    const { model, rowKeys, cache } = candidateKeysEpoch;
    if (model === null) return [];
    return candidateSemanticKeysFromCache(
      candidate,
      cache,
      (lineageId) => model.lineage.keys(lineageId),
      (rowIndex) => rowKeys.get(rowIndex) ?? null,
    );
  }

  return {
    semanticKey,
    candidateSemanticKeys,
    keyAt(index: number): PropertyKey | null {
      return semanticKeys.keys.get(index) ?? null;
    },
  };
}
