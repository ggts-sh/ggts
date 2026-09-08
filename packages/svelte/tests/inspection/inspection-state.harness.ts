/**
 * Shared harness for createInspectionState composite tests.
 * Factories own deriveds + effects — instantiate under `$effect.root` and destroy.
 */
import type { CandidateFacts, CellValue, RenderModel } from "@ggts-sh/core";
import { aes, gg, type PortableSpec } from "@ggts-sh/spec";

import type {
  PlotInspection,
  PlotInteractionEvent,
  ResolvedInteractionConfig,
} from "../../src/lib/interaction/interaction.js";
import { normalizeInteractionConfig } from "../../src/lib/interaction/interaction.js";
import { createInteractionReducer } from "../../src/lib/interaction/reducer.js";
import type { InteractionContext } from "../../src/lib/interaction/interaction-context.svelte.js";
import { createInspectionState } from "../../src/lib/inspection/inspection-state.svelte.js";
import { withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { testInteractionContext } from "../helpers/interaction-context.js";
import { modelFor } from "../helpers/model.js";

const continuousRows = [
  { id: "a", x: 1, y: 1 },
  { id: "b", x: 10, y: 20 },
  { id: "c", x: 5, y: 8 },
];

export type InspectConfig = ResolvedInteractionConfig["inspect"];
export type InteractionReducer = ReturnType<typeof createInteractionReducer>;
export type InspectCb = ((event: PlotInspection<Record<string, CellValue>>) => void) | undefined;
export type InteractionCb =
  | ((event: PlotInteractionEvent<Record<string, CellValue>>) => void)
  | undefined;

export const noInspect: () => InspectCb = () => {
  /* no callback */
};
export const noInteraction: () => InteractionCb = () => {
  /* no callback */
};

export const defaultInspect = (): InspectConfig =>
  normalizeInteractionConfig({ inspect: { pin: true } }).inspect;

export const modeXInspect = (): InspectConfig =>
  normalizeInteractionConfig({ inspect: { pin: false, mode: "x" } }).inspect;

/** Identity semantic keys — enough for local consumption without a host service. */
export function keyAtForModel(model: RenderModel): (index: number) => PropertyKey | null {
  return (index) => {
    const row = model.row(index);
    if (row === null) return null;
    const id = row["id"];
    return id === undefined || id === null ? String(index) : String(id);
  };
}

export function continuousSpec(
  data: readonly { id: string; x: number; y: number }[] = continuousRows,
): PortableSpec {
  return gg([...data], aes({ x: "x", y: "y" }))
    .geomPoint()
    .spec();
}

/**
 * Twelve series at the same x (color-split points) so mode "x" groups more
 * than the transient eight-member limit (matches interaction-unit fixture).
 */
export function largeGroupSpec(): PortableSpec {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    id: `row-${i}`,
    x: 1,
    y: i,
    series: `series-${i}`,
  }));
  return gg(rows, aes({ x: "x", y: "y", color: "series" }))
    .geomPoint()
    .spec();
}

export function firstCandidate(model: RenderModel): CandidateFacts {
  for (let id = 0; id < model.candidates.size; id++) {
    const candidate = model.candidates.candidate(id);
    if (candidate !== null) return candidate;
  }
  throw new Error("expected at least one candidate");
}

export function candidateHit(model: RenderModel): {
  candidate: CandidateFacts;
  /** Same object as candidate; kept so older tests can destructure `{ hit, candidate }`. */
  hit: CandidateFacts;
} {
  const candidate = firstCandidate(model);
  return { candidate, hit: candidate };
}

type ConcreteMode = "exact" | "x" | "y" | "xy";

/** Apply transient/pinned inspection. */
export function applyInspect(
  state: ReturnType<typeof createInspectionState>,
  candidate: CandidateFacts,
  source: "pointer" | "keyboard" | "touch" = "pointer",
  inspectionState: "transient" | "pinned" = "transient",
  concreteMode: ConcreteMode = "xy",
): void {
  state.setInspection(candidate, source, inspectionState, concreteMode);
}

export type InspectionHarness = {
  state: ReturnType<typeof createInspectionState>;
  reducer: InteractionReducer;
  destroy: () => void;
  /** Flush a deferred frame when mount used `deferredFrames: true`. */
  flushFrame: () => void;
};

/** Controllable rAF for schedulePointerInspect tests (never sync — handle assign). */
function createDeferredFrameScheduler(): {
  scheduleFrame: (callback: () => void) => number;
  cancelFrame: (handle: unknown) => void;
  flush: () => void;
  readonly pending: boolean;
} {
  let frame: (() => void) | null = null;
  return {
    scheduleFrame: (callback) => {
      frame = callback;
      return 1;
    },
    cancelFrame: () => {
      frame = null;
    },
    flush: () => {
      const next = frame;
      frame = null;
      next?.();
    },
    get pending() {
      return frame !== null;
    },
  };
}

/**
 * Mount the controller with production-shaped deps: every reactive dep is a
 * getter (context + options split). Harness owns the component-held
 * reducer and passes a getter. Effects register inside the factory (#627).
 *
 * When `deferredFrames` is true, owns a deferred scheduler and wires
 * `onPointerFrame` → `onInspectPointerFrame` so schedule+flush is testable.
 */
export function mountInspectionController(
  options: {
    model?: () => RenderModel | null;
    reducer?: () => InteractionReducer;
    inspectConfig?: () => InspectConfig;
    inspectEnabled?: () => boolean;
    dataIdentityEpoch?: () => string;
    keyAt?: (index: number) => PropertyKey | null;
    root?: () => HTMLDivElement | null;
    captureSurface?: () => HTMLDivElement | null;
    plotId?: () => string;
    tooltipHovered?: () => boolean;
    clearTooltipHovered?: () => void;
    oninspect?: InteractionContext["oninspect"];
    oninteraction?: InteractionContext["oninteraction"];
    announce?: (message: string) => void;
    clearAnnouncement?: () => void;
    /** Wire deferred frame + onInspectPointerFrame (for schedulePointerInspect). */
    deferredFrames?: boolean;
  } = {},
): InspectionHarness {
  const defaultModel = modelFor(continuousSpec());
  const scheduler = options.deferredFrames === true ? createDeferredFrameScheduler() : null;
  let controllerRef: ReturnType<typeof createInspectionState> | null = null;

  const ownedReducer =
    options.reducer === undefined
      ? createInteractionReducer({
          scheduleFrame:
            scheduler?.scheduleFrame ??
            ((callback) => {
              callback();
              return 0;
            }),
          cancelFrame: scheduler?.cancelFrame ?? (() => {}),
          onPointerFrame:
            scheduler === null
              ? undefined
              : (action) => {
                  if (action.type === "inspect")
                    return controllerRef!.onInspectPointerFrame(action);
                  return true;
                },
        })
      : null;
  const getReducer = options.reducer ?? (() => ownedReducer!);

  const { value: state, destroy } = withFlushedEffectRoot(() => {
    const controller = createInspectionState(
      testInteractionContext({
        model: options.model ?? (() => defaultModel),
        inspectConfig: options.inspectConfig ?? defaultInspect,
        keyAt:
          options.keyAt ??
          ((index) => {
            const model = options.model?.() ?? defaultModel;
            return keyAtForModel(model)(index);
          }),
        root: options.root ?? (() => null),
        captureSurface: options.captureSurface ?? (() => null),
        tooltipHovered: options.tooltipHovered ?? (() => false),
        oninspect: options.oninspect ?? noInspect,
        oninteraction: options.oninteraction ?? noInteraction,
        announce: options.announce ?? (() => {}),
      }),
      {
        reducer: getReducer,
        inspectEnabled: options.inspectEnabled ?? (() => true),
        dataIdentityEpoch: options.dataIdentityEpoch ?? (() => "epoch-1"),
        plotId: options.plotId ?? (() => "plot-test"),
        clearTooltipHovered: options.clearTooltipHovered ?? (() => {}),
        clearAnnouncement: options.clearAnnouncement ?? (() => {}),
      },
    );
    controllerRef = controller;
    return controller;
  });

  return {
    state,
    reducer: getReducer(),
    destroy,
    flushFrame: () => {
      scheduler?.flush();
    },
  };
}

// Re-exports used by construction / armed-getter suites
export { createInspectionState, createInteractionReducer, modelFor };
export { withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
export type { RenderModel, CandidateFacts, PortableSpec };
