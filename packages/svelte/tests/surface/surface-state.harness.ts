/**
 * Shared harness for createSurfaceState composite tests.
 * Factories own deriveds + effects — instantiate under `$effect.root` and destroy.
 *
 * Production phased order:
 *   zoom → inspection → surface → interval (effects register inside factories)
 *
 * Frame pump: each suite file that imports this module gets a module-scoped
 * rAF patch and afterEach discard (Vitest loads this per test file isolate).
 */
import { fromAny } from "@total-typescript/shoehorn";
import { afterEach } from "vitest";

import type { CandidateFacts, CellValue, RenderModel } from "@ggts-sh/core";
import { aes, gg, type PortableSpec } from "@ggts-sh/spec";

import type {
  InteractionSource,
  InteractionTool,
  PlotSelection,
} from "../../src/lib/interaction/interaction.js";
import { normalizeInteractionConfig } from "../../src/lib/interaction/interaction.js";
import { createPlotInteraction } from "../../src/lib/interaction/controller.svelte.js";
import {
  createInspectionState,
  type InspectionState,
} from "../../src/lib/inspection/inspection-state.svelte.js";
import {
  createIntervalState,
  type IntervalState,
} from "../../src/lib/interval/interval-state.svelte.js";
import { createPlotZoomState, type PlotZoomState } from "../../src/lib/zoom/zoom-state.svelte.js";
import {
  createSurfaceState,
  type SurfaceState,
  type SurfaceStateOptions,
} from "../../src/lib/surface/surface-state.svelte.js";
import { withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { identityCandidateKeys, testInteractionContext } from "../helpers/interaction-context.js";
import { modelFor } from "../helpers/model.js";
import { reactiveBox } from "../helpers/reactive-box.svelte.js";

const continuousRows = [
  { id: "a", x: 1, y: 1 },
  { id: "b", x: 10, y: 20 },
  { id: "c", x: 5, y: 8 },
];

/** Getter that supplies no interaction controller (chart-local mode). */
const noController = (): ReturnType<typeof createPlotInteraction> | undefined => {
  /* chart-local */
};

export function continuousSpec(
  data: readonly { id: string; x: number; y: number }[] = continuousRows,
): PortableSpec {
  return gg([...data], aes({ x: "x", y: "y" }))
    .geomPoint()
    .spec();
}

export function facetSpec(): PortableSpec {
  return gg(
    [
      { id: "north", facet: "North", x: 1, y: 1 },
      { id: "south", facet: "South", x: 2, y: 2 },
    ],
    aes({ x: "x", y: "y" }),
  )
    .geomPoint()
    .facet({ wrap: "facet" })
    .spec();
}

export function firstCandidate(model: RenderModel): CandidateFacts {
  for (let id = 0; id < model.candidates.size; id++) {
    const candidate = model.candidates.candidate(id);
    if (candidate !== null) return candidate;
  }
  throw new Error("expected at least one candidate");
}

export function secondCandidate(model: RenderModel, firstId: number): CandidateFacts {
  for (let id = 0; id < model.candidates.size; id++) {
    const candidate = model.candidates.candidate(id);
    if (candidate !== null && candidate.id !== firstId) return candidate;
  }
  throw new Error("expected a second candidate");
}

function identityKeyAt(model: RenderModel): (index: number) => PropertyKey | null {
  return (index) => {
    const row = model.row(index);
    if (row === null) return null;
    const id = row["id"];
    return id === undefined || id === null ? String(index) : String(id);
  };
}

function identitySemanticKey(): (
  row: Record<string, CellValue> | null,
  index: number | null,
) => PropertyKey | null {
  return (row, index) => {
    if (row !== null) {
      const id = row["id"];
      if (id !== undefined && id !== null) return String(id);
    }
    return index === null ? null : String(index);
  };
}

/** Deferred controllable frame pump — mirrors production RAF (assign-after-schedule). */
function createFramePump(): {
  scheduleFrame: (callback: () => void) => number;
  cancelFrame: (handle: number) => void;
  flush: () => void;
  discard: () => void;
} {
  let nextId = 1;
  const pending = new Map<number, () => void>();
  return {
    scheduleFrame: (callback) => {
      const id = nextId++;
      pending.set(id, callback);
      return id;
    },
    cancelFrame: (handle) => {
      pending.delete(handle);
    },
    flush: () => {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
    },
    discard: () => {
      pending.clear();
    },
  };
}

/** Capture target sized to the model scene for plotPointFromClient. */
function mountCaptureTarget(model: RenderModel): HTMLDivElement {
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.left = "0px";
  el.style.top = "0px";
  el.style.width = `${model.scene.width}px`;
  el.style.height = `${model.scene.height}px`;
  document.body.append(el);
  // jsdom-free browser: pin rect so client→plot mapping is stable.
  Object.defineProperty(el, "getBoundingClientRect", {
    value: () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: model.scene.width,
        bottom: model.scene.height,
        width: model.scene.width,
        height: model.scene.height,
        toJSON: () => ({}),
      }) satisfies DOMRect,
  });
  return el;
}

export function pointerEvent(
  type: string,
  target: HTMLElement,
  opts: {
    clientX: number;
    clientY: number;
    pointerType?: string;
    button?: number;
    pointerId?: number;
  },
): PointerEvent {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: opts.clientX,
    clientY: opts.clientY,
    pointerType: opts.pointerType ?? "mouse",
    button: opts.button ?? 0,
    pointerId: opts.pointerId ?? 1,
  });
  Object.defineProperty(event, "currentTarget", { value: target, configurable: true });
  return event;
}

export function panelCenterClient(model: RenderModel, panelIndex = 0): { x: number; y: number } {
  const panel = model.scene.panels[panelIndex];
  if (panel === undefined) throw new Error("expected panel");
  return {
    x: panel.x + panel.width / 2,
    y: panel.y + panel.height / 2,
  };
}

export type SurfaceHarness = {
  surface: SurfaceState;
  inspection: InspectionState;
  interval: IntervalState;
  zoom: PlotZoomState;
  model: RenderModel;
  capture: HTMLDivElement;
  root: HTMLDivElement;
  /** Flush the suite's deferred rAF pump (the controller's real scheduler). */
  flushFrames: () => void;
  selectionEvents: PlotSelection[];
  /**
   * Ordered emit log. For phase `end`, suffix records whether
   * `interval.committedInterval` was already set when the emit ran
   * (`after-commit` vs `before-commit`).
   */
  selectionOrderLog: string[];
  toolChanges: InteractionTool[];
  toggleCalls: { keys: readonly PropertyKey[]; source: InteractionSource }[];
  announcements: string[];
  destroy: () => void;
  setToolProp: (tool: InteractionTool | undefined) => void;
  setOnToolChange: (cb: ((tool: InteractionTool) => void) | undefined) => void;
};

/**
 * Production-shaped composite harness.
 * Order: zoom → inspection → surface → interval → surface effects → inspection effects.
 */
export function mountSurfaceComposite(
  options: {
    spec?: PortableSpec;
    interactionConfig?: ReturnType<typeof normalizeInteractionConfig>;
    toolProp?: InteractionTool | undefined;
    surfaceInteractive?: boolean;
    registerEffects?: boolean;
  } = {},
): SurfaceHarness {
  const model = modelFor(options.spec ?? continuousSpec());
  const config =
    options.interactionConfig ??
    normalizeInteractionConfig({
      inspect: { pin: true },
      select: { type: "interval", mode: "xy" },
      zoom: true,
    });
  const selectionEvents: PlotSelection[] = [];
  const selectionOrderLog: string[] = [];
  const toolChanges: InteractionTool[] = [];
  const toggleCalls: { keys: readonly PropertyKey[]; source: InteractionSource }[] = [];
  const announcements: string[] = [];

  const toolPropBox = reactiveBox<InteractionTool | undefined>(options.toolProp);
  const onToolChangeBox = reactiveBox<((tool: InteractionTool) => void) | undefined>((tool) => {
    toolChanges.push(tool);
  });

  const root = document.createElement("div");
  root.tabIndex = -1;
  document.body.append(root);
  const capture = mountCaptureTarget(model);
  root.append(capture);

  const keyAt = identityKeyAt(model);
  const semanticKey = identitySemanticKey();

  const { value: bundle, destroy: destroyRoot } = withFlushedEffectRoot(() => {
    // One shared context; per-factory options carry ports + host-derived
    // enablement. Deferred getters close over later const bindings
    // (handler/effect only).
    const context = testInteractionContext({
      model: () => model,
      root: () => root,
      captureSurface: () => capture,
      interaction: noController,
      resolvedInteractionScope: () => ({ keys: "plot", x: "x", y: "y", intervals: "plot" }),
      selectConfig: () => config.select,
      inspectConfig: () => config.inspect,
      tooltipHovered: () => false,
      announce: (message) => {
        announcements.push(message);
      },
      oninteraction: () => {
        /* no callback */
      },
      oninspect: () => {
        /* no callback */
      },
      onzoom: () => {
        /* no callback */
      },
      ontoolchange: () => onToolChangeBox.value,
      keyAt,
      semanticKey,
      candidateSemanticKeys: identityCandidateKeys,
    });

    let surface!: SurfaceState;
    let interval!: IntervalState;

    // 1. zoom
    const zoom = createPlotZoomState(context, {
      zoomConfig: () => config.zoom,
      assembled: () => options.spec ?? continuousSpec(),
    });

    // 2. inspection (before surface — reversed reducer dep)
    const inspection = createInspectionState(context, {
      reducer: () => surface.reducer,
      inspectEnabled: () => config.inspect !== null,
      dataIdentityEpoch: () => "epoch-1",
      plotId: () => "plot-test",
      clearTooltipHovered: () => {},
      clearAnnouncement: () => {},
    });

    // 3. surface (owns reducer). Global rAF is the deferred suite pump.
    surface = createSurfaceState(context, {
      toolProp: () => toolPropBox.value,
      initialTool: () => config.initialTool,
      availableTools: () => config.availableTools,
      pointSelectEnabled: () => config.select?.type === "point",
      surfaceInteractive: () => options.surfaceInteractive ?? true,
      inspection: () => inspection,
      interval: () => interval,
      zoom: () => zoom,
      emitSelection: (event) => {
        if (event.phase === "end") {
          selectionOrderLog.push(
            interval.committedInterval === null
              ? "emit:end:before-commit"
              : "emit:end:after-commit",
          );
        } else {
          selectionOrderLog.push(`emit:${event.phase}`);
        }
        selectionEvents.push(event);
      },
      togglePointKeys: (keys, source) => {
        toggleCalls.push({ keys, source });
      },
    });

    // 4. interval AFTER surface (production order — deferred surface→interval)
    interval = createIntervalState(context, {
      effectiveZoomDomains: () => zoom.effectiveZoomDomains,
      commitZoom: (domains, source) => {
        zoom.commitZoom(domains, source);
      },
      consumptionCandidates: () => {
        const candidates = [];
        for (let id = 0; id < model.candidates.size; id++) {
          const candidate = model.candidates.candidate(id);
          if (candidate === null) continue;
          candidates.push({
            panelId: candidate.panelId,
            xValue: candidate.xValue,
            yValue: candidate.yValue,
            keys: identityCandidateKeys(candidate),
          });
        }
        return candidates;
      },
      inspectionPanel: () => inspection.inspectionPanel,
      emitSelection: (event) => {
        if (event.phase === "end") {
          selectionOrderLog.push(
            interval.committedInterval === null
              ? "emit:end:before-commit"
              : "emit:end:after-commit",
          );
        } else {
          selectionOrderLog.push(`emit:${event.phase}`);
        }
        selectionEvents.push(event);
      },
    });

    // 5. surface effects then 6. inspection effects (host 810 vs 954)

    return { surface, inspection, interval, zoom };
  });

  return {
    surface: bundle.surface,
    inspection: bundle.inspection,
    interval: bundle.interval,
    zoom: bundle.zoom,
    model,
    capture,
    root,
    flushFrames: () => {
      suitePump.flush();
    },
    selectionEvents,
    selectionOrderLog,
    toolChanges,
    toggleCalls,
    announcements,
    setToolProp: (tool) => {
      toolPropBox.set(tool);
    },
    setOnToolChange: (cb) => {
      onToolChangeBox.set(cb);
    },
    destroy: () => {
      destroyRoot();
      capture.remove();
      root.remove();
    },
  };
}

// Install deferred rAF for any suite that imports this harness so the
// reducer's production scheduleFrame path is controllable.
const suitePump = createFramePump();
const originalRaf = globalThis.requestAnimationFrame;
const originalCaf = globalThis.cancelAnimationFrame;

afterEach(() => {
  // DISCARD leftover frames — invoking them here would run callbacks into
  // already-destroyed effect roots (cross-test pollution hazard).
  suitePump.discard();
});

globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number =>
  suitePump.scheduleFrame(() => {
    cb(performance.now());
  });
globalThis.cancelAnimationFrame = (handle: number): void => {
  suitePump.cancelFrame(handle);
};

void originalRaf;
void originalCaf;

// Re-exports used by construction-armed tests
export { fromAny, createSurfaceState, normalizeInteractionConfig, modelFor };
export type { SurfaceStateOptions, InteractionTool };
