/**
 * Reactive PlotRuntimeDeps for unit tests. Plain `let` bindings are invisible
 * to `$derived` inside createPlotRuntime; host state must be `$state` so
 * setter writes invalidate the model derived.
 */
import type { RenderModel } from "@ggts-sh/core";
import type { PortableSpec } from "@ggts-sh/spec";

import type { ReadonlyZoomDomains } from "../../src/lib/interaction/interaction.js";
import type { LegendFilterClause } from "../../src/lib/legend/filter.js";
import type { PlotRuntimeDeps } from "../../src/lib/runtime/runtime.svelte.js";

export type ReactiveRuntimeDeps = PlotRuntimeDeps & {
  setWidth(v: number | "container" | undefined): void;
  setHeight(v: number | undefined): void;
  setAssembled(v: PortableSpec | null): void;
  setEffectiveSpec(v: PortableSpec | null): void;
  setZoomDomains(v: ReadonlyZoomDomains | null): void;
  setFilters(v: readonly LegendFilterClause[]): void;
  setRoot(v: HTMLDivElement | null): void;
  setOnrender(v: ((model: RenderModel, spec: PortableSpec) => void) | undefined): void;
  setResetZoom(fn: () => void): void;
};

export function createReactiveRuntimeDeps(initial: {
  width?: number | "container" | undefined;
  height?: number | undefined;
  assembled: PortableSpec | null;
  effectiveSpec: PortableSpec | null;
}): ReactiveRuntimeDeps {
  let width = $state<number | "container" | undefined>(initial.width ?? 480);
  let height = $state<number | undefined>(initial.height ?? 320);
  let assembled = $state<PortableSpec | null>(initial.assembled);
  let effectiveSpec = $state<PortableSpec | null>(initial.effectiveSpec);
  let zoomDomains = $state<ReadonlyZoomDomains | null>(null);
  let filters = $state.raw<readonly LegendFilterClause[]>([]);
  let root = $state<HTMLDivElement | null>(null);
  let onrender = $state<((model: RenderModel, spec: PortableSpec) => void) | undefined>();
  let resetZoom = $state<() => void>(() => {});

  return {
    widthProp: () => width,
    heightProp: () => height,
    assembled: () => assembled,
    effectiveSpec: () => effectiveSpec,
    effectiveZoomDomains: () => zoomDomains,
    effectiveLegendFilters: () => filters,
    root: () => root,
    resetZoom: () => {
      resetZoom();
    },
    onrender: () => onrender,
    setWidth: (v) => {
      width = v;
    },
    setHeight: (v) => {
      height = v;
    },
    setAssembled: (v) => {
      assembled = v;
    },
    setEffectiveSpec: (v) => {
      effectiveSpec = v;
    },
    setZoomDomains: (v) => {
      zoomDomains = v;
    },
    setFilters: (v) => {
      filters = v;
    },
    setRoot: (v) => {
      root = v;
    },
    setOnrender: (v) => {
      onrender = v;
    },
    setResetZoom: (fn) => {
      resetZoom = fn;
    },
  };
}
