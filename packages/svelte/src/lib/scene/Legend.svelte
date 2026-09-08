<script lang="ts">
  import type { SceneLegend, ThemeTokens } from "@ggts-sh/core";
  import { LEGEND_ROW_HEIGHT, LINETYPE_DASHES, themeVar } from "@ggts-sh/core";
  import { LINETYPE_NAMES } from "@ggts-sh/spec";

  const { legend, theme }: { legend: SceneLegend; theme: ThemeTokens } =
    $props();
  const uid = $props.id();
  const gradientId = $derived(`gg-ramp-${uid}-${legend.scale}`);
  const ink = $derived(themeVar("ink", theme));
  const contentTop = $derived(
    legend.title === "" ? 0 : (legend.titleHeight ?? 18),
  );
  const horizontal = $derived(legend.direction === "horizontal");
  const rampX = $derived(
    horizontal ? (legend.type === "ramp" ? (legend.rampX ?? 4) : 4) : 4,
  );
  const titleSize = $derived(legend.titleSize ?? 11);
  const labelSize = $derived(legend.labelSize ?? 11);
</script>

<g
  class={`gg-legend gg-legend-${legend.scale} gg-legend-${legend.position ?? "right"} gg-legend-${legend.direction ?? "vertical"}`}
  transform={`translate(${legend.x},${legend.y})`}
>
  {#if legend.title !== ""}
    <text
      class="gg-legend-title"
      x="4"
      y={Math.max(11, contentTop - 7)}
      font-size={titleSize}
      font-weight="bold"
      fill={ink}>{legend.title}</text
    >
  {/if}
  {#if legend.type === "discrete"}
    {#each legend.entries as entry}
      {@const baseX = (entry.x ?? 0) + 4}
      {@const rowHeight = entry.height ?? LEGEND_ROW_HEIGHT}
      {@const lines = entry.lines ?? [entry.label]}
      {@const lineHeight = entry.lineHeight ?? labelSize * 1.2}
      {@const labelY =
        entry.y + (rowHeight - lines.length * lineHeight) / 2 + lineHeight / 2}
      {@const keyY = entry.y + (rowHeight - legend.swatchSize) / 2}
      {@const keyX = baseX + legend.swatchSize / 2}
      {@const keyCenterY = keyY + legend.swatchSize / 2}
      {@const keyColor =
        (entry.shape !== undefined ||
          entry.size !== undefined ||
          entry.linetype !== undefined ||
          entry.linewidth !== undefined) &&
        entry.color === "#999999" &&
        entry.hasPaint !== true
          ? ink
          : entry.color}
      <!-- Shape key geometry must match core's pointShape() so SSR/pure-SVG
           and hydrated Svelte legend keys render identical proportions. -->
      {#if entry.shape === "square"}
        <rect
          class="gg-legend-key gg-shape-square"
          x={keyX -
            Math.min(
              legend.swatchSize / 2,
              entry.size ?? legend.swatchSize / 2,
            )}
          y={keyCenterY -
            Math.min(
              legend.swatchSize / 2,
              entry.size ?? legend.swatchSize / 2,
            )}
          width={Math.min(
            legend.swatchSize,
            (entry.size ?? legend.swatchSize / 2) * 2,
          )}
          height={Math.min(
            legend.swatchSize,
            (entry.size ?? legend.swatchSize / 2) * 2,
          )}
          fill={keyColor}
          opacity={entry.alpha}
        />
      {:else if entry.shape === "triangle"}
        {@const r = Math.min(
          legend.swatchSize / 2,
          entry.size ?? legend.swatchSize / 2,
        )}
        <path
          class="gg-legend-key gg-shape-triangle"
          d={`M${keyX} ${keyCenterY - r * 1.2}L${keyX + r * 1.1} ${keyCenterY + r * 0.9}L${keyX - r * 1.1} ${keyCenterY + r * 0.9}Z`}
          fill={keyColor}
          opacity={entry.alpha}
        />
      {:else if entry.shape === "diamond"}
        {@const r = Math.min(
          legend.swatchSize / 2,
          entry.size ?? legend.swatchSize / 2,
        )}
        <path
          class="gg-legend-key gg-shape-diamond"
          d={`M${keyX} ${keyCenterY - r * 1.25}L${keyX + r} ${keyCenterY}L${keyX} ${keyCenterY + r * 1.25}L${keyX - r} ${keyCenterY}Z`}
          fill={keyColor}
          opacity={entry.alpha}
        />
      {:else if entry.shape === "circle-open"}
        {@const r = Math.min(
          legend.swatchSize / 2,
          entry.size ?? legend.swatchSize / 2,
        )}
        <circle
          class="gg-legend-key gg-shape-circle-open"
          cx={keyX}
          cy={keyCenterY}
          {r}
          fill="none"
          stroke={keyColor}
          stroke-width={Math.max(1, r / 3)}
          opacity={entry.alpha}
        />
      {:else if entry.shape === "plus" || entry.shape === "cross"}
        {@const r = Math.min(
          legend.swatchSize / 2,
          entry.size ?? legend.swatchSize / 2,
        )}
        <path
          class={`gg-legend-key gg-shape-${entry.shape}`}
          d={entry.shape === "plus"
            ? `M${keyX - r} ${keyCenterY}H${keyX + r}M${keyX} ${keyCenterY - r}V${keyCenterY + r}`
            : `M${keyX - r * 0.75} ${keyCenterY - r * 0.75}L${keyX + r * 0.75} ${keyCenterY + r * 0.75}M${keyX + r * 0.75} ${keyCenterY - r * 0.75}L${keyX - r * 0.75} ${keyCenterY + r * 0.75}`}
          fill="none"
          stroke={keyColor}
          stroke-width={Math.max(1, r / 2)}
          opacity={entry.alpha}
        />
      {:else if entry.shape !== undefined || entry.size !== undefined}
        <circle
          class="gg-legend-key gg-shape-circle"
          cx={keyX}
          cy={keyCenterY}
          r={Math.min(
            legend.swatchSize / 2,
            entry.size ?? legend.swatchSize / 2,
          )}
          fill={keyColor}
          opacity={entry.alpha}
        />
      {:else if entry.linetype !== undefined || entry.linewidth !== undefined}
        {@const linetype = entry.linetype ?? "solid"}
        {@const dash = LINETYPE_DASHES[LINETYPE_NAMES.indexOf(linetype)] ?? []}
        <line
          class="gg-legend-key"
          x1={baseX}
          y1={keyCenterY}
          x2={baseX + legend.swatchSize}
          y2={keyCenterY}
          stroke={keyColor}
          stroke-width={entry.linewidth ?? 1.5}
          stroke-dasharray={dash.length === 0 ? undefined : dash.join(" ")}
          opacity={entry.alpha}
        />
      {:else}
        <rect
          class="gg-legend-swatch"
          x={baseX}
          y={keyY}
          width={legend.swatchSize}
          height={legend.swatchSize}
          fill={entry.color}
          opacity={entry.alpha}
        />
      {/if}
      <text
        class="gg-legend-label"
        x={baseX + legend.swatchSize + (legend.keyGap ?? 6)}
        y={entry.lines === undefined ? entry.y + rowHeight / 2 : labelY}
        dy="0.32em"
        font-size={labelSize}
        fill={ink}
      >
        {#if entry.lines !== undefined}
          {#each lines as line, index}
            <tspan
              x={baseX + legend.swatchSize + (legend.keyGap ?? 6)}
              dy={index === 0 ? undefined : lineHeight}>{line}</tspan
            >
          {/each}
        {:else}
          {entry.label}{#if entry.fullLabel !== undefined && entry.fullLabel !== entry.label}<title
              >{entry.fullLabel}</title
            >{/if}
        {/if}
      </text>
    {/each}
  {:else if legend.type === "steps"}
    {#each legend.entries as entry}
      {@const entryX = 4 + (entry.x ?? 0)}
      {@const entryY = contentTop + entry.y}
      <rect
        class="gg-legend-step"
        x={entryX}
        y={entryY}
        width={legend.stepWidth}
        height={legend.stepHeight}
        fill={entry.color}
      />
      {#if entry.label !== ""}
        <text
          class="gg-legend-label"
          x={horizontal
            ? entryX + legend.stepWidth / 2
            : entryX + legend.stepWidth + 6}
          y={horizontal
            ? entryY + legend.stepHeight + 12
            : entryY + legend.stepHeight / 2}
          text-anchor={horizontal ? "middle" : "start"}
          dy="0.32em"
          font-size={labelSize}
          fill={ink}
          >{entry.label}{#if entry.fullLabel !== undefined && entry.fullLabel !== entry.label}<title
              >{entry.fullLabel}</title
            >{/if}</text
        >
      {/if}
    {/each}
  {:else}
    <defs>
      <linearGradient
        id={gradientId}
        x1="0"
        y1="0"
        x2={horizontal ? "1" : "0"}
        y2={horizontal ? "0" : "1"}
      >
        {#each legend.stops as [offset, color]}
          <stop offset={`${offset * 100}%`} stop-color={color} />
        {/each}
      </linearGradient>
    </defs>
    <rect
      class="gg-legend-ramp"
      x={rampX}
      y={contentTop}
      width={legend.rampWidth}
      height={legend.rampHeight}
      fill={`url(#${gradientId})`}
    />
    {#each legend.ticks as tick}
      {@const pos = tick.pos ?? tick.y ?? 0}
      {#if legend.showTicks !== false}
        <line
          class="gg-legend-tick"
          x1={horizontal ? rampX + pos : rampX + legend.rampWidth}
          y1={horizontal ? contentTop + legend.rampHeight : contentTop + pos}
          x2={horizontal ? rampX + pos : rampX + legend.rampWidth + 4}
          y2={horizontal
            ? contentTop + legend.rampHeight + 4
            : contentTop + pos}
          stroke={ink}
        />
      {/if}
      {#if tick.label !== ""}
        <text
          class="gg-legend-label"
          x={horizontal ? rampX + pos : rampX + legend.rampWidth + 6}
          y={horizontal
            ? contentTop + legend.rampHeight + 12
            : contentTop + pos}
          text-anchor={horizontal ? "middle" : "start"}
          dy="0.32em"
          font-size={labelSize}
          fill={ink}
          >{tick.label}{#if tick.fullLabel !== undefined && tick.fullLabel !== tick.label}<title
              >{tick.fullLabel}</title
            >{/if}</text
        >
      {/if}
    {/each}
  {/if}
</g>
