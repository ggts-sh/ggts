/** Lean pipeline endpoint for renderers that consume only the computed Scene. */
import type { PortableSpec, SpecInput } from "@ggts-sh/spec";

import { EDITION_DEFAULTS_SLIM } from "../editions-slim.js";
import { perfMark, perfMeasure } from "../perf.js";
import type { Scene } from "../scene.js";

import { finalizeScene } from "./finalize.js";
import { preparePipelineRun } from "./prepare-run.js";
import type { RunOptions } from "./types.js";

export function runScene(spec: SpecInput | PortableSpec, options: RunOptions): Scene {
  perfMark("ggts:pipeline:start");
  const { scene } = finalizeScene(
    preparePipelineRun(spec, {
      ...options,
      editions: options.editions ?? EDITION_DEFAULTS_SLIM,
    }),
  );
  perfMark("ggts:pipeline:end");
  perfMeasure("ggts:pipeline", "ggts:pipeline:start", "ggts:pipeline:end");
  return scene;
}
