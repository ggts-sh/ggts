/**
 * Shared point-geom model builder for suites that need a discrete color
 * legend at a chosen viewport (modelFor covers the fixed-viewport case).
 */
import { runPipeline, type RenderModel } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

const defaultPointAes: Parameters<typeof aes>[0] = { x: "x", y: "y", color: "id" };
const defaultPointSize = { width: 400, height: 300 };

export const buildPointModel = (
  data: { id: string; x: number; y: number }[],
  aesSpec: Parameters<typeof aes>[0] = defaultPointAes,
  size: { width: number; height: number } = defaultPointSize,
): RenderModel => runPipeline(gg(data, aes(aesSpec)).geomPoint().spec(), size);
