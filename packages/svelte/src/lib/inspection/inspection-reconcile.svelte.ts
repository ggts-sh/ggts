/**
 * Scene-run inspection reconcile + coordinator disposal — construction-time
 * effect registration extracted from inspection-state.svelte.ts for S5
 * (plan §4).
 *
 * registerSceneInspectReconcile is invoked synchronously during
 * createInspectionState construction so both $effects register during init
 * (#627). It owns only the reconciledRun cursor. Rune state (inspection,
 * seed), fingerprints, candidate IDs, and the dismissal latch remain in the
 * inspection-state lexical owner; this module reads and mutates them only
 * through the live ports. The plan/apply split stays in teardown.ts (pure) —
 * this module is the $effect shell: plan + bag wiring.
 */
import type { RenderModel } from "@ggts-sh/core";

import type { InspectionHostState } from "./frame.js";
import {
  applySceneInspectReconcile,
  planSceneInspectReconcile,
  type SceneInspectReconcileBag,
} from "./teardown.js";

/**
 * Live ports for the scene-run reconcile effect. Everything except `model`/
 * `inspectEnabled`/`getInspectionState` is applied verbatim as the
 * `SceneInspectReconcileBag`; `setReconciledRun` is owned here — the run
 * cursor never leaves this module.
 */
export type SceneInspectReconcilePorts = Pick<
  SceneInspectReconcileBag,
  | "clearInspection"
  | "setInspectionFromReconcile"
  | "setActiveCandidateId"
  | "clearDismissedLatch"
  | "dispatchSceneInvalidate"
  | "cancelPointerDiscardPending"
  | "clearPointerForSceneInvalidate"
  | "coordinatorInvalidate"
  | "releaseTransient"
  | "reconcilePinned"
  | "emitClearProgrammatic"
  | "emitSemanticChange"
> & {
  /** Effect dependency: model identity (runId) drives scene-run reconcile. */
  readonly model: () => RenderModel | null;
  /** Effect dependency: inspect enablement gates the clear-disabled plan. */
  readonly inspectEnabled: () => boolean;
  readonly dataIdentityEpoch: () => PropertyKey;
  /** Thunk so same-run skip does not subscribe to hover inspection updates. */
  readonly getInspectionState: () => InspectionHostState;
};

/**
 * Register the coordinator-disposal + scene-run reconcile effects (formerly
 * host-phased registerInspectionEffects — registered at construction, #627).
 * Must be called synchronously during createInspectionState construction.
 */
export function registerSceneInspectReconcile(ports: SceneInspectReconcilePorts): void {
  let reconciledRun = -1;

  $effect(() => {
    return () => {
      ports.coordinatorInvalidate();
    };
  });

  $effect(() => {
    const currentModel = ports.model();
    const plan = planSceneInspectReconcile({
      inspectionEnabled: ports.inspectEnabled(),
      // Thunk: do not read `inspection` on the same-run skip path so hover
      // updates are not effect dependencies of scene-run reconcile.
      getInspectionState: ports.getInspectionState,
      modelRunId: currentModel?.runId ?? null,
      reconciledRun,
    });
    // Thin plan → apply shell (#855); ports double as the apply bag.
    applySceneInspectReconcile(plan, {
      ...ports,
      model: currentModel,
      setReconciledRun(runId) {
        reconciledRun = runId;
      },
    });
  });
}
