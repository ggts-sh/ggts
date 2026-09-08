import type { PointerEvent } from "react";
import { encodeKey } from "@ggsvelte/core";
import type { PlotRect, RenderModel } from "@ggsvelte/core";
import type {
  InteractionSource,
  ReadonlyIntervalDomains,
  SemanticIntervalAxis,
} from "@ggsvelte/core/interaction";
type Point = { x: number; y: number };

export const rectangle = (a: Point, b: Point): PlotRect => ({
  x0: Math.min(a.x, b.x),
  y0: Math.min(a.y, b.y),
  x1: Math.max(a.x, b.x),
  y1: Math.max(a.y, b.y),
});
export const sourceOf = (event: PointerEvent): InteractionSource =>
  event.pointerType === "touch" ? "touch" : "pointer";

export function semanticDomainsForRect(
  model: RenderModel,
  panelId: string,
  rect: PlotRect,
  mode: "x" | "y" | "xy",
): ReadonlyIntervalDomains {
  const panel = model.viewport.panel(panelId);
  if (panel === null) return {};
  const inverted = panel.invert(rect);
  const result: { x?: SemanticIntervalAxis; y?: SemanticIntervalAxis } = {};
  for (const axis of ["x", "y"] as const) {
    if (mode !== "xy" && mode !== axis) continue;
    const bounds = inverted[axis];
    if (bounds === undefined) continue;
    const scale = panel.axisEditModel(axis);
    if (scale.kind === "band") {
      // project/resolve share core's encoded, ordered category identity.
      const values = scale.slice(bounds);
      if (values !== undefined && values.length > 0) {
        // Imported lazily as a pure binding below; no string coercion of categories.
        result[axis] = { kind: "band", values: values.map((value) => encodeKey(value)) };
      }
    } else if (bounds.every((value) => typeof value === "number" && Number.isFinite(value))) {
      result[axis] = {
        kind: scale.type,
        transform: scale.transform,
        domain: bounds as [number, number],
      };
    }
  }
  return result;
}

export function moveKeyboardPoint(
  point: Point,
  bounds: PlotRect,
  direction: "left" | "right" | "up" | "down",
  step: number,
): Point {
  return {
    x: Math.max(
      bounds.x0,
      Math.min(
        bounds.x1,
        point.x + (direction === "left" ? -step : direction === "right" ? step : 0),
      ),
    ),
    y: Math.max(
      bounds.y0,
      Math.min(bounds.y1, point.y + (direction === "up" ? -step : direction === "down" ? step : 0)),
    ),
  };
}
