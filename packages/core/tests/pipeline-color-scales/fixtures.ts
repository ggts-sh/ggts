import { fromAny } from "@total-typescript/shoehorn";

import type { PortableSpec } from "@ggts-sh/spec";

import { pointFills } from "../../src/mark-style.ts";
import { runPipeline } from "../../src/pipeline.js";

export const size = { width: 640, height: 400 };

export function pointSpec(
  values: readonly unknown[],
  colorScale: Record<string, unknown>,
  legendOrder?: "stable-domain" | "present-first-seen" | "sorted",
): PortableSpec {
  return fromAny({
    data: {
      values: values.map((color, index) => ({ x: index + 1, y: index + 1, color })),
    },
    aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "color" } },
    layers: [{ geom: "point" }],
    scales: { color: colorScale },
    ...(legendOrder !== undefined && { legend: { order: legendOrder } }),
  });
}

export function pointColors(model: ReturnType<typeof runPipeline>): string[] {
  const points = model.scene.batches.find((batch) => batch.kind === "points");
  if (
    points?.kind !== "points" ||
    (points.colors === undefined && points.colorPalette === undefined)
  ) {
    throw new Error("expected mapped point colors");
  }
  return pointFills(points);
}
