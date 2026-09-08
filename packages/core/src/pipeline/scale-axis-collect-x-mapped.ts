/**
 * Collect x evidence from mapped xValues/xNumeric (including bar discretization).
 */
import type { PositionScaleSpec } from "@ggts-sh/spec";

import type { AxisCollectAcc } from "./scale-axis-collect-acc.js";
import { positionFieldType, xConversionOf } from "./temporal-position.js";
import type { Advisory, LayerFrame } from "./types.js";

function collectMappedXEndEvidence(
  frame: LayerFrame,
  conversion: ReturnType<typeof xConversionOf>,
  acc: AxisCollectAcc,
): void {
  if (frame.xend === null || frame.xend === undefined) return;
  acc.numeric.push(frame.xend);
  if (frame.xendValues !== null && frame.xendValues !== undefined) {
    acc.columns.push(frame.xendValues);
  }
  const endField = frame.binding.xendField;
  if (endField !== null && frame.table.has(endField)) {
    const endType = positionFieldType(frame.table, endField, conversion);
    acc.typeParts.add(endType);
    if (endType === "nominal") acc.anyDiscrete = true;
    if (endType !== "temporal") acc.allTemporal = false;
  } else {
    acc.typeParts.add("quantitative");
    acc.allTemporal = false;
  }
  acc.sawContinuousEvidence = true;
}

export function collectMappedXEvidence(
  frame: LayerFrame,
  configType: PositionScaleSpec["type"] | undefined,
  advisories: Advisory[],
  acc: AxisCollectAcc,
): void {
  if (frame.xValues === null && frame.xNumeric === null) return;
  if (frame.xValues !== null) acc.columns.push(frame.xValues);
  if (frame.xNumeric !== null) acc.numeric.push(frame.xNumeric);
  const { binding } = frame;
  // Binned identity geoms render centers but the affine display domain must
  // include the full outer edges so bars do not project beyond the panel.
  if (binding.xBinning !== undefined) {
    acc.numeric.push(Float64Array.from(binding.xBinning.edges));
  }
  const geom = binding.layer.geom;
  const field = binding.xField!;
  const conversion = xConversionOf(binding);
  const fieldType = frame.table.has(field)
    ? positionFieldType(frame.table, field, conversion)
    : "quantitative";
  acc.typeParts.add(fieldType);
  const barX = (geom === "bar" || geom === "col") && binding.layer.stat !== "bin";
  if (barX && fieldType !== "nominal" && configType === undefined) {
    advisories.push({
      code: "bar-x-discretized",
      path: `layers.${binding.index}`,
      chosen: `x treated as discrete bands (${geom} geom)`,
      howToOverride: "Use point/line/area for continuous x, or set scales.x.type explicitly.",
    });
  }
  if (barX || fieldType === "nominal") acc.anyDiscrete = true;
  if (fieldType !== "temporal") acc.allTemporal = false;
  acc.sawContinuousEvidence = true;

  collectMappedXEndEvidence(frame, conversion, acc);
}
