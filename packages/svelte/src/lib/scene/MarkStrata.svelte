<script lang="ts">
  /**
   * Mark-strata compositing for GGPlot (decision 0006).
   * Renders as a bare fragment so document order = paint order under
   * `.gg-plot-root`. Host owns paint ledger / readiness / shared a11y open.
   */
  import { untrack } from "svelte";
  import type {
    BatchInteractionMask,
    GeometryBatch,
    RenderModel,
    Stratum,
  } from "@ggts-sh/core";
  import { sceneLabel } from "@ggts-sh/core";

  import {
    paintCanvasStratum,
    resolveBatchFocusMasks,
  } from "./stratum-paint.js";
  import CanvasA11y from "../a11y/CanvasA11y.svelte";
  import SceneView from "./SceneView.svelte";

  const {
    model,
    strata,
    ariaLabel,
    markLabel,
    interactionMasks,
    a11yTableOpen,
    onA11yToggle,
    onPainted,
  }: {
    model: RenderModel;
    strata: readonly Stratum[];
    ariaLabel?: string | undefined;
    markLabel: (row: number) => string;
    interactionMasks: readonly (BatchInteractionMask | null)[];
    a11yTableOpen: boolean;
    onA11yToggle: () => void;
    /** Only called after a successful paintCanvasStratum (context available). */
    onPainted: (runId: number, stratumKey: string) => void;
  } = $props();

  const hasCanvas = $derived(
    strata.some((stratum) => stratum.backend === "canvas"),
  );

  // Redraw canvases when the host theme flips (canvas colors resolve from
  // computed style at draw time; SVG re-resolves via CSS automatically).
  let themeEpoch = $state(0);
  $effect(() => {
    if (!hasCanvas) return;
    const observer = new MutationObserver(() => {
      themeEpoch++;
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  });

  /** Svelte attachment: paint stratum and signal first paint only on success. */
  function canvasAttachment(
    m: RenderModel,
    batches: GeometryBatch[],
    stratumKey: string,
  ) {
    void themeEpoch;
    const focusMasks = resolveBatchFocusMasks(
      m.scene.batches,
      batches,
      interactionMasks,
    );
    return (canvas: HTMLCanvasElement) => {
      const painted = paintCanvasStratum({
        canvas,
        scene: m.scene,
        batches,
        focusMasks,
      });
      // untrack: write paint state without SUBSCRIBING (would re-attach loop).
      if (painted) untrack(() => onPainted(m.runId, stratumKey));
    };
  }
</script>

{#if hasCanvas}
  <SceneView scene={model.scene} mode="chrome-bottom" {ariaLabel} />
  {#each strata as stratum, si (si)}
    {#if stratum.backend === "canvas"}
      <canvas
        class="gg-stratum gg-canvas"
        {@attach canvasAttachment(model, stratum.batches, `canvas:${si}`)}
      ></canvas>
      <CanvasA11y
        {model}
        batches={stratum.batches}
        sceneLabelText={ariaLabel ?? sceneLabel(model.scene)}
        open={a11yTableOpen}
        onToggle={onA11yToggle}
      />
    {:else}
      <SceneView
        scene={model.scene}
        mode="marks"
        batches={stratum.batches}
        focusable={false}
        {markLabel}
        focusMasks={interactionMasks}
      />
    {/if}
  {/each}
  <SceneView scene={model.scene} mode="chrome-top" />
{:else}
  <SceneView
    scene={model.scene}
    {ariaLabel}
    focusable={false}
    {markLabel}
    focusMasks={interactionMasks}
  />
{/if}

<style>
  canvas.gg-stratum {
    display: block;
  }
</style>
