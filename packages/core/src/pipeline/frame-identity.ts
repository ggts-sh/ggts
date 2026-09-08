/**
 * Identity-stat LayerFrame (source columns, optional ymin/ymax).
 */
import type { SpokeParams } from "@ggts-sh/spec";

import type { ColumnTable } from "../table.js";
import type { CellValue } from "../table-types.js";

import { spokeEndpoints } from "../stats/spoke.js";
import { binIdColumn, snapColumnToBins, type BinnedBoundaries } from "./binned-scale.js";
import { emptyFrameExtras } from "./frame-helpers.js";
import { positionColumn } from "./temporal-position.js";
import type { ColumnTransformConfig } from "../scales/transform.js";
import type { PositionConversionContext } from "./temporal-position.js";
import type { LayerBinding, LayerFrame } from "./types.js";

/**
 * Read one field into transformed scale-space, then (when binned) snap to the
 * bin's transformed center. Identity marks render at the center while keeping
 * the raw source value for tooltips (`xValues`/`yValues`, untouched here).
 */
function positionNumeric(
  table: ColumnTable,
  field: string,
  conversion: PositionConversionContext,
  transform: ColumnTransformConfig | undefined,
  binning: BinnedBoundaries | undefined,
): Float64Array {
  return snapColumnToBins(positionColumn(table, field, conversion, transform), binning);
}

/** Stable integer bin id per row for a binned field (null when unbinned). */
function binIdOf(
  table: ColumnTable,
  field: string,
  conversion: PositionConversionContext,
  transform: ColumnTransformConfig | undefined,
  binning: BinnedBoundaries | undefined,
): Int32Array | null {
  if (binning === undefined) return null;
  return binIdColumn(positionColumn(table, field, conversion, transform), binning);
}

/** Apply the same pre-stat transform used for x/y to semantic endpoint arrays. */
function applyPositionTransform(
  semantic: Float64Array,
  transform: ColumnTransformConfig | undefined,
): Float64Array {
  if (transform === undefined) return semantic;
  const out = new Float64Array(semantic.length);
  for (let i = 0; i < semantic.length; i++) {
    const value = semantic[i]!;
    out[i] = transform.transform.valid(value) ? transform.transform.forward(value) : Number.NaN;
  }
  return out;
}

function spokeAngleRadius(
  binding: LayerBinding,
  table: ColumnTable,
  n: number,
): { angle: Float64Array; radius: Float64Array } {
  const params = (binding.layer.params ?? {}) as SpokeParams;
  const angle = new Float64Array(n);
  const radius = new Float64Array(n);
  if (binding.angleField === null) {
    angle.fill(params.angle ?? 0);
  } else {
    angle.set(table.numeric(binding.angleField));
  }
  if (binding.radiusField === null) {
    radius.fill(params.radius ?? 1);
  } else {
    radius.set(table.numeric(binding.radiusField));
  }
  return { angle, radius };
}

function columnOrNull(table: ColumnTable, field: string | null): readonly CellValue[] | null {
  return field === null ? null : table.column(field);
}

export function buildIdentityFrame(
  binding: LayerBinding,
  table: ColumnTable,
  groups: readonly number[],
): LayerFrame {
  const n = table.rowCount;
  return {
    binding,
    table,
    n,
    xValues: binding.xField === null ? null : table.column(binding.xField),
    xNumeric:
      binding.xField === null
        ? null
        : positionNumeric(
            table,
            binding.xField,
            binding.xConversion,
            binding.xTransform,
            binding.xBinning,
          ),
    yValues: binding.yField === null ? null : table.column(binding.yField),
    yNumeric:
      binding.yField === null
        ? null
        : positionNumeric(
            table,
            binding.yField,
            binding.yConversion,
            binding.yTransform,
            binding.yBinning,
          ),
    groups,
    inputGroups: groups,
    inputSourceRows: null,
    // Identity row map: avoid Uint32Array.from(callback) (alloc + per-index
    // call) — competitive line-3×10k builds this once per frame (#1468).
    rowIndex: (() => {
      const rows = new Uint32Array(n);
      for (let i = 0; i < n; i++) rows[i] = i;
      return rows;
    })(),
    colorValues: columnOrNull(table, binding.color.field),
    fillValues: columnOrNull(table, binding.fill.field),
    sizeValues: columnOrNull(table, binding.size.field),
    linewidthValues: columnOrNull(table, binding.linewidth.field),
    alphaValues: columnOrNull(table, binding.alpha.field),
    shapeValues: columnOrNull(table, binding.shape.field),
    linetypeValues: columnOrNull(table, binding.linetype.field),
    labelValues: columnOrNull(table, binding.labelField),
    ...emptyFrameExtras(),
    bin: (() => {
      const xId =
        binding.xField === null
          ? null
          : binIdOf(
              table,
              binding.xField,
              binding.xConversion,
              binding.xTransform,
              binding.xBinning,
            );
      const yId =
        binding.yField === null
          ? null
          : binIdOf(
              table,
              binding.yField,
              binding.yConversion,
              binding.yTransform,
              binding.yBinning,
            );
      return xId === null && yId === null ? null : { xId, yId };
    })(),
    ymin:
      binding.yminField === null
        ? null
        : positionNumeric(
            table,
            binding.yminField,
            binding.yConversion,
            binding.yTransform,
            binding.yBinning,
          ),
    ymax:
      binding.ymaxField === null
        ? null
        : positionNumeric(
            table,
            binding.ymaxField,
            binding.yConversion,
            binding.yTransform,
            binding.yBinning,
          ),
    // Only ribbon (and stats that write xmin/xmax themselves) consume these
    // fields — do not populate them for unrelated geoms that happen to map
    // xmin/xmax, or scale collection treats the layer as edge/bin evidence.
    xmin:
      (binding.layer.geom === "rect" || binding.layer.geom === "ribbon") &&
      binding.xminField !== null
        ? positionNumeric(
            table,
            binding.xminField,
            binding.xConversion,
            binding.xTransform,
            binding.xBinning,
          )
        : null,
    xmax:
      (binding.layer.geom === "rect" || binding.layer.geom === "ribbon") &&
      binding.xmaxField !== null
        ? positionNumeric(
            table,
            binding.xmaxField,
            binding.xConversion,
            binding.xTransform,
            binding.xBinning,
          )
        : null,
    // Segment/curve: mapped xend/yend. Spoke: derive ends in data space then transform.
    ...(() => {
      if (binding.layer.geom === "segment" || binding.layer.geom === "curve") {
        return {
          xend:
            binding.xendField === null
              ? null
              : positionNumeric(
                  table,
                  binding.xendField,
                  binding.xConversion,
                  binding.xTransform,
                  binding.xBinning,
                ),
          yend:
            binding.yendField === null
              ? null
              : positionNumeric(
                  table,
                  binding.yendField,
                  binding.yConversion,
                  binding.yTransform,
                  binding.yBinning,
                ),
          xendValues: binding.xendField === null ? null : table.column(binding.xendField),
          yendValues: binding.yendField === null ? null : table.column(binding.yendField),
        };
      }
      if (binding.layer.geom === "spoke" && binding.xField !== null && binding.yField !== null) {
        // Semantic (pre-transform) origin for tip math; re-apply x/y transforms after.
        const xSem = positionColumn(table, binding.xField, binding.xConversion);
        const ySem = positionColumn(table, binding.yField, binding.yConversion);
        const { angle, radius } = spokeAngleRadius(binding, table, n);
        const tips = spokeEndpoints(xSem, ySem, angle, radius);
        return {
          xend: applyPositionTransform(tips.xend, binding.xTransform),
          yend: applyPositionTransform(tips.yend, binding.yTransform),
          xendValues: null,
          yendValues: null,
        };
      }
      return { xend: null, yend: null, xendValues: null, yendValues: null };
    })(),
  };
}
