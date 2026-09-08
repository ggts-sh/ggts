/**
 * Bounds-editor state machine extracted from interval-state for S5.
 *
 * Owns the boundsEditor + boundsReturnFocus rune state, the boundsEditorInput
 * derivation, the reactive cancel effect, and the open/cancel actions. The
 * committed interval state, scoped store, interval-reconcile effect, and
 * applyPreciseBounds stay in interval-state — applyPreciseBounds drives this
 * module through the live `boundsEditor` getter + `cancel()`.
 *
 * Deps are LIVE getters — never snapshots. The factory is constructed
 * synchronously during component init so the cancel effect registers at the
 * derivation's original position (after the interval-reconcile effect).
 */
import type { RenderModel, ScenePanel } from "@ggts-sh/core";
import type { TemporalScaleKind } from "@ggts-sh/spec";

import type { PlotInteractionInterval } from "../interaction/interaction.js";
import type { ContinuousZoomDomains } from "../scene/geometry.js";
import type { BoundsEditorInput } from "./bounds-editor.js";
import { boundsEditorInputForScale } from "./precise-bounds.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

type IntervalBoundsEditorRef = {
  action: "select" | "zoom";
  axis: "x" | "y";
  panelId?: string;
  panelLabel?: string;
};

export type IntervalBoundsEditorDeps = {
  /** Trained render model (null pre-model). */
  readonly model: () => RenderModel | null;
  /** Stable recovery target for reactive cancellation. */
  readonly captureSurface: () => HTMLDivElement | null;
  /** Stable announcer sink. */
  readonly announce: (message: string) => void;
  /** Zoom controller read path for the zoom branch (live getter). */
  readonly effectiveZoomDomains: () => ContinuousZoomDomains | null;
  /** Owning controller's current interval record (live getter). */
  readonly currentIntervalRecord: () => PlotInteractionInterval<PropertyKey> | null;
  readonly currentIntervalPanel: () => ScenePanel | undefined;
  /** Handler-only inspection fallback target for the select branch. */
  readonly inspectionPanel: () => Readonly<{ id: string }> | null;
  /** Panel label resolver owned by the interval controller. */
  readonly intervalPanelLabel: (panel: ScenePanel) => string;
};

export type IntervalBoundsEditorState = {
  /** Live getter — applyPreciseBounds reads `panelId` through it. */
  readonly boundsEditor: Readonly<IntervalBoundsEditorRef> | null;
  readonly boundsEditorInput: BoundsEditorInput | null;
  readonly boundsReturnFocus: HTMLElement | null;
  openBoundsEditor(action: "select" | "zoom", axis: "x" | "y", trigger: HTMLElement): void;
  /** Close the editor without focus restoration (Apply paths cancel it). */
  cancel(): void;
};

function temporalKindForAxis(model: RenderModel, axis: "x" | "y"): TemporalScaleKind | null {
  for (const plan of model.guidePlans) {
    if (plan.type === "axis" && plan.aesthetic === axis) return plan.temporalKind;
  }
  return null;
}

function zoomBoundsEditorInput(
  deps: IntervalBoundsEditorDeps,
  model: RenderModel,
  editor: IntervalBoundsEditorRef,
  temporalKind: TemporalScaleKind | null,
): BoundsEditorInput | null {
  const viewportPanel = model.viewport.panels[0];
  if (viewportPanel === undefined) return null;
  const scale = viewportPanel.axisEditModel(editor.axis);
  if (scale.kind === "band") return null;
  const bounds = deps.effectiveZoomDomains()?.[editor.axis] ?? scale.domain;
  return boundsEditorInputForScale({
    axis: editor.axis,
    action: "zoom",
    scale,
    bounds,
    temporalKind,
  });
}

function selectionBoundsEditorInput(
  deps: IntervalBoundsEditorDeps,
  model: RenderModel,
  editor: IntervalBoundsEditorRef,
  temporalKind: TemporalScaleKind | null,
): BoundsEditorInput | null {
  const record = deps.currentIntervalRecord();
  const targetPanelId = record?.panelId ?? editor.panelId;
  if (targetPanelId === undefined) return null;
  const viewportPanel = model.viewport.panel(targetPanelId);
  if (viewportPanel === null) return null;
  const scale = viewportPanel.axisEditModel(editor.axis);
  const semantic = record?.domains[editor.axis];
  const bounds =
    semantic?.kind === "band"
      ? ([semantic.values[0] ?? "", semantic.values.at(-1) ?? ""] as const)
      : semantic?.domain;
  return boundsEditorInputForScale({
    axis: editor.axis,
    action: "select",
    scale,
    temporalKind,
    ...(bounds !== undefined && { bounds }),
  });
}

function resolveBoundsEditorInput(
  deps: IntervalBoundsEditorDeps,
  editor: IntervalBoundsEditorRef | null,
): BoundsEditorInput | null {
  const model = deps.model();
  if (editor === null || model === null) return null;
  const temporalKind = temporalKindForAxis(model, editor.axis);
  return editor.action === "zoom"
    ? zoomBoundsEditorInput(deps, model, editor, temporalKind)
    : selectionBoundsEditorInput(deps, model, editor, temporalKind);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createIntervalBoundsEditor(
  deps: IntervalBoundsEditorDeps,
): IntervalBoundsEditorState {
  let boundsEditor = $state<IntervalBoundsEditorRef | null>(null);
  let boundsReturnFocus = $state<HTMLElement | null>(null);

  const boundsEditorInput = $derived.by(() => resolveBoundsEditorInput(deps, boundsEditor));

  $effect(() => {
    if (boundsEditor === null || boundsEditorInput !== null) return;
    const target = boundsEditor.panelLabel ?? "the target panel";
    boundsEditor = null;
    boundsReturnFocus = null;
    // The original button may have been reused for a different panel. The
    // capture surface is the stable recovery target for reactive cancellation;
    // explicit Apply/Cancel still restores the initiating button.
    queueMicrotask(() => {
      deps.captureSurface()?.focus();
      deps.announce(`Bounds editing cancelled because ${target} is no longer available.`);
    });
  });

  function openBoundsEditor(
    action: "select" | "zoom",
    axis: "x" | "y",
    trigger: HTMLElement,
  ): void {
    boundsReturnFocus = trigger;
    if (action === "select") {
      const model = deps.model();
      const panel =
        deps.currentIntervalRecord() === null
          ? (() => {
              const inspectionTarget = deps.inspectionPanel();
              if (inspectionTarget !== null && model !== null) {
                return model.scene.panels.find((candidate) => candidate.id === inspectionTarget.id);
              }
              return model?.scene.panels[0];
            })()
          : deps.currentIntervalPanel();
      if (panel === undefined || panel === null) return;
      boundsEditor = {
        action,
        axis,
        panelId: panel.id,
        panelLabel: deps.intervalPanelLabel(panel),
      };
      return;
    }
    boundsEditor = { action, axis };
  }

  function cancel(): void {
    boundsEditor = null;
  }

  return {
    get boundsEditor() {
      return boundsEditor;
    },
    get boundsEditorInput() {
      return boundsEditorInput;
    },
    get boundsReturnFocus() {
      return boundsReturnFocus;
    },
    openBoundsEditor,
    cancel,
  };
}
