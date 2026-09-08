<script lang="ts">
  import type { CellValue } from "@ggts-sh/core";

  import type {
    InteractionTool,
    IntervalSelection,
    PlotInspectionChange,
  } from "../interaction/interaction.js";
  import type {
    PresentationAnchor,
    PresentationChrome,
  } from "../selection/selection.js";
  import { inspectGuideAxes } from "../inspection/inspect-guide-axes.js";
  import {
    crosshairGapForBox,
    gappedCrosshairSegmentsWithObstacles,
    glyphHoverBox,
    HOVER_CROSSHAIR_GAP_RADIUS,
    HOVER_RING_RADIUS,
    normalizedRect,
    type CrosshairGapBox,
  } from "./geometry.js";
  type Panel = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  type BrushRect = {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  };

  const {
    width,
    height,
    interactive = true,
    inspection = null,
    inspectionPanel = null,
    coordFlipped = false,
    hoverChrome = "ring",
    hoverBoxWidth,
    hoverBoxHeight,
    hoverBoxAnchor = "middle",
    crosshairGapObstacles = [],
    selectedAnchors = [],
    emphasizedAnchors = [],
    brushRect = null,
    activeTool = "inspect",
    areaAwaitingSecond = false,
    committedInterval = null,
  }: {
    width: number;
    height: number;
    interactive?: boolean;
    inspection?: PlotInspectionChange<
      Record<string, CellValue>,
      PropertyKey
    > | null;
    inspectionPanel?: Panel | null;
    coordFlipped?: boolean;
    /** Circle ring for points; `"none"` for mute-only; `"box"` for text glyphs. */
    hoverChrome?: PresentationChrome;
    /** Measured glyph box when hoverChrome is `"box"`. */
    hoverBoxWidth?: number | undefined;
    hoverBoxHeight?: number | undefined;
    hoverBoxAnchor?: "start" | "middle" | "end" | undefined;
    /**
     * Sibling GeomText/GeomLabel AABBs in the focus panel. Guides hard-gap
     * through boxes the line intersects so labels stay readable (#1207).
     */
    crosshairGapObstacles?: readonly CrosshairGapBox[];
    selectedAnchors?: readonly PresentationAnchor[];
    emphasizedAnchors?: readonly PresentationAnchor[];
    brushRect?: BrushRect | null;
    activeTool?: InteractionTool;
    areaAwaitingSecond?: boolean;
    committedInterval?: IntervalSelection | null;
  } = $props();

  const focusHoverBox = $derived(
    inspection !== null && hoverChrome === "box"
      ? glyphHoverBox(inspection.focus.anchor, {
          width: hoverBoxWidth,
          height: hoverBoxHeight,
          textAnchor: hoverBoxAnchor,
        })
      : null,
  );

  // Gap guides at the hover ring/box and any intersecting sibling glyph boxes
  // so they never bisect the focused mark or nearby labels (#1207).
  // Rect chrome keeps continuous guides at the focus (`gapRadius = 0`) but
  // still holes through painted text boxes.
  const crosshairGap = $derived(
    hoverChrome === "ring"
      ? HOVER_CROSSHAIR_GAP_RADIUS
      : hoverChrome === "box" && focusHoverBox !== null
        ? crosshairGapForBox(focusHoverBox.width, focusHoverBox.height)
        : 0,
  );
  const verticalCrosshair = $derived(
    inspection !== null && inspectionPanel !== null
      ? gappedCrosshairSegmentsWithObstacles(
          "vertical",
          inspection.focus.anchor,
          inspectionPanel,
          crosshairGap,
          crosshairGapObstacles,
        )
      : [],
  );
  const horizontalCrosshair = $derived(
    inspection !== null && inspectionPanel !== null
      ? gappedCrosshairSegmentsWithObstacles(
          "horizontal",
          inspection.focus.anchor,
          inspectionPanel,
          crosshairGap,
          crosshairGapObstacles,
        )
      : [],
  );
  const guideAxes = $derived(
    inspection === null
      ? { vertical: false, horizontal: false }
      : inspectGuideAxes(inspection.mode, coordFlipped),
  );
</script>

<svg
  class="gg-stratum gg-interaction-overlay"
  {width}
  {height}
  viewBox={`0 0 ${width} ${height}`}
  aria-hidden="true"
>
  {#if interactive && inspection !== null}
    {#if guideAxes.vertical}
      {#if inspectionPanel}
        {#each verticalCrosshair as segment, i (`v-${i}`)}
          <line
            class="gg-crosshair"
            x1={segment.x1}
            x2={segment.x2}
            y1={segment.y1}
            y2={segment.y2}
          />
        {/each}
        {#if "axisLabel" in inspection}
          <text
            class={`gg-crosshair-axis-label gg-crosshair-axis-label-${inspection.mode}`}
            x={inspection.focus.anchor.x}
            y={inspectionPanel.y + inspectionPanel.height - 4}
            text-anchor="middle">{inspection.axisLabel}</text
          >
        {/if}
      {/if}
    {/if}
    {#if guideAxes.horizontal}
      {#if inspectionPanel}
        {#each horizontalCrosshair as segment, i (`h-${i}`)}
          <line
            class="gg-crosshair"
            x1={segment.x1}
            x2={segment.x2}
            y1={segment.y1}
            y2={segment.y2}
          />
        {/each}
        {#if "axisLabel" in inspection}
          <text
            class={`gg-crosshair-axis-label gg-crosshair-axis-label-${inspection.mode}`}
            x={inspectionPanel.x + 4}
            y={inspection.focus.anchor.y - 4}>{inspection.axisLabel}</text
          >
        {/if}
      {/if}
    {/if}
    {#if hoverChrome === "ring"}
      <circle
        class="gg-hover-ring"
        cx={inspection.focus.anchor.x}
        cy={inspection.focus.anchor.y}
        r={HOVER_RING_RADIUS}
        fill="none"
      />
    {:else if hoverChrome === "box" && focusHoverBox !== null}
      <rect
        class="gg-hover-box"
        x={focusHoverBox.x}
        y={focusHoverBox.y}
        width={focusHoverBox.width}
        height={focusHoverBox.height}
        rx="2"
        ry="2"
        fill="none"
      />
    {/if}
  {/if}
  <!-- Selection/emphasis chrome: rings for points, boxes for glyphs, mute-only
       for paths/rects/segments. Passive consumers (interactive=false) still show
       them. Dense emphasis is density-gated before it reaches this overlay. -->
  {#each selectedAnchors as anchor, index (index)}
    {#if anchor.chrome === "ring"}
      <circle
        class="gg-selected-ring"
        cx={anchor.x}
        cy={anchor.y}
        r="8"
        fill="none"
      />
    {:else if anchor.chrome === "box"}
      {@const box = glyphHoverBox(anchor, {
        width: anchor.width,
        height: anchor.height,
        textAnchor: anchor.textAnchor,
      })}
      <rect
        class="gg-selected-box"
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx="2"
        ry="2"
        fill="none"
      />
    {/if}
  {/each}
  {#each emphasizedAnchors as anchor, index (index)}
    {#if anchor.chrome === "ring"}
      <circle
        class="gg-emphasized-ring"
        cx={anchor.x}
        cy={anchor.y}
        r="11"
        fill="none"
      />
    {:else if anchor.chrome === "box"}
      {@const box = glyphHoverBox(anchor, {
        width: anchor.width,
        height: anchor.height,
        textAnchor: anchor.textAnchor,
      })}
      <rect
        class="gg-emphasized-box"
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx="2"
        ry="2"
        fill="none"
      />
    {/if}
  {/each}
  {#if interactive && brushRect !== null}
    {@const r = normalizedRect(brushRect)}
    <rect
      class="gg-area-draft"
      class:gg-area-draft-select={activeTool === "select-area"}
      class:gg-area-draft-zoom={activeTool === "zoom-area"}
      x={r.x0}
      y={r.y0}
      width={r.x1 - r.x0}
      height={r.y1 - r.y0}
      fill={activeTool === "zoom-area"
        ? "none"
        : "var(--gg-selectionFill, var(--gg-theme-selectionFill, currentColor))"}
      fill-opacity={activeTool === "zoom-area" ? undefined : "0.12"}
      stroke="var(--gg-selectionStroke, var(--gg-theme-selectionStroke, currentColor))"
    />
    {#if activeTool === "zoom-area"}
      <text class="gg-zoom-label" x={r.x0 + 5} y={r.y0 + 15}>Zoom</text>
    {/if}
    {#if areaAwaitingSecond}
      <circle
        class="gg-first-corner"
        cx={brushRect.x0}
        cy={brushRect.y0}
        r="4"
        fill="var(--gg-selectionStroke, var(--gg-theme-selectionStroke, currentColor))"
      />
    {/if}
  {/if}
  {#if interactive && committedInterval !== null}
    <rect
      class="gg-selection"
      x={committedInterval.pixels.x0}
      y={committedInterval.pixels.y0}
      width={committedInterval.pixels.x1 - committedInterval.pixels.x0}
      height={committedInterval.pixels.y1 - committedInterval.pixels.y0}
      fill="var(--gg-selectionFill, var(--gg-theme-selectionFill, currentColor))"
      fill-opacity="0.08"
      stroke="var(--gg-selectionStroke, var(--gg-theme-selectionStroke, currentColor))"
    />
  {/if}
</svg>

<style>
  .gg-crosshair {
    stroke: var(--gg-crosshair, var(--gg-theme-crosshair, currentColor));
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    opacity: 0.55;
  }

  .gg-crosshair-axis-label {
    fill: var(
      --gg-interactionInk,
      var(--gg-theme-interactionInk, currentColor)
    );
    font: 11px/1 var(--gg-font-family, sans-serif);
    paint-order: stroke;
    stroke: var(--gg-tooltipPaper, var(--gg-theme-tooltipPaper, white));
    stroke-width: 3px;
    stroke-linejoin: round;
  }

  .gg-hover-ring,
  .gg-hover-box {
    stroke: var(
      --gg-interactionInk,
      var(--gg-theme-interactionInk, currentColor)
    );
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .gg-selected-ring,
  .gg-selected-box {
    stroke: var(
      --gg-selectionStroke,
      var(--gg-theme-selectionStroke, currentColor)
    );
    stroke-width: 2.5;
    vector-effect: non-scaling-stroke;
  }

  .gg-emphasized-ring,
  .gg-emphasized-box {
    stroke: var(
      --gg-interactionInk,
      var(--gg-theme-interactionInk, currentColor)
    );
    stroke-width: 2;
    stroke-dasharray: 3 2;
    vector-effect: non-scaling-stroke;
  }

  .gg-area-draft,
  .gg-selection {
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .gg-zoom-label {
    fill: var(
      --gg-interactionInk,
      var(--gg-theme-interactionInk, currentColor)
    );
    font: 10px/1 var(--gg-font-family, sans-serif);
    paint-order: stroke;
    stroke: var(--gg-tooltipPaper, var(--gg-theme-tooltipPaper, white));
    stroke-width: 3px;
  }

  @media (forced-colors: active) {
    .gg-emphasized-ring {
      stroke: Highlight;
    }

    .gg-area-draft-select,
    .gg-selection {
      fill: none;
      stroke: Highlight;
    }

    .gg-area-draft-zoom {
      fill: none;
      stroke: CanvasText;
      stroke-width: 2;
    }

    .gg-crosshair,
    .gg-hover-ring,
    .gg-hover-box,
    .gg-selected-ring,
    .gg-selected-box,
    .gg-emphasized-box {
      stroke: Highlight;
    }

    .gg-zoom-label {
      fill: CanvasText;
      stroke: Canvas;
    }
  }
</style>
