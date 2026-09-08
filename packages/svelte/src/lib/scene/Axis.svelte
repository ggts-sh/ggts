<script lang="ts">
  /** One panel's axis ticks (mirrors renderToSVGString's renderPanelAxes).
   *  Axis TITLES are plot-level and render in SceneView. */
  import type { SceneTick, ScenePanel, ThemeTokens } from "@ggts-sh/core";
  import { themeVar } from "@ggts-sh/core";

  const {
    ticks,
    orient,
    panel,
    theme,
  }: {
    ticks: SceneTick[];
    orient: "x" | "y";
    panel: ScenePanel;
    theme: ThemeTokens;
  } = $props();

  const axisText = $derived(themeVar("axisText", theme));
  const axisLine = $derived(themeVar("axisLine", theme));
  const tickColor = $derived(themeVar("tickColor", theme));
</script>

{#if orient === "x"}
  <g
    class="gg-axis gg-axis-x"
    transform={`translate(${panel.x},${panel.y + panel.height})`}
  >
    {#if theme.axisLineX}
      <line
        class="gg-axis-line"
        x1="0"
        y1="0"
        x2={panel.width}
        y2="0"
        stroke={axisLine}
        stroke-width={theme.axisLineWidth}
        vector-effect="non-scaling-stroke"
      />
    {/if}
    {#each ticks as tick, i (i)}
      <g
        class="gg-tick"
        class:gg-tick-minor={tick.kind === "minor"}
        transform={`translate(${tick.pos},0)`}
      >
        {#if tick.kind !== "minor"}<title>{tick.fullLabel ?? tick.label}</title
          >{/if}
        {#if theme.ticksX && tick.showTick !== false}
          <line
            y2={tick.kind === "minor" ? theme.tickLength / 2 : theme.tickLength}
            stroke={tickColor}
            stroke-width={theme.tickWidth}
            opacity={tick.kind === "minor" ? 0.5 : undefined}
            vector-effect="non-scaling-stroke"
          />
        {/if}
        {#if tick.label !== "" && tick.showLabel !== false}
          {#if tick.angle !== undefined && tick.angle !== 0}
            <!-- Rotated band label: hang below the axis, end-anchored at the tick.
                 Wrap-then-rotate (#637): multi-line via tspan dy in local Y. -->
            <text
              transform={`translate(0,${(theme.ticksX && tick.showTick !== false ? theme.tickLength : 0) + 3}) rotate(${tick.angle})`}
              text-anchor="end"
              dominant-baseline="central"
              fill={axisText}
              font-size={tick.labelSize ?? theme.axisTextSize}
              font-weight={theme.fontWeight}
              >{#if tick.lines !== undefined && tick.lines.length > 1}{#each tick.lines as line, li (li)}<tspan
                    x="0"
                    dy={li === 0
                      ? 0
                      : (tick.labelSize ?? theme.axisTextSize) * 1.15}
                    >{line}</tspan
                  >{/each}{:else}{tick.label}{/if}</text
            >
          {:else if tick.lines !== undefined && tick.lines.length > 1}
            <!-- Wrapped band label: one tspan per line, centered. -->
            <text
              y={(theme.ticksX && tick.showTick !== false
                ? theme.tickLength
                : 0) + 3}
              text-anchor="middle"
              fill={axisText}
              font-size={tick.labelSize ?? theme.axisTextSize}
              font-weight={theme.fontWeight}
              >{#each tick.lines as line, li (li)}<tspan
                  x="0"
                  dy={li === 0
                    ? "0.71em"
                    : (tick.labelSize ?? theme.axisTextSize) * 1.15}
                  >{line}</tspan
                >{/each}</text
            >
          {:else}
            <text
              y={(theme.ticksX && tick.showTick !== false
                ? theme.tickLength
                : 0) + 3}
              dy="0.71em"
              text-anchor="middle"
              fill={axisText}
              font-size={tick.labelSize ?? theme.axisTextSize}
              font-weight={theme.fontWeight}>{tick.label}</text
            >
          {/if}
        {/if}
      </g>
    {/each}
  </g>
{:else}
  <g class="gg-axis gg-axis-y" transform={`translate(${panel.x},${panel.y})`}>
    {#if theme.axisLineY}
      <line
        class="gg-axis-line"
        x1="0"
        y1="0"
        x2="0"
        y2={panel.height}
        stroke={axisLine}
        stroke-width={theme.axisLineWidth}
        vector-effect="non-scaling-stroke"
      />
    {/if}
    {#each ticks as tick, i (i)}
      <g
        class="gg-tick"
        class:gg-tick-minor={tick.kind === "minor"}
        transform={`translate(0,${tick.pos})`}
      >
        {#if tick.kind !== "minor"}<title>{tick.fullLabel ?? tick.label}</title
          >{/if}
        {#if theme.ticksY && tick.showTick !== false}
          <line
            x2={tick.kind === "minor"
              ? -theme.tickLength / 2
              : -theme.tickLength}
            stroke={tickColor}
            stroke-width={theme.tickWidth}
            opacity={tick.kind === "minor" ? 0.5 : undefined}
            vector-effect="non-scaling-stroke"
          />
        {/if}
        {#if tick.label !== "" && tick.showLabel !== false}
          <text
            x={-(theme.ticksY && tick.showTick !== false
              ? theme.tickLength
              : 0) - 3}
            dy="0.32em"
            text-anchor="end"
            fill={axisText}
            font-size={tick.labelSize ?? theme.axisTextSize}
            font-weight={theme.fontWeight}>{tick.label}</text
          >
        {/if}
      </g>
    {/each}
  </g>
{/if}
