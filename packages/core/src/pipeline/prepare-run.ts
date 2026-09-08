import type { PortableSpec, SpecInput } from "@ggts-sh/spec";

import {
  needsUncensoredBaselinePass,
  trainUncensoredBaselineDomains,
} from "./baseline-uncensored.js";
import type { PipelineRunState } from "./finalize.js";
import { preparePanels } from "./prepare-panels.js";
import { allocatePipelineRunId } from "./run-id.js";
import { setupPipelineRun } from "./setup-run.js";
import { trainPipelineScales } from "./train-pipeline-scales.js";
import type { Advisory, PipelineWarning, RunOptions } from "./types.js";
import { perfMark, perfMeasure } from "../perf.js";

/** Setup, bind, and train the shared run state consumed by either finalizer. */
export function preparePipelineRun(
  spec: SpecInput | PortableSpec,
  options: RunOptions,
): PipelineRunState {
  const runId = allocatePipelineRunId();
  const warnings: PipelineWarning[] = [];
  const advisories: Advisory[] = [];

  const { normalized, editionDefaults, theme, flip } = setupPipelineRun(
    spec,
    options.editions,
    warnings,
  );

  let runOptions = options;
  if (needsUncensoredBaselinePass(options, normalized.scales)) {
    perfMark("ggts:baseline:start");
    const baselineDomains = trainUncensoredBaselineDomains({
      normalized,
      options,
      editionDefaults,
    });
    runOptions = { ...options, baselineDomains };
    perfMark("ggts:baseline:end");
    perfMeasure("ggts:baseline", "ggts:baseline:start", "ggts:baseline:end");
  }

  perfMark("ggts:bind:start");
  const prepared = preparePanels(normalized, runOptions, warnings, advisories);
  perfMark("ggts:bind:end");
  perfMeasure("ggts:bind", "ggts:bind:start", "ggts:bind:end");

  perfMark("ggts:scales:start");
  const trained = trainPipelineScales({
    normalized,
    options: runOptions,
    table: prepared.table,
    sourceTable: prepared.sourceTable,
    bindings: prepared.bindings,
    facetPanels: prepared.facetPanels,
    panelFrames: prepared.panelFrames,
    freeX: prepared.freeX,
    freeY: prepared.freeY,
    xConversion: prepared.xConversion,
    yConversion: prepared.yConversion,
    editionDefaults,
    warnings,
    advisories,
  });
  perfMark("ggts:scales:end");
  perfMeasure("ggts:scales", "ggts:scales:start", "ggts:scales:end");

  return {
    runId,
    normalized,
    options: runOptions,
    theme,
    flip,
    prepared,
    trained,
    warnings,
    advisories,
  };
}
