/**
 * Bind data (plot + per-layer), facet-partition, and build per-panel LayerFrames.
 */
import type { NormalizedSpec, PortableSpec } from "@ggts-sh/spec";

import { ColumnTable, type CellValue } from "../table.js";

import { bindLayer } from "./bind-layer.js";
import { bindLayerTable, bindPlotData } from "./bind-data.js";
import { configureStyleBindings } from "./bind-layer-style-config.js";
import type { FacetLayout } from "./facets.js";
import { resolveFacet, SINGLE_PANEL } from "./facets.js";
import { facetFieldNames } from "./layer-panel-data.js";
import { warnEmptyData } from "./prepare-panels-empty.js";
import { buildPanelFrames } from "./prepare-panels-frames.js";
import { applyRuntimeRowFilters } from "./prepare-panels-row-filters.js";
import { positionConversionContext } from "./temporal-position.js";
import { assertScaleConfiguration } from "./scale-config-preflight.js";
import { assertTemporalConfiguration, preflightTemporalBindings } from "./temporal-preflight.js";
import type { LayerDataContext, PreparedPanels } from "./prepare-panels-types.js";
import { SourceRegistry } from "./source-registry.js";
import type {
  Advisory,
  FinalizedLayerFrame,
  LayerBinding,
  PipelineWarning,
  RunOptions,
  ScaleDecision,
  ScaleDiagnostic,
} from "./types.js";

export type { PreparedPanels } from "./prepare-panels-types.js";

/**
 * Choose the table used to build facet layout (#608):
 * - `sources` is one filtered table per distinct SourceRegistry namespace
 *   (caller dedupes inherited plot tables so we do not double-count).
 * - Collect every complete source (has all facet fields).
 * - One complete source → use it as-is (panel sourceRows stay real).
 * - Several complete sources → concatenate facet columns so resolveFacet
 *   discovers the union of panel keys (layers still slice by panel identity).
 * - None complete → fall back so resolveFacet can emit unknown-field.
 */
function facetLayoutTable(
  facet: PortableSpec["facet"],
  sources: readonly ColumnTable[],
): ColumnTable {
  const fields = facetFieldNames(facet);
  if (fields.length === 0) {
    return sources[0] ?? ColumnTable.fromRows([]);
  }
  const complete = sources.filter((table) => fields.every((f) => table.has(f)));
  if (complete.length === 0) {
    // Fall back so resolveFacet emits a clear unknown-field.
    return sources[0] ?? ColumnTable.fromRows([]);
  }
  if (complete.length === 1) return complete[0]!;
  return unionFacetKeyColumns(complete, fields);
}

/** Concatenate facet-key columns from complete sources for layout discovery. */
function unionFacetKeyColumns(
  tables: readonly ColumnTable[],
  fields: readonly string[],
): ColumnTable {
  const columns: Record<string, CellValue[]> = {};
  for (const field of fields) columns[field] = [];
  for (const table of tables) {
    const cols = fields.map((f) => table.column(f));
    for (let row = 0; row < table.rowCount; row++) {
      for (let i = 0; i < fields.length; i++) {
        columns[fields[i]!]!.push(cols[i]![row]!);
      }
    }
  }
  return ColumnTable.fromColumns(columns);
}

/**
 * Whether this layer's effective aes maps `clause.scale` to `clause.field`.
 * Legend filters must not hide layers that merely have a same-named column.
 */
function layerMapsLegendFilter(
  layer: NormalizedSpec["layers"][number],
  plotAes: PortableSpec["aes"],
  clause: NonNullable<RunOptions["rowFilters"]>[number],
): boolean {
  const channel = clause.scale;
  const mapped = layer.aes?.[channel] ?? plotAes?.[channel];
  if (mapped === undefined || mapped === null || typeof mapped !== "object") return false;
  return "field" in mapped && mapped.field === clause.field;
}

/** Apply rowFilters only for clauses this layer maps on the matching scale. */
function filterLayerTable(
  table: ColumnTable,
  clauses: RunOptions["rowFilters"],
  layer?: NormalizedSpec["layers"][number],
  plotAes?: PortableSpec["aes"],
): { table: ColumnTable; sourceRows: number[] | null } {
  if (clauses === undefined || clauses.length === 0) return { table, sourceRows: null };
  const applicable = clauses.filter((c) => {
    if (!table.has(c.field)) return false;
    if (layer === undefined) return true;
    return layerMapsLegendFilter(layer, plotAes, c);
  });
  return applyRuntimeRowFilters(table, applicable);
}

function buildLayerContexts(
  normalized: NormalizedSpec,
  options: RunOptions,
  plotSource: ColumnTable | null,
  registry: SourceRegistry,
): LayerDataContext[] {
  const namedTableCache = new Map<string, ColumnTable>();
  const plotData = normalized.data;
  if (
    plotSource !== null &&
    plotData !== undefined &&
    "name" in plotData &&
    !("values" in plotData) &&
    !("columns" in plotData)
  )
    namedTableCache.set(plotData.name, plotSource);
  const layerContexts: LayerDataContext[] = [];
  for (let index = 0; index < normalized.layers.length; index++) {
    const layer = normalized.layers[index]!;
    const layerData = layer.data;
    let sourceTable: ColumnTable;
    if (
      layerData !== undefined &&
      "name" in layerData &&
      !("values" in layerData) &&
      !("columns" in layerData)
    ) {
      const cacheKey = layerData.name;
      const cached = namedTableCache.get(cacheKey);
      sourceTable = cached ?? bindLayerTable(layerData, plotSource, index, normalized, options);
      if (cached === undefined) namedTableCache.set(cacheKey, sourceTable);
    } else if (layerData === undefined && plotSource !== null) {
      sourceTable = plotSource;
    } else {
      sourceTable = bindLayerTable(layerData, plotSource, index, normalized, options);
      if (layerData !== undefined && "name" in layerData)
        namedTableCache.set(layerData.name, sourceTable);
    }
    const sourceId = registry.register(sourceTable);
    const filtered = filterLayerTable(sourceTable, options.rowFilters, layer, normalized.aes);
    layerContexts.push({
      sourceTable,
      filteredTable: filtered.table,
      filteredToSource: filtered.sourceRows,
      sourceId,
    });
  }
  return layerContexts;
}

function buildEmptyDataBindings(
  normalized: NormalizedSpec,
  layerContexts: LayerDataContext[],
  sourceTable: ColumnTable,
  conversions: {
    x: ReturnType<typeof positionConversionContext>;
    y: ReturnType<typeof positionConversionContext>;
  },
  warnings: PipelineWarning[],
  advisories: Advisory[],
): {
  bindings: LayerBinding[];
  decisions: ScaleDecision[];
  diagnostics: ScaleDiagnostic[];
  xConversion: typeof conversions.x;
  yConversion: typeof conversions.y;
} {
  const bindings: LayerBinding[] = [];
  for (let index = 0; index < normalized.layers.length; index++) {
    const ctx = layerContexts[index]!;
    const binding = bindLayer(
      normalized.layers[index]!,
      index,
      ctx.filteredTable,
      warnings,
      conversions,
      { sourceTable: ctx.sourceTable, sourceId: ctx.sourceId },
    );
    binding.color.forcedDiscrete = ["ordinal", "manual"].includes(
      normalized.scales?.color?.type ?? "",
    );
    binding.fill.forcedDiscrete = ["ordinal", "manual"].includes(
      normalized.scales?.fill?.type ?? "",
    );
    configureStyleBindings(binding, normalized.scales, ctx.filteredTable);
    bindings.push(binding);
  }
  const temporal = preflightTemporalBindings({
    table: sourceTable,
    bindings,
    warnings,
    advisories,
    conversions,
    layerTables: layerContexts.map((c) => c.sourceTable),
  });
  return {
    bindings,
    decisions: temporal.decisions,
    diagnostics: temporal.diagnostics,
    xConversion: temporal.xConversion,
    yConversion: temporal.yConversion,
  };
}

function buildFacetLayout(
  normalized: NormalizedSpec,
  layerContexts: LayerDataContext[],
  plotSource: ColumnTable | null,
  primaryFiltered: { table: ColumnTable; sourceRows: number[] | null },
  emptyData: boolean,
  warnings: PipelineWarning[],
): FacetLayout {
  const layoutSources: ColumnTable[] = [];
  const seenSourceTables = new Set<ColumnTable>();
  if (plotSource !== null) {
    layoutSources.push(primaryFiltered.table);
    seenSourceTables.add(plotSource);
  }
  for (const ctx of layerContexts) {
    if (seenSourceTables.has(ctx.sourceTable)) continue;
    seenSourceTables.add(ctx.sourceTable);
    layoutSources.push(ctx.filteredTable);
  }
  const layoutTable = facetLayoutTable(normalized.facet, layoutSources);
  const hasClosedLevels =
    normalized.facet?.wrap?.levels !== undefined ||
    normalized.facet?.rows?.levels !== undefined ||
    normalized.facet?.cols?.levels !== undefined;
  return emptyData && !hasClosedLevels
    ? SINGLE_PANEL(primaryFiltered.table, primaryFiltered.sourceRows)
    : resolveFacet(normalized.facet, layoutTable, null, warnings);
}

export function preparePanels(
  normalized: NormalizedSpec,
  options: RunOptions,
  warnings: PipelineWarning[],
  advisories: Advisory[],
): PreparedPanels {
  const registry = new SourceRegistry();
  const plotSource = bindPlotData(normalized, options);
  const layerContexts = buildLayerContexts(normalized, options, plotSource, registry);

  // Primary table: plot source when present, else first layer source (for
  // legacy prepared.table / prepared.sourceTable consumers).
  const sourceTable = plotSource ?? layerContexts[0]?.sourceTable ?? ColumnTable.fromRows([]);
  const primaryFiltered =
    plotSource === null
      ? {
          table: layerContexts[0]?.filteredTable ?? ColumnTable.fromRows([]),
          sourceRows: layerContexts[0]?.filteredToSource ?? null,
        }
      : filterLayerTable(plotSource, options.rowFilters);
  const table = primaryFiltered.table;

  const emptyData = layerContexts.every((ctx) => ctx.filteredTable.rowCount === 0);
  if (emptyData) warnEmptyData(warnings);

  const conversions = {
    x: positionConversionContext(normalized.scales?.x),
    y: positionConversionContext(normalized.scales?.y),
  };
  assertTemporalConfiguration("x", conversions.x);
  assertTemporalConfiguration("y", conversions.y);
  assertScaleConfiguration("x", normalized.scales?.x);
  assertScaleConfiguration("y", normalized.scales?.y);

  const facetLayout = buildFacetLayout(
    normalized,
    layerContexts,
    plotSource,
    primaryFiltered,
    emptyData,
    warnings,
  );
  const { faceted, nrow, ncol, strip } = facetLayout;
  const facetPanels = facetLayout.panels;
  const freeX = faceted && facetLayout.freeX;
  const freeY = faceted && facetLayout.freeY;
  const facetFields = facetFieldNames(normalized.facet);

  let bindings: LayerBinding[] = [];
  let panelFrames: FinalizedLayerFrame[][] = facetPanels.map(() => []);
  let scaleDecisions: ScaleDecision[] = [];
  let scaleDiagnostics: ScaleDiagnostic[] = [];
  let resolvedConversions = conversions;

  if (!emptyData) {
    const built = buildPanelFrames({
      normalized,
      layerContexts,
      registry,
      facetPanels,
      faceted,
      facetFields,
      freeX,
      warnings,
      advisories,
      conversions,
    });
    bindings = built.bindings;
    panelFrames = built.panelFrames;
    scaleDecisions = built.scaleDecisions;
    scaleDiagnostics = built.scaleDiagnostics;
    resolvedConversions = { x: built.xConversion, y: built.yConversion };
  } else if (
    sourceTable.fields.length > 0 ||
    layerContexts.some((c) => c.sourceTable.fields.length > 0)
  ) {
    const built = buildEmptyDataBindings(
      normalized,
      layerContexts,
      sourceTable,
      conversions,
      warnings,
      advisories,
    );
    bindings = built.bindings;
    scaleDecisions = built.decisions;
    scaleDiagnostics = built.diagnostics;
    resolvedConversions = { x: built.xConversion, y: built.yConversion };
  }

  return {
    table,
    sourceTable,
    sourceRegistry: registry,
    layerContexts,
    emptyData,
    faceted,
    freeX,
    freeY,
    nrow,
    ncol,
    strip,
    facetPanels,
    bindings,
    panelFrames,
    scaleDecisions,
    scaleDiagnostics,
    xConversion: resolvedConversions.x,
    yConversion: resolvedConversions.y,
  };
}
