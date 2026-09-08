/**
 * Plot runtime: container sizing, model production (runPipeline + scale gate),
 * strata plan, paint ledger, and readiness. Extracted from GGPlot for S1.
 *
 * Effects register at construction (#627)
 * so relative order vs host effects is preserved.
 */
import { installCandidates, planStrata, registerBasic, runPipeline } from "@ggts-sh/core";
import type { RenderModel, ScaleState, Stratum } from "@ggts-sh/core";
import type { PortableSpec } from "@ggts-sh/spec";
import { untrack } from "svelte";

// GGPlot default registration contract (#1420): basic geoms/stats +
// interaction candidates (#1421), so identity charts and hit-testing work out
// of the box. Temporal scale children self-register full temporal support;
// spec-driven apps call registerAll(). Calls (not the /render side effect)
// keep one @ggts-sh/core entry in dev-server prebundles — a /render + barrel
// split would fork the registries.
registerBasic();
installCandidates();

import type { LegendFilterClause } from "../legend/filter.js";
import type { ReadonlyZoomDomains } from "../interaction/interaction.js";
import { isContainerWidthProp, resolvePlotSize } from "../assembly/layout.js";
import { createPaintLedger, isPlotReady } from "./paint.js";

export type PlotRuntimeDeps = {
  widthProp: () => number | "container" | undefined;
  heightProp: () => number | undefined;
  assembled: () => PortableSpec | null;
  effectiveSpec: () => PortableSpec | null;
  effectiveZoomDomains: () => ReadonlyZoomDomains | null;
  effectiveLegendFilters: () => readonly LegendFilterClause[];
  root: () => HTMLDivElement | null;
  /** Silent zoom clear owned by the S4 zoom controller (`resetForScales`). */
  resetZoom: () => void;
  /**
   * Getter for the onrender callback. The dispose/onrender effects wrap the
   * getter invocation in `untrack` so callback identity is not a dependency
   * (matches GGPlot.svelte:677-680).
   */
  onrender: () => ((model: RenderModel, spec: PortableSpec) => void) | undefined;
};

export type PlotRuntime = {
  readonly model: RenderModel | null;
  readonly resolvedWidth: number;
  readonly resolvedHeight: number;
  readonly strata: readonly Stratum[];
  readonly hasCanvas: boolean;
  readonly ready: boolean;
  notifyPainted(runId: number, stratumKey: string): void;
  resetScales(): void;
};

/**
 * Create the plot runtime. Construction registers ResizeObserver, model
 * dispose/onrender, and clientFlush effects (#627). Dep getters must not be
 * invoked during construction for construction-time deriveds.
 */
export function createPlotRuntime(deps: PlotRuntimeDeps): PlotRuntime {
  // ------------------------------------------------- container width (RO)
  let containerWidth = $state<number | null>(null);
  let containerHasPositiveWidth = $state(false);

  $effect(() => {
    // No-op cleanup keeps every code path returning a teardown (consistent-return).
    if (!isContainerWidthProp(deps.widthProp()) || deps.root() === null) return () => {};
    const el = deps.root()!;
    let frame = 0;
    const commitWidth = (nextWidth: number): void => {
      // Commit readiness and the measured model width in one reactive turn so
      // data-gg-ready does not flip true on a stale pre-measure fallback.
      containerHasPositiveWidth = nextWidth > 0;
      if (nextWidth > 0) containerWidth = nextWidth;
    };
    // Synchronous first measure: do not wait a frame (or a late RO delivery)
    // when the host already has a laid-out width.
    const initial = Math.round(el.getBoundingClientRect().width);
    if (initial > 0) commitWidth(initial);
    const observer = new ResizeObserver((entries) => {
      // Debounce resize storms through rAF; the pipeline's run-id gate
      // guarantees only the newest result commits regardless.
      const nextWidth = Math.round(entries[0]?.contentRect.width ?? 0);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        commitWidth(nextWidth);
      });
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });

  const resolvedSize = $derived(
    resolvePlotSize({
      width: deps.widthProp(),
      height: deps.heightProp(),
      containerWidth,
      assembledWidth: deps.assembled()?.width,
      assembledHeight: deps.assembled()?.height,
    }),
  );
  const resolvedWidth = $derived(resolvedSize.width);
  const resolvedHeight = $derived(resolvedSize.height);

  // Authoritative committed scale state: a plain non-reactive box + run-id
  // gate. Committing only monotonically newer runs keeps stale results from
  // clobbering the value-stable color assignments. scaleEpoch exists so
  // resetScales() can force a re-run after clearing the box.
  const scaleBox: {
    runId: number;
    scales: Record<string, ScaleState> | undefined;
  } = { runId: -1, scales: undefined };
  let scaleEpoch = $state(0);

  function resolveModel(): RenderModel | null {
    void scaleEpoch;
    const effectiveSpec = deps.effectiveSpec();
    if (effectiveSpec === null) return null;
    const rowFilters = deps.effectiveLegendFilters();
    const assembled = deps.assembled();
    let baselineDomains: RenderModel["domains"]["effective"] | undefined;
    let effectivePrevScales = scaleBox.scales;
    if (deps.effectiveZoomDomains() !== null && assembled !== null) {
      // Scale limits now censor before stats. Train the unzoomed spec in a
      // separate pure run so Reset keeps the latest natural data/stat domain;
      // effective zoom rendering still re-stats only the limited subset.
      const baseline = runPipeline(assembled, {
        width: resolvedWidth,
        height: resolvedHeight,
        ...(scaleBox.scales !== undefined && { prevScales: scaleBox.scales }),
        ...(rowFilters.length > 0 && { rowFilters }),
      });
      baselineDomains = baseline.domains.effective;
      effectivePrevScales = baseline.scales.state;
      baseline.dispose();
    }
    const m = runPipeline(effectiveSpec, {
      width: resolvedWidth,
      height: resolvedHeight,
      ...(effectivePrevScales !== undefined && { prevScales: effectivePrevScales }),
      ...(baselineDomains !== undefined && { baselineDomains }),
      ...(rowFilters.length > 0 && { rowFilters }),
    });
    if (m.runId > scaleBox.runId) {
      scaleBox.runId = m.runId;
      scaleBox.scales = m.scales.state;
    }
    return m;
  }
  const model: RenderModel | null = $derived.by(resolveModel);
  // SSR: one lazy memo for the whole server pass (#1328). Recomputing on every
  // model/strata/hasCanvas read re-ran the full pipeline ~20× per render.
  // Client keeps $derived caching.
  //
  // Never latch a null model: Svelte's one-pass SSR can evaluate plot getters
  // before declaration children register (same reason as ssrSafeDerived). An
  // early null must not freeze a blank chart for the rest of the pass; only a
  // non-null result is memoized. Memo is instance-local (one runtime = one
  // SSR render) and cleared by resetScales.
  let ssrModel: RenderModel | null | undefined;
  let ssrStrata: readonly Stratum[] | undefined;
  const currentModel = (): RenderModel | null => {
    if (typeof window !== "undefined") return model;
    if (ssrModel !== undefined) return ssrModel;
    const next = resolveModel();
    if (next !== null) ssrModel = next;
    return next;
  };

  // ---------------------------------------------------------- strata plan
  const resolveStrata = () => {
    const current = currentModel();
    return current === null ? [] : planStrata(current.scene, current.layerBackends);
  };
  const strata = $derived(resolveStrata());
  const currentStrata = (): readonly Stratum[] => {
    if (typeof window !== "undefined") return strata;
    // Freeze strata only once the model memo is set — otherwise an early empty
    // plan would stick after children register and model resolves.
    if (ssrStrata !== undefined) return ssrStrata;
    const next = resolveStrata();
    if (ssrModel !== undefined) ssrStrata = next;
    return next;
  };
  const canvasCount = $derived(currentStrata().filter((s) => s.backend === "canvas").length);
  const hasCanvas = $derived(canvasCount > 0);

  // Canvas first-paint tracking: data-gg-ready waits for every distinct
  // canvas stratum of the CURRENT model to have painted at least once.
  // paintEpoch bumps so readiness re-derives when the non-reactive ledger
  // mutates (ledger itself must not be $state — set mutations are invisible).
  const paintLedger = createPaintLedger();
  let paintEpoch = $state(0);
  function notifyPainted(runId: number, stratumKey: string): void {
    paintLedger.notify(runId, stratumKey);
    paintEpoch += 1;
  }

  /**
   * Clear the committed scale state (grow-mode recovery: dropped categories
   * lose their reserved colors) and any brush zoom. The next render trains
   * scales fresh from the current data.
   */
  function resetScales(): void {
    scaleBox.runId = -1;
    scaleBox.scales = undefined;
    ssrModel = undefined;
    ssrStrata = undefined;
    deps.resetZoom();
    scaleEpoch++;
  }

  // Readiness: clientFlush flips true on first client effect flush (SSR stays false).
  let clientFlush = $state(false);
  const ready = $derived.by(() => {
    void paintEpoch;
    if (!clientFlush) return false;
    return isPlotReady({
      hasModel: model !== null,
      widthMode: isContainerWidthProp(deps.widthProp()) ? "container" : "fixed",
      containerHasPositiveWidth,
      hasCanvas,
      paintComplete: model !== null && paintLedger.isComplete(model.runId, canvasCount),
    });
  });

  // Memory ownership: dispose the previous model once the DOM has moved on
  // (effect cleanup runs post-flush), and the last model on unmount.
  $effect(() => {
    const m = model;
    return () => m?.dispose();
  });

  $effect(() => {
    const m = model;
    const assembled = deps.assembled();
    if (m !== null && assembled !== null) untrack(() => deps.onrender()?.(m, assembled));
  });

  // clientFlush via $effect: never runs during SSR → prerender stays
  // data-gg-ready="false" until the first client committed flush (decision 0009)
  $effect(() => {
    clientFlush = true;
  });

  return {
    get model() {
      return currentModel();
    },
    get resolvedWidth() {
      return resolvedWidth;
    },
    get resolvedHeight() {
      return resolvedHeight;
    },
    get strata() {
      return currentStrata();
    },
    get hasCanvas() {
      return typeof window === "undefined"
        ? currentStrata().some((s) => s.backend === "canvas")
        : hasCanvas;
    },
    get ready() {
      return ready;
    },
    notifyPainted,
    resetScales,
  };
}
