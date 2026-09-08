/**
 * Core runPipeline orchestration: prepare shared state, then build the full
 * RenderModel contract.
 */
import type { SpecInput, PortableSpec } from "@ggts-sh/spec";

import { EDITION_DEFAULTS_SLIM } from "../editions-slim.js";
import { perfMark, perfMeasure } from "../perf.js";

import { finalize } from "./finalize.js";
import { preparePipelineRun } from "./prepare-run.js";
import type { RenderModel, RunOptions } from "./types.js";

export function runPipeline(spec: SpecInput | PortableSpec, options: RunOptions): RenderModel {
  perfMark("ggts:pipeline:start");
  const model = finalize(
    preparePipelineRun(spec, {
      ...options,
      editions: options.editions ?? EDITION_DEFAULTS_SLIM,
    }),
  );
  perfMark("ggts:pipeline:end");
  perfMeasure("ggts:pipeline", "ggts:pipeline:start", "ggts:pipeline:end");
  return model;
}
