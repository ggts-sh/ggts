/**
 * Direct tests for finalize(PipelineRunState) — the single finalize entry
 * after the chain collapse (#1075). Hand-built run state; no runPipeline.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { finalize, type PipelineRunState } from "../src/pipeline/finalize.ts";
import { finalizeGeometryAndScene } from "../src/pipeline/finalize-geometry-scene.ts";
import { finalizePanelLayoutPass } from "../src/pipeline/finalize-layout-pass.ts";
import { preparePanels } from "../src/pipeline/prepare-panels.ts";
import { allocatePipelineRunId } from "../src/pipeline/run-id.ts";
import { setupPipelineRun } from "../src/pipeline/setup-run.ts";
import { trainPipelineScales } from "../src/pipeline/train-pipeline-scales.ts";
import type { Advisory, PipelineWarning, RunOptions } from "../src/pipeline/types.ts";
import { buildPanelCoordProjector } from "../src/coord-projector.ts";
import { runPipeline } from "../src/pipeline.ts";

import { EDITION_DEFAULTS } from "../src/editions.ts";

const size: RunOptions = { width: 640, height: 400, editions: EDITION_DEFAULTS };

function buildRunState(
  spec: ReturnType<ReturnType<typeof gg>["spec"]>,
  options: RunOptions = size,
): PipelineRunState {
  const warnings: PipelineWarning[] = [];
  const advisories: Advisory[] = [];
  const runId = allocatePipelineRunId();
  const { normalized, editionDefaults, theme, flip } = setupPipelineRun(
    spec,
    options.editions,
    warnings,
  );
  const prepared = preparePanels(normalized, options, warnings, advisories);
  const trained = trainPipelineScales({
    normalized,
    options,
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
  return {
    runId,
    normalized,
    options,
    theme,
    flip,
    prepared,
    trained,
    warnings,
    advisories,
  };
}

describe("finalize(PipelineRunState)", () => {
  it("is directly callable without runPipeline", () => {
    const run = buildRunState(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 4 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
    );
    const model = finalize(run);
    expect(model.scene.panels).toHaveLength(1);
    expect(model.scene.batches.length).toBeGreaterThan(0);
    expect(model.layerBackends).toHaveLength(1);
  });

  it("carries runId and sourceRegistry through to the render model", () => {
    const run = buildRunState(
      gg(
        [
          { x: 1, y: 10 },
          { x: 2, y: 20 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
    );
    const model = finalize(run);
    expect(model.runId).toBe(run.runId);
    // sourceRegistry is how model.row() resolves global source-row indices (#589)
    const row = model.row(0);
    expect(row).not.toBeNull();
    expect(row?.x).toBe(1);
    expect(row?.y).toBe(10);
    expect(run.prepared.sourceRegistry).toBeTruthy();
  });

  it("matches layout and scene built as separate steps", () => {
    const run = buildRunState(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 3 },
          { x: 3, y: 1 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .geomLine()
        .spec(),
    );

    const panelLayout = finalizePanelLayoutPass(run);
    const coord = run.normalized.coord?.type === "transform" ? run.normalized.coord : undefined;
    const coordProjectors = run.trained.panelScales.map((scales) =>
      buildPanelCoordProjector(scales, coord),
    );
    const scene = finalizeGeometryAndScene({
      ...run,
      panelLayout,
      coordProjectors,
    });

    const model = finalize(run);

    // Layout and scene each asserted on their own so one regression cannot hide.
    expect(panelLayout.placements).toHaveLength(1);
    expect(panelLayout.placements[0]!.width).toBeGreaterThan(0);
    expect(panelLayout.guidePlans.length).toBeGreaterThan(0);
    expect(scene.panels).toHaveLength(1);
    expect(scene.batches.length).toBeGreaterThanOrEqual(2);

    expect(model.scene.panels).toHaveLength(scene.panels.length);
    expect(model.scene.batches.map((b) => b.kind)).toEqual(scene.batches.map((b) => b.kind));
    expect(model.scene.batches.map((b) => b.layerIndex)).toEqual(
      scene.batches.map((b) => b.layerIndex),
    );
  });

  it("agrees with runPipeline on domains and candidates for the same spec", () => {
    const spec = gg(
      [
        { x: 1, y: 10 },
        { x: 2, y: 20 },
        { x: 3, y: 15 },
      ],
      aes({ x: "x", y: "y" }),
    )
      .geomPoint()
      .spec();

    const viaFinalize = finalize(buildRunState(spec));
    const viaPipeline = runPipeline(spec, size);

    expect(viaFinalize.domains.effective.x).toEqual(viaPipeline.domains.effective.x);
    expect(viaFinalize.domains.effective.y).toEqual(viaPipeline.domains.effective.y);
    expect(viaFinalize.domains.baseline.x).toEqual(viaPipeline.domains.baseline.x);
    expect(viaFinalize.candidates.size).toBe(viaPipeline.candidates.size);
    expect(viaFinalize.layerBackends).toEqual(viaPipeline.layerBackends);
  });
});
