/**
 * Legend entry → semantic-key index service.
 *
 * Owns the reactive index Map and keysForLegend lookup previously hosted on
 * the semantic-key service (S13 access contract: reactive getters, not snapped
 * Maps). Re-homes under legend/ so runtime/semantic-keys has zero legend
 * imports (S16 ownership goal).
 */
import type { RenderModel } from "@ggts-sh/core";

import { buildLegendEntryKeyIndexForPlot } from "./entry-key-index.js";
import { keysForLegendEntry } from "./focus.js";
import type { LegendEntryAction } from "./focus.js";

export type LegendEntryKeyIndexDeps = {
  /** Reactive model source (thunk so `$derived` tracks host model updates). */
  model: () => RenderModel | null;
  /**
   * Per-row semantic key lookup. Hosts pass `semanticKeys.keyAt(i)` — not the
   * public `semanticKey(row, index)` method (which needs the row record).
   */
  keyAt: (rowIndex: number) => PropertyKey | null;
};

/**
 * Structural access surface consumed by legend-focus (and any host that needs
 * the entry→key index without depending on the full semantic-key service).
 */
export type LegendEntryKeyAccess = {
  readonly legendEntryKeyIndex: ReadonlyMap<string, readonly PropertyKey[]>;
  keysForLegend(action: LegendEntryAction): readonly PropertyKey[];
};

/**
 * Create the legend entry-key index. Construction registers the `$derived.by`
 * that rebuilds the index when `model` / `keyAt` reactive deps change.
 * Call during host init at the same relative position the index used to occupy
 * inside the semantic-key service (after semanticKeys, before inspection).
 */
export function createLegendEntryKeyIndex(deps: LegendEntryKeyIndexDeps): LegendEntryKeyAccess {
  const legendEntryKeyIndex: ReadonlyMap<string, readonly PropertyKey[]> = $derived.by(() => {
    const model = deps.model();
    return buildLegendEntryKeyIndexForPlot({
      model:
        model === null
          ? null
          : {
              scene: model.scene,
              candidates: model.candidates,
              layerFields: model.layerFields,
              layerScaledConstants: model.layerScaledConstants,
              lineage: model.lineage,
              row: (rowIndex) => model.row(rowIndex),
            },
      semanticKey: (rowIndex) => deps.keyAt(rowIndex),
    });
  });

  function keysForLegend(action: LegendEntryAction): readonly PropertyKey[] {
    return keysForLegendEntry(legendEntryKeyIndex, action.identity);
  }

  return {
    get legendEntryKeyIndex() {
      return legendEntryKeyIndex;
    },
    keysForLegend,
  };
}
