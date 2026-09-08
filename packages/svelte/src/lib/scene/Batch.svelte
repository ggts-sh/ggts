<script lang="ts">
  /**
   * One GeometryBatch (points / paths / areas / rects / segments / glyphs),
   * panel-local coordinates. Paint/shape/dash resolve through @ggts-sh/core
   * mark-paint (shared with the SVG-string and canvas serializers). Theme
   * defaults ride --gg-* custom properties (ink for strokes/points/text,
   * accent for fills). The per-mark presentation model (geometry/style
   * deriveds, alpha, focus ordering, interaction mute) lives in
   * batch-presentation.svelte.ts and reads these props through live getters.
   */
  import type {
    BatchInteractionMask,
    GeometryBatch,
    ThemeTokens,
  } from "@ggts-sh/core";
  import { pointShapePathD } from "@ggts-sh/core";

  import { createBatchPresentation } from "./batch-presentation.svelte.js";

  const {
    batch,
    theme,
    focusable = false,
    markLabel,
    focusMask = null,
  }: {
    batch: GeometryBatch;
    theme: ThemeTokens;
    /** Make SVG point marks keyboard-focusable tooltip targets. */
    focusable?: boolean;
    /** Accessible name for one mark's source row. */
    markLabel?: ((row: number) => string) | undefined;
    /** Semantic focus projected to renderer primitives for this batch. */
    focusMask?: BatchInteractionMask | null;
  } = $props();

  const presentation = createBatchPresentation({
    batch: () => batch,
    theme: () => theme,
    focusMask: () => focusMask,
    focusable: () => focusable,
  });

  // Function members close over live signals; destructuring them here keeps
  // markup unchanged. Data members (alpha, points, ...) are getters and must
  // be read as `presentation.*` in the template.
  const { itemOpacity, presentationOrder } = presentation;
</script>

{#if batch.kind === "points"}
  <g
    class="gg-batch gg-points"
    data-layer={batch.layerIndex}
    opacity={presentation.alpha}
  >
    {#each presentationOrder(presentation.points) as presented (presented.item.index)}
      {@const p = presented.item}
      {@const focusAttrs =
        presentation.pointsFocusable && p.row !== null
          ? {
              tabindex: 0,
              role: "img",
              "aria-label": markLabel?.(p.row) ?? `data point ${p.row + 1}`,
              "data-gg-layer": batch.layerIndex,
              "data-gg-row": p.row,
            }
          : {}}
      {#if p.geometry.kind === "rect"}
        <rect
          class={`gg-shape-${p.shape}`}
          x={p.geometry.x}
          y={p.geometry.y}
          width={p.geometry.width}
          height={p.geometry.height}
          fill={p.fill}
          opacity={itemOpacity(p.alpha, presented.focused)}
          data-gg-focused={focusMask === null ? undefined : presented.focused}
          {...focusAttrs}
        />
      {:else if p.geometry.kind === "polygon"}
        <path
          class={`gg-shape-${p.shape}`}
          d={pointShapePathD(p.geometry)}
          fill={p.fill}
          opacity={itemOpacity(p.alpha, presented.focused)}
          data-gg-focused={focusMask === null ? undefined : presented.focused}
          {...focusAttrs}
        />
      {:else if p.geometry.kind === "lines"}
        <path
          class={`gg-shape-${p.shape}`}
          d={pointShapePathD(p.geometry)}
          fill="none"
          stroke={p.fill}
          stroke-width={p.geometry.strokeWidth}
          opacity={itemOpacity(p.alpha, presented.focused)}
          data-gg-focused={focusMask === null ? undefined : presented.focused}
          {...focusAttrs}
        />
      {:else}
        <circle
          class={`gg-shape-${p.shape}`}
          cx={p.geometry.cx}
          cy={p.geometry.cy}
          r={p.geometry.r}
          fill={p.geometry.mode === "stroke" ? "none" : p.fill}
          stroke={p.geometry.mode === "stroke" ? p.fill : undefined}
          stroke-width={p.geometry.mode === "stroke"
            ? p.geometry.strokeWidth
            : undefined}
          opacity={itemOpacity(p.alpha, presented.focused)}
          data-gg-focused={focusMask === null ? undefined : presented.focused}
          {...focusAttrs}
        />
      {/if}
    {/each}
  </g>
{:else if batch.kind === "paths"}
  <g
    class={`gg-batch ${batch.fills !== undefined ? "gg-areas" : "gg-paths"}`}
    data-layer={batch.layerIndex}
    opacity={presentation.alpha}
  >
    {#each presentationOrder(presentation.subpaths) as presented (presented.item.index)}
      {@const p = presented.item}
      <path
        d={p.d}
        fill={p.fill}
        fill-rule={p.fillRule}
        stroke={p.stroke}
        stroke-width={p.stroke === "none" ? undefined : p.linewidth}
        stroke-dasharray={p.stroke === "none" ? undefined : p.dasharray}
        stroke-linejoin={p.stroke === "none" ? undefined : p.linejoin}
        stroke-linecap={p.stroke === "none" ? undefined : p.linecap}
        opacity={itemOpacity(p.alpha, presented.focused)}
        data-gg-focused={focusMask === null ? undefined : presented.focused}
      />
    {/each}
  </g>
{:else if batch.kind === "rects"}
  <g
    class="gg-batch gg-rects"
    data-layer={batch.layerIndex}
    opacity={presentation.alpha}
  >
    {#each presentationOrder(presentation.rects) as presented (presented.item.index)}
      {@const r = presented.item}
      <rect
        x={r.x}
        y={r.y}
        width={r.width}
        height={r.height}
        fill={r.fill}
        stroke={r.stroke}
        stroke-width={r.stroke === undefined ? undefined : r.strokeWidth}
        stroke-dasharray={r.stroke === undefined ? undefined : r.dasharray}
        opacity={itemOpacity(r.alpha, presented.focused)}
        data-gg-focused={focusMask === null ? undefined : presented.focused}
      />
    {/each}
  </g>
{:else if batch.kind === "segments"}
  <g
    class="gg-batch gg-segments"
    data-layer={batch.layerIndex}
    opacity={presentation.alpha}
  >
    {#each presentationOrder(presentation.segments) as presented (presented.item.index)}
      {@const s = presented.item}
      {#if s.d !== undefined}
        <path
          d={s.d}
          fill="none"
          stroke={s.stroke}
          stroke-width={s.linewidth}
          stroke-dasharray={s.dasharray}
          stroke-linecap={s.linecap}
          opacity={itemOpacity(s.alpha, presented.focused)}
          data-gg-focused={focusMask === null ? undefined : presented.focused}
        />
      {:else}
        <line
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={s.stroke}
          stroke-width={s.linewidth}
          stroke-dasharray={s.dasharray}
          stroke-linecap={s.linecap}
          opacity={itemOpacity(s.alpha, presented.focused)}
          data-gg-focused={focusMask === null ? undefined : presented.focused}
        />
      {/if}
    {/each}
  </g>
{:else if batch.kind === "glyphs"}
  <g
    class="gg-batch gg-glyphs"
    data-layer={batch.layerIndex}
    font-size={batch.size}
    text-anchor={batch.anchor}
    opacity={presentation.alpha}
  >
    {#each presentationOrder(presentation.glyphs) as presented (presented.item.index)}
      {@const glyph = presented.item}
      {#if glyph.box !== undefined}
        <rect
          x={glyph.box.x}
          y={glyph.box.y}
          width={glyph.box.width}
          height={glyph.box.height}
          rx={glyph.box.radius}
          ry={glyph.box.radius}
          fill={glyph.box.fill}
          stroke={glyph.box.stroke}
          stroke-width={glyph.box.strokeWidth}
          opacity={itemOpacity(glyph.alpha, presented.focused)}
          data-gg-focused={focusMask === null ? undefined : presented.focused}
        />
      {/if}
      <text
        x={glyph.x}
        y={glyph.y}
        dy="0.32em"
        fill={glyph.fill}
        font-size={glyph.size}
        opacity={itemOpacity(glyph.alpha, presented.focused)}
        data-gg-focused={focusMask === null ? undefined : presented.focused}
        >{glyph.text}</text
      >
    {/each}
  </g>
{/if}

<style>
  /* Ease interaction-mask opacity changes (legend emphasis, muteSiblings, etc.).
     Transition on direct mark children — not only [data-gg-focused] — so unmute
     on mask clear still eases. Default-off mute (#633) avoids gap flicker; this
     softens remaining mask transitions. Instant under prefers-reduced-motion. */
  /* svelte-ignore css_unused_selector */
  .gg-batch > :global(*) {
    transition: opacity 120ms ease;
  }

  @media (prefers-reduced-motion: reduce) {
    /* svelte-ignore css_unused_selector */
    .gg-batch > :global(*) {
      transition: none;
    }
  }
</style>
