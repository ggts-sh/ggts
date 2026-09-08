<script lang="ts">
  import type { Snippet } from "svelte";

  import type { CellValue } from "@ggts-sh/core";

  import type {
    PlotInspectionChange,
    TooltipTotal,
  } from "../interaction/interaction.js";
  import {
    collapseIdenticalDisplayMembers,
    defaultTooltipRows,
    formatTooltipCell,
    selectHoverDisplayMembers,
    type TooltipAxisFormatters,
    type TooltipFieldLabs,
  } from "./display-members.js";
  import { TRANSIENT_MEMBER_LIMIT } from "./resolver.js";
  import { shouldShowTooltipPinHint } from "./tooltip-chrome.js";
  import { tooltipTotalPlacement } from "./tooltip-total.js";

  const {
    inspection,
    width,
    height,
    content,
    interactive = false,
    onclose,
    onenter,
    onleave,
    onexited,
    id,
    docked = false,
    motion = "none",
    labs = null,
    fontSizePx = 12.5,
    /** Whether inspect pinning is enabled (drives instructional footers). */
    pin = true,
    /**
     * Resolved theme tooltip keyline. Flat (gridless) themes pass
     * `"transparent"` so default content stays silent (#1069).
     */
    tooltipBorder = "#b8b8b8",
    /**
     * Scale-aware x/y formatters from the render model. Position field rows
     * use these so stat-layer temporal values match the axis header (#1113).
     */
    axisFormatters = null,
    tooltipTotal = "auto",
  }: {
    inspection: PlotInspectionChange<Record<string, CellValue>, PropertyKey>;
    width: number;
    height: number;
    content?:
      | Snippet<[PlotInspectionChange<Record<string, CellValue>, PropertyKey>]>
      | undefined;
    interactive?: boolean;
    onclose?: (source: "pointer" | "keyboard") => void;
    onenter?: () => void;
    onleave?: () => void;
    onexited?: () => void;
    id?: string;
    docked?: boolean;
    motion?: "enter" | "none" | "exit";
    /** Plot labs used for default tooltip field labels (#752). */
    labs?: TooltipFieldLabs | null;
    /**
     * Theme body type size (px). Default tooltips track plot chrome rather
     * than a hard-coded 16px scale (#753 residual).
     */
    fontSizePx?: number;
    pin?: boolean;
    tooltipBorder?: string;
    axisFormatters?: TooltipAxisFormatters | null;
    tooltipTotal?: TooltipTotal;
  } = $props();

  const showPinHint = $derived(
    shouldShowTooltipPinHint({ pin, tooltipBorder }),
  );

  const anchor = $derived(inspection.focus.anchor);
  const OFFSET = 10;
  const EDGE = 8;
  let tooltipElement = $state<HTMLDivElement | null>(null);
  let measuredWidth = $state(0);
  let measuredHeight = $state(0);

  $effect(() => {
    if (docked || tooltipElement === null) return;
    const element = tooltipElement;
    const measure = () => {
      measuredWidth = element.offsetWidth;
      measuredHeight = element.offsetHeight;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  });

  // Track theme fontSize so tooltips sit with axis/legend chrome (#753).
  const fontStyle = $derived(`font-size:${fontSizePx}px;`);

  const style = $derived(
    docked
      ? fontStyle
      : (() => {
          const tooltipWidth = Math.min(
            measuredWidth || 280,
            Math.max(0, width - EDGE * 2),
          );
          const tooltipHeight = Math.min(
            measuredHeight || 160,
            Math.max(0, height - EDGE * 2),
          );
          const preferredX =
            anchor.x + OFFSET + tooltipWidth <= width - EDGE
              ? anchor.x + OFFSET
              : anchor.x - OFFSET - tooltipWidth;
          const preferredY =
            anchor.y + OFFSET + tooltipHeight <= height - EDGE
              ? anchor.y + OFFSET
              : anchor.y - OFFSET - tooltipHeight;
          const left = Math.max(
            EDGE,
            Math.min(preferredX, width - tooltipWidth - EDGE),
          );
          const top = Math.max(
            EDGE,
            Math.min(preferredY, height - tooltipHeight - EDGE),
          );
          return `left:${left}px;top:${top}px;${fontStyle}`;
        })(),
  );

  // Collapse identical field blocks for default rendering only (#385). Public
  // `inspection.members` stays full for custom content / oninspect.
  const displayMembers = $derived(
    collapseIdenticalDisplayMembers(
      inspection.members,
      inspection.focus,
      axisFormatters,
      inspection.mode,
    ),
  );

  // Transient hover: top-k by value (focus force-included). Pin lists all
  // inside the scrollable panel (#1274 / #1269).
  const shownMembers = $derived(
    inspection.state === "transient"
      ? selectHoverDisplayMembers(displayMembers, inspection.focus, {
          mode: inspection.mode,
          limit: TRANSIENT_MEMBER_LIMIT,
        })
      : displayMembers,
  );

  // Prefer the full axis-group size when present (transient snapshots are
  // already capped upstream, so displayMembers.length alone is always ≤8).
  const overflowCount = $derived(
    inspection.state === "transient"
      ? Math.max(
          0,
          (inspection.mode === "x" || inspection.mode === "y"
            ? inspection.groupMemberCount
            : displayMembers.length) - shownMembers.length,
        )
      : 0,
  );

  const totalPlacement = $derived(
    tooltipTotalPlacement({
      tooltipTotal,
      groupTotal: inspection.groupTotal,
      memberCount: displayMembers.length,
      mode: inspection.mode,
    }),
  );
  const stackTotal = $derived(
    totalPlacement === null ? null : (inspection.groupTotal ?? null),
  );

  const departing = $derived(motion === "exit");
  const liveInteractive = $derived(
    !departing && interactive && inspection.state === "pinned",
  );
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={tooltipElement}
  id={departing ? undefined : id}
  class={departing ? "gg-tooltip-ghost" : "gg-tooltip"}
  class:gg-tooltip-interactive={!departing && interactive}
  class:gg-tooltip-pinned={!departing && inspection.state === "pinned"}
  class:gg-tooltip-docked={docked}
  data-gg-tooltip-motion={motion === "enter" ? "enter" : undefined}
  {style}
  role={liveInteractive ? "dialog" : departing ? undefined : "tooltip"}
  tabindex={liveInteractive ? -1 : undefined}
  aria-label={liveInteractive ? "Data inspection" : undefined}
  aria-hidden={departing ? true : undefined}
  inert={departing ? true : undefined}
  onpointerenter={departing ? undefined : onenter}
  onpointerleave={departing ? undefined : onleave}
  onkeydown={departing
    ? undefined
    : (event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onclose?.("keyboard");
        }
      }}
  ontransitionend={(event) => {
    if (
      motion !== "exit" ||
      event.target !== event.currentTarget ||
      event.propertyName !== "opacity"
    )
      return;
    onexited?.();
  }}
>
  {#if content !== undefined}
    {@render content(inspection)}
  {:else}
    {#if inspection.mode === "x" || inspection.mode === "y"}
      <div class="gg-tooltip-axis">{inspection.axisLabel}</div>
    {/if}
    <div class="gg-tooltip-members">
      {#if totalPlacement === "top" && stackTotal !== null}
        <dl class="gg-tooltip-total gg-tooltip-total-top">
          <dt>Total</dt>
          <dd>{formatTooltipCell(stackTotal)}</dd>
        </dl>
      {/if}
      {#each shownMembers as member, index (`${member.layerIndex}:${String(member.key)}:${index}`)}
        <dl class:gg-tooltip-focus={member === inspection.focus}>
          {#each defaultTooltipRows( member.fields, inspection.mode, { labs } ) as row (row.key)}
            <dt>{row.label}</dt>
            <dd>
              {formatTooltipCell(row.value, {
                channel: row.valueChannel,
                axisFormatters: member.row === null ? axisFormatters : null,
              })}
            </dd>
          {/each}
        </dl>
      {/each}
      {#if totalPlacement === "bottom" && stackTotal !== null}
        <dl class="gg-tooltip-total">
          <dt>Total</dt>
          <dd>{formatTooltipCell(stackTotal)}</dd>
        </dl>
      {/if}
    </div>

    {#if overflowCount > 0}
      <!-- Overflow is a data-completeness signal; keep it even when the pin
           affordance is silent for flat chrome (#1069 / Devin). -->
      <p class="gg-tooltip-more">
        {#if showPinHint}
          +{overflowCount} more · pin to inspect all
        {:else}
          +{overflowCount} more
        {/if}
      </p>
    {:else if showPinHint && inspection.state === "transient"}
      <p class="gg-tooltip-hint">Click to pin</p>
    {/if}
  {/if}
  {#if liveInteractive}
    <button type="button" onclick={() => onclose?.("pointer")}>Close</button>
  {/if}
</div>

<style>
  .gg-tooltip,
  .gg-tooltip-ghost {
    position: absolute;
    pointer-events: none;
    z-index: auto;
    background: var(
      --gg-tooltipPaper,
      var(
        --gg-tooltip-background,
        var(--gg-theme-tooltipPaper, var(--gg-paper, #fff))
      )
    );
    color: var(
      --gg-tooltipInk,
      var(
        --gg-tooltip-foreground,
        var(--gg-theme-tooltipInk, var(--gg-ink, #1f2328))
      )
    );
    border: 1px solid
      var(
        --gg-tooltipBorder,
        var(
          --gg-tooltip-border,
          var(--gg-theme-tooltipBorder, var(--gg-grid, #b8b8b8))
        )
      );
    border-radius: var(--gg-tooltip-radius, 3px);
    padding: 8px 10px;
    font-family: var(--gg-font-family, inherit);
    /* Default only — runtime size is set from theme.fontSize via style (#753).
       Smoke interaction VR baselines track this size (same-PR). */
    font-size: 12.5px;
    line-height: 1.4;
    max-width: min(280px, calc(100% - 16px));
    max-height: min(320px, calc(100% - 16px));
    box-sizing: border-box;
    overflow: auto;
    overflow-wrap: anywhere;
    box-shadow: var(--gg-tooltip-shadow, none);
    user-select: text;
  }

  .gg-tooltip[data-gg-tooltip-motion="enter"],
  .gg-tooltip-ghost {
    transition: opacity 160ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  .gg-tooltip[data-gg-tooltip-motion="enter"] {
    @starting-style {
      opacity: 0;
    }
  }

  .gg-tooltip-ghost {
    opacity: 0;
    pointer-events: none;
    @starting-style {
      opacity: 1;
    }
  }

  .gg-tooltip-docked {
    position: absolute;
    inset: calc(100% + 8px) 0 auto;
    width: auto;
    max-width: none;
    max-height: 240px;
    box-sizing: border-box;
  }

  .gg-tooltip-interactive.gg-tooltip-pinned {
    pointer-events: auto;
  }

  .gg-tooltip-members {
    display: grid;
    gap: 6px;
  }

  dl {
    margin: 0;
    display: grid;
    grid-template-columns: auto auto;
    gap: 0 10px;
    contain-intrinsic-size: 28px;
    content-visibility: auto;
  }

  .gg-tooltip-focus {
    font-weight: 600;
  }

  .gg-tooltip-total {
    border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    padding-top: 4px;
    margin-top: 2px;
  }

  .gg-tooltip-total-top {
    border-top: none;
    padding-top: 0;
    margin-top: 0;
    border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    padding-bottom: 4px;
    margin-bottom: 2px;
  }

  dt {
    font-weight: 600;
  }

  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .gg-tooltip-axis {
    margin-bottom: 6px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }

  .gg-tooltip-more,
  .gg-tooltip-hint {
    margin: 7px 0 0;
    /* Solid mix (not alpha) so secondary lines clear WCAG AA 4.5:1 on the
       tooltip paper — transparent 65% failed axe on linked-views with pin.
       Mix against the tooltip card, not page --gg-paper (dark themes). */
    color: color-mix(
      in srgb,
      currentColor 72%,
      var(
        --gg-tooltipPaper,
        var(
          --gg-tooltip-background,
          var(--gg-theme-tooltipPaper, var(--gg-paper, #fff))
        )
      )
    );
    font-size: 10px;
  }

  button {
    min-width: 44px;
    min-height: 44px;
    margin-top: 8px;
  }

  @media (forced-colors: active) {
    .gg-tooltip,
    .gg-tooltip-ghost {
      border-color: CanvasText;
      background: Canvas;
      color: CanvasText;
      box-shadow: none;
      forced-color-adjust: auto;
    }
  }
</style>
