import type { CandidateBuildFacts, CandidateDatum } from "../candidate-store.js";
import type { LineageStore } from "../identity.js";
import type { Scene } from "../scene.js";
import type { CellValue } from "../table.js";
import type { SourceRegistry } from "./source-registry.js";
import type { StyleRead, createRawResolverState } from "./candidate-source-state.js";
import { sourceBackedInspectY } from "./candidate-source-values.js";
import { candidateAutoMode } from "./frame-candidates-auto-mode.js";
import type { FinalizedLayerFrame, LayerBinding, ResolvedColorScale } from "./types.js";

function preferredRank(colorRank: number, fillRank: number, group: number): number {
  if (colorRank >= 0) return colorRank;
  return fillRank >= 0 ? fillRank : group;
}

export function createRawCandidateDatumResolver(
  bindings: readonly LayerBinding[],
  sources: SourceRegistry,
  color: ResolvedColorScale | null,
  fill: ResolvedColorScale | null,
  lineage: LineageStore<number>,
  shared: ReturnType<typeof createRawResolverState>,
  scene: Scene,
  panelFrames: readonly (readonly FinalizedLayerFrame[])[],
): (facts: CandidateBuildFacts) => CandidateDatum {
  const { stateFor, constantsFor, colorOrdinal, fillOrdinal } = shared;
  return (facts) => {
    const binding = bindings[facts.layerIndex];
    const sourceRow = facts.rowIndex;
    if (binding === undefined || sourceRow === null) return {};
    // One locate per mark (#1308): value reads and grouping share the same
    // row ownership.
    const located = sources.locate(sourceRow);
    const state =
      located === null ? constantsFor(facts.layerIndex) : stateFor(facts.layerIndex, located.table);
    const localRow = located?.localRow ?? -1;
    const read = (column: readonly CellValue[] | null): CellValue =>
      column === null || localRow < 0 ? null : column[localRow]!;
    const readStyle = (style: StyleRead): CellValue =>
      style.column === null ? style.constant : localRow < 0 ? null : style.column[localRow]!;
    // Group 0 is the single-group default, which is what a primitive with no
    // locatable source row (annotations, synthesized marks) should carry.
    const group = localRow < 0 ? 0 : (state.groups[localRow] ?? 0);
    // Rank lookups preserve ordinalColorRank semantics exactly: non-ordinal
    // scales and unmapped fields give -1; an unlocatable row reads null.
    const colorRank =
      colorOrdinal === null || binding.color.field === null
        ? -1
        : (colorOrdinal.scale.indexOf(
            localRow < 0 || state.color === null ? null : state.color[localRow]!,
          ) ?? -1);
    const fillRank =
      fillOrdinal === null || binding.fill.field === null
        ? -1
        : (fillOrdinal.scale.indexOf(
            localRow < 0 || state.fill === null ? null : state.fill[localRow]!,
          ) ?? -1);
    const autoMode = candidateAutoMode(binding, facts.primitiveIndex);
    return {
      xValue: read(state.x),
      yValue: sourceBackedInspectY(
        panelFrames,
        scene,
        {
          panelIndex: facts.panelIndex,
          layerIndex: facts.layerIndex,
          batchIndex: facts.batchIndex,
          primitiveIndex: facts.primitiveIndex,
        },
        read(state.y),
      ),
      sizeValue: readStyle(state.size),
      linewidthValue: readStyle(state.linewidth),
      alphaValue: readStyle(state.alpha),
      shapeValue: readStyle(state.shape),
      linetypeValue: readStyle(state.linetype),
      seriesId: group,
      seriesRank: preferredRank(colorRank, fillRank, group),
      sourceOrder: sourceRow,
      lineage: lineage.intern([sourceRow]),
      ...(autoMode === undefined ? {} : { autoMode }),
    };
  };
}
