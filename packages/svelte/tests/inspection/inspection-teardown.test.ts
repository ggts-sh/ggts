/**
 * Pure unit tests for inspection/teardown.ts decision tables.
 */
import { describe, expect, it } from "vitest";

import type { CandidateFacts, RenderModel } from "@ggts-sh/core";

import {
  applySceneInspectReconcile,
  type SceneInspectReconcileBag,
} from "../../src/lib/inspection/teardown.js";
describe("applySceneInspectReconcile", () => {
  type Call = string;
  type ReconcileResult = ReturnType<SceneInspectReconcileBag["reconcilePinned"]>;

  function mockBag(opts?: {
    model?: RenderModel | null;
    reconcileResult?: ReconcileResult | "default-null";
  }): { bag: SceneInspectReconcileBag; calls: Call[] } {
    const calls: Call[] = [];
    const model = opts && "model" in opts ? (opts.model ?? null) : ({ runId: 7 } as RenderModel);
    const reconcileResult: ReconcileResult | "default-null" =
      opts?.reconcileResult ?? "default-null";
    const bag: SceneInspectReconcileBag = {
      model,
      dataIdentityEpoch: () => {
        calls.push("dataIdentityEpoch");
        return "epoch-1";
      },
      clearInspection() {
        calls.push("clearInspection");
      },
      setInspectionFromReconcile() {
        calls.push("setInspectionFromReconcile");
      },
      setActiveCandidateId(id) {
        calls.push(`setActiveCandidateId:${String(id)}`);
      },
      clearDismissedLatch() {
        calls.push("clearDismissedLatch");
      },
      setReconciledRun(runId) {
        calls.push(`setReconciledRun:${runId}`);
      },
      dispatchSceneInvalidate() {
        calls.push("dispatchSceneInvalidate");
      },
      cancelPointerDiscardPending() {
        calls.push("cancelPointerDiscardPending");
      },
      clearPointerForSceneInvalidate() {
        calls.push("clearPointerForSceneInvalidate");
      },
      coordinatorInvalidate() {
        calls.push("coordinatorInvalidate");
      },
      releaseTransient() {
        calls.push("releaseTransient");
      },
      reconcilePinned() {
        calls.push("reconcilePinned");
        return reconcileResult === "default-null" ? null : reconcileResult;
      },
      emitClearProgrammatic() {
        calls.push("emitClearProgrammatic");
      },
      emitSemanticChange() {
        calls.push("emitSemanticChange");
      },
    };
    return { bag, calls };
  }

  it("noops and skips without side effects", () => {
    for (const type of ["noop", "skip"] as const) {
      const { bag, calls } = mockBag();
      applySceneInspectReconcile({ type }, bag);
      expect(calls).toEqual([]);
    }
  });

  it("clear-disabled invalidates coordinator, clears fields, discards pending pin", () => {
    const { bag, calls } = mockBag({ model: null });
    applySceneInspectReconcile({ type: "clear-disabled" }, bag);
    expect(calls).toEqual([
      "coordinatorInvalidate",
      "clearInspection",
      "clearDismissedLatch",
      "cancelPointerDiscardPending",
    ]);
  });

  it("invalidate-clear-transient dispatches before queue clear then releases transient", () => {
    const { bag, calls } = mockBag();
    applySceneInspectReconcile({ type: "invalidate-clear-transient" }, bag);
    expect(calls).toEqual([
      "dispatchSceneInvalidate",
      "clearPointerForSceneInvalidate",
      "clearDismissedLatch",
      "setReconciledRun:7",
      "releaseTransient",
      "clearInspection",
    ]);
  });

  it("invalidate-idle advances reconciled run without clearing inspection", () => {
    const { bag, calls } = mockBag();
    applySceneInspectReconcile({ type: "invalidate-idle" }, bag);
    expect(calls).toEqual([
      "dispatchSceneInvalidate",
      "clearPointerForSceneInvalidate",
      "clearDismissedLatch",
      "setReconciledRun:7",
    ]);
  });

  it("invalidate-reconcile-pinned success commits snapshot and emits when semantic changed", () => {
    const seed = { id: 42 } as CandidateFacts;
    const snapshot = { state: "pinned" } as NonNullable<ReconcileResult>["snapshot"];
    const { bag, calls } = mockBag({
      reconcileResult: {
        snapshot,
        seed,
        semanticChanged: true,
        semanticFingerprint: "sem:1",
      },
    });
    applySceneInspectReconcile({ type: "invalidate-reconcile-pinned" }, bag);
    expect(calls).toEqual([
      "dispatchSceneInvalidate",
      "clearPointerForSceneInvalidate",
      "clearDismissedLatch",
      "setReconciledRun:7",
      "dataIdentityEpoch",
      "reconcilePinned",
      "setInspectionFromReconcile",
      "setActiveCandidateId:42",
      "emitSemanticChange",
    ]);
  });

  it("invalidate-reconcile-pinned failure emits programmatic clear then clears fields", () => {
    const { bag, calls } = mockBag({ reconcileResult: null });
    applySceneInspectReconcile({ type: "invalidate-reconcile-pinned" }, bag);
    expect(calls).toEqual([
      "dispatchSceneInvalidate",
      "clearPointerForSceneInvalidate",
      "clearDismissedLatch",
      "setReconciledRun:7",
      "dataIdentityEpoch",
      "reconcilePinned",
      "emitClearProgrammatic",
      "clearInspection",
    ]);
  });

  it("invalidate-reconcile-pinned success without semantic change does not emit", () => {
    const seed = { id: 9 } as CandidateFacts;
    const snapshot = { state: "pinned" } as NonNullable<ReconcileResult>["snapshot"];
    const { bag, calls } = mockBag({
      reconcileResult: {
        snapshot,
        seed,
        semanticChanged: false,
        semanticFingerprint: "sem:same",
      },
    });
    applySceneInspectReconcile({ type: "invalidate-reconcile-pinned" }, bag);
    expect(calls).not.toContain("emitSemanticChange");
    expect(calls).toContain("setInspectionFromReconcile");
  });
});
