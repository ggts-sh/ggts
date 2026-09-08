/**
 * Uncensored natural baseline domains when effective scale domain pins censor
 * pre-stat frames (#449). Mirrors the Svelte runtime double-pass: train
 * baseline from data without position domain pins so zoom-out is not starved.
 */
import type { NormalizedSpec, PortableSpec, PositionScaleSpec } from "@ggts-sh/spec";

import { computeTrainedBaselineDomains } from "./compute-domains-baseline.js";
import { preparePanels } from "./prepare-panels.js";
import { trainPipelineScales } from "./train-pipeline-scales.js";
import type { EditionDefaults } from "../editions.js";
import type { Advisory, PipelineWarning, RunOptions, ScaleDomainSnapshot } from "./types.js";

/** True when either positional scale carries an explicit continuous domain pin. */
function hasPinnedPositionDomain(scales: PortableSpec["scales"] | undefined): boolean {
  return (
    (scales?.x?.domain !== undefined && scales.x.domain.length >= 2) ||
    (scales?.y?.domain !== undefined && scales.y.domain.length >= 2)
  );
}

function stripPositionDomain(config: PositionScaleSpec): PositionScaleSpec {
  const { domain: _domain, ...rest } = config;
  return rest;
}

/** Clone PortableSpec scales without x/y `domain` (keep type/nice/breaks/etc.). */
function withoutPositionDomains(spec: NormalizedSpec): NormalizedSpec {
  if (spec.scales === undefined) return spec;
  const scales = { ...spec.scales };
  if (scales.x !== undefined) scales.x = stripPositionDomain(scales.x);
  if (scales.y !== undefined) scales.y = stripPositionDomain(scales.y);
  return { ...spec, scales };
}

/**
 * Train natural baseline domains from an uncensored prepare+train pass.
 * Diagnostics from the baseline pass are discarded (effective run owns them).
 *
 * Frames come from the domain-stripped spec (so pins do not censor pre-stat
 * evidence). Domain training then applies the caller's `baselineScales`
 * (nice/expand/type) — same path as the unpinned `computeBaselineDomains`
 * branch — so injecting the snapshot as `baselineDomains` does not drop those
 * options.
 */
export function trainUncensoredBaselineDomains(input: {
  normalized: NormalizedSpec;
  options: RunOptions;
  editionDefaults: EditionDefaults;
}): ScaleDomainSnapshot {
  const unpinned = withoutPositionDomains(input.normalized);
  // Baseline pass owns no product diagnostics — effective run reports them.
  const scratchWarnings: PipelineWarning[] = [];
  const scratchAdvisories: Advisory[] = [];
  const prepared = preparePanels(unpinned, input.options, scratchWarnings, scratchAdvisories);
  // Collect axis inputs from uncensored frames only. Drop baseline* so this
  // nested train cannot short-circuit or re-enter the uncensored helper.
  const {
    baselineScales: _baselineScales,
    baselineDomains: _baselineDomains,
    ...restOptions
  } = input.options;
  const trained = trainPipelineScales({
    normalized: unpinned,
    options: restOptions,
    table: prepared.table,
    sourceTable: prepared.sourceTable,
    bindings: prepared.bindings,
    facetPanels: prepared.facetPanels,
    panelFrames: prepared.panelFrames,
    freeX: prepared.freeX,
    freeY: prepared.freeY,
    xConversion: prepared.xConversion,
    yConversion: prepared.yConversion,
    editionDefaults: input.editionDefaults,
    warnings: scratchWarnings,
    advisories: scratchAdvisories,
  });
  // Honor caller baselineScales (nice/expand/type) on uncensored inputs.
  return computeTrainedBaselineDomains({
    options: input.options,
    freeX: prepared.freeX,
    freeY: prepared.freeY,
    facetPanels: prepared.facetPanels,
    panelFrames: prepared.panelFrames,
    xInputs: trained.xInputs,
    yInputs: trained.yInputs,
  });
}

/** Whether runPipeline should inject an uncensored baselineDomains snapshot. */
export function needsUncensoredBaselinePass(
  options: RunOptions,
  scales: PortableSpec["scales"],
): boolean {
  return (
    options.baselineScales !== undefined &&
    options.baselineDomains === undefined &&
    hasPinnedPositionDomain(scales)
  );
}
