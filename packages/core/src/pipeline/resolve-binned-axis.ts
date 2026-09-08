/**
 * Resolve a `type: "binned"` axis's transformed-space boundaries before any
 * frame/stat construction, from the parent (pre-facet) table.
 */
import type { PositionScaleSpec } from "@ggts-sh/spec";

import type { ColumnTable } from "../table.js";
import {
  getScaleTransform,
  type ColumnTransformConfig,
  type ScaleTransform,
} from "../scales/transform.js";

import {
  resolveBinnedBoundaries,
  transformExplicitBreaks,
  type BinnedBoundaries,
} from "./binned-scale.js";
import { positionFieldType, type PositionConversionContext } from "./temporal-position.js";
import type { LayerBinding } from "./types-binding.js";
import { PipelineError } from "./types.js";

export function resolveBinnedAxis(
  axis: "x" | "y",
  config: PositionScaleSpec | undefined,
  bindings: readonly LayerBinding[],
  /**
   * Per-binding filtered tables (parallel to `bindings`). Each binding's fields
   * are read from its own table so multi-table layers (#609) train extents and
   * type-check against the owning source, not the primary table alone.
   */
  tables: readonly ColumnTable[],
  conversion: PositionConversionContext,
  transform: ColumnTransformConfig | undefined,
): BinnedBoundaries | undefined {
  if (config?.type !== "binned") return undefined;
  const scaleTransform = transform?.transform ?? getScaleTransform("identity");
  const explicitEdges = resolveExplicitEdges(axis, config.breaks, scaleTransform);
  const measuredExtent = collectBinnedExtent(
    axis,
    bindings,
    tables,
    conversion,
    transform,
    explicitEdges !== null,
  );
  const extent = explicitEdges === null ? measuredExtent : null;
  return resolveBinnedBoundaries(extent, explicitEdges, axis) ?? undefined;
}

function resolveExplicitEdges(
  axis: "x" | "y",
  authoredBreaks: PositionScaleSpec["breaks"],
  transform: ScaleTransform,
): readonly number[] | null {
  if (
    authoredBreaks !== undefined &&
    authoredBreaks.some(
      (value) => typeof value !== "number" || !Number.isFinite(value) || !transform.valid(value),
    )
  ) {
    throw new PipelineError(
      "invalid-scale-breaks",
      `/scales/${axis}/breaks`,
      `A type: "binned" scale requires finite numeric boundaries inside the ${transform.key} transform domain.`,
    );
  }
  const explicitEdges = transformExplicitBreaks(
    authoredBreaks as readonly number[] | undefined,
    transform,
  );
  if (explicitEdges !== null && new Set(explicitEdges).size < 2) {
    throw new PipelineError(
      "invalid-scale-breaks",
      `/scales/${axis}/breaks`,
      `A type: "binned" scale requires at least two distinct usable boundaries.`,
    );
  }
  return explicitEdges;
}

function collectBinnedExtent(
  axis: "x" | "y",
  bindings: readonly LayerBinding[],
  tables: readonly ColumnTable[],
  conversion: PositionConversionContext,
  transform: ColumnTransformConfig | undefined,
  hasExplicitEdges: boolean,
): [number, number] | null {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  const seen = new Set<string>();
  for (let index = 0; index < bindings.length; index++) {
    const binding = bindings[index]!;
    const table = tables[index] ?? tables[0];
    if (table === undefined) continue;
    const isSegment = binding.layer.geom === "segment";
    const fields =
      axis === "x"
        ? [binding.xField, ...(isSegment ? [binding.xendField] : [])]
        : [binding.yField, ...(isSegment ? [binding.yendField] : [])];
    for (const field of fields) {
      if (field === null) continue;
      const seenKey = `${binding.sourceId}|${field}`;
      if (seen.has(seenKey)) continue;
      seen.add(seenKey);
      if (!table.has(field)) continue;
      assertQuantitativeBinnedField(axis, field, table, conversion);
      if (hasExplicitEdges) continue;
      const values =
        transform === undefined
          ? table.numeric(field, conversion.sourceParser, conversion.options)
          : table.transformed(field, conversion.sourceParser, conversion.options, transform)
              .transformed;
      for (const value of values) {
        if (!Number.isFinite(value)) continue;
        lo = Math.min(lo, value);
        hi = Math.max(hi, value);
      }
    }
  }
  return lo <= hi ? [lo, hi] : null;
}

function assertQuantitativeBinnedField(
  axis: "x" | "y",
  field: string,
  table: ColumnTable,
  conversion: PositionConversionContext,
): void {
  const fieldType = positionFieldType(table, field, conversion);
  if (fieldType !== "quantitative") {
    throw new PipelineError(
      "binned-scale-requires-continuous",
      `/scales/${axis}`,
      `A type: "binned" scale on ${axis} is bound to field "${field}" (${fieldType}), which is not quantitative.`,
    );
  }
}
