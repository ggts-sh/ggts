<script lang="ts">
  /**
   * Interactive legend hit targets + clear control for GGPlot.
   * Host owns focus state machine, key index, and commit/preview side effects.
   * Clear anchors off the pressed legend box (see resolveClearControlLayout).
   */
  import {
    CLEAR_HIDE_DELAY_MS,
    shouldRevealClearControl,
    type ClearControlLayout,
  } from "../assembly/layout.js";
  import type { InteractiveLegendEntry, LegendEntryIdentity } from "./focus.js";

  const {
    entries,
    previewIdentity = null,
    pressedIdentity = null,
    rovingIndex = 0,
    sceneWidth: _sceneWidth,
    /** Retained for caller layout parity; Clear is legend-relative, not scene-corner. */
    sceneHeight: _sceneHeight,
    /** Scene-local Clear position; null hides the control (no pressed legend). */
    clearLayout = null,
    onPreviewIndex,
    onPreviewClear,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onFocus,
    onBlur,
    onClick,
    onKeyDown,
    onClearPointerDown,
    onClearPointerCancel,
    onClearClick,
  }: {
    entries: readonly InteractiveLegendEntry[];
    previewIdentity?: LegendEntryIdentity | null;
    pressedIdentity?: LegendEntryIdentity | null;
    rovingIndex?: number;
    sceneWidth: number;
    sceneHeight: number;
    clearLayout?: ClearControlLayout | null;
    onPreviewIndex: (index: number, source: "pointer") => void;
    onPreviewClear: () => void;
    onPointerDown: (event: PointerEvent, index: number) => void;
    onPointerUp: (event: PointerEvent, index: number) => void;
    onPointerCancel: () => void;
    onFocus: (index: number) => void;
    onBlur: (event: FocusEvent) => void;
    onClick: (event: MouseEvent, index: number) => void;
    onKeyDown: (event: KeyboardEvent, index: number) => void;
    onClearPointerDown: (pointerType: string) => void;
    onClearPointerCancel: () => void;
    onClearClick: (event: MouseEvent) => void;
  } = $props();

  /** Pointer or focus is inside legend targets / Clear chrome. */
  let chromeActive = $state(false);
  /** Hide delay elapsed after leave — Clear fades so screenshots stay clean. */
  let hideElapsed = $state(false);
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const clearVisible = $derived(
    shouldRevealClearControl({
      pressed: clearLayout !== null,
      chromeActive,
      hideElapsed,
    }),
  );

  function clearHideTimer(): void {
    if (hideTimer === null) return;
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  function pinChrome(): void {
    clearHideTimer();
    chromeActive = true;
    hideElapsed = false;
  }

  function scheduleHide(): void {
    chromeActive = false;
    clearHideTimer();
    hideTimer = setTimeout(() => {
      hideElapsed = true;
      hideTimer = null;
    }, CLEAR_HIDE_DELAY_MS);
  }

  /**
   * Chrome uses pointer-events:none so plot hit-testing still works; enter/leave
   * therefore fire on the interactive children (targets + Clear), not the wrapper.
   * relatedTarget checks keep the pin alive while moving between those children.
   */
  function stillInsideChrome(
    current: EventTarget | null,
    next: EventTarget | null,
  ): boolean {
    return (
      current instanceof Element &&
      next instanceof Node &&
      current.closest(".gg-legend-chrome")?.contains(next) === true
    );
  }

  function onChromeChildPointerLeave(event: PointerEvent): void {
    if (stillInsideChrome(event.currentTarget, event.relatedTarget)) return;
    scheduleHide();
  }

  function onChromeFocusOut(event: FocusEvent): void {
    if (stillInsideChrome(event.currentTarget, event.relatedTarget)) return;
    scheduleHide();
  }

  // Track pressed-ness as a boolean so parent re-renders that rebuild the
  // clearLayout object do not restart the hide clock or fight pinChrome.
  const clearPressed = $derived(clearLayout !== null);

  // On a fresh press with idle chrome (touch commit, no hover), start the hide
  // clock. If the pointer is already over a target from the click, stay pinned
  // until leave/blur calls scheduleHide.
  $effect(() => {
    if (!clearPressed) {
      clearHideTimer();
      hideElapsed = false;
      return;
    }
    if (chromeActive) {
      clearHideTimer();
      hideElapsed = false;
      return;
    }
    clearHideTimer();
    hideTimer = setTimeout(() => {
      hideElapsed = true;
      hideTimer = null;
    }, CLEAR_HIDE_DELAY_MS);
    return () => {
      clearHideTimer();
    };
  });

  function sameIdentity(
    left: LegendEntryIdentity | null | undefined,
    right: LegendEntryIdentity,
  ): boolean {
    return (
      left !== null &&
      left !== undefined &&
      left.scale === right.scale &&
      left.entryIndex === right.entryIndex
    );
  }

  function targetAriaLabel(target: InteractiveLegendEntry): string {
    const scale = target.identity.scale;
    const aesthetics = target.legend.aesthetics ?? [scale];
    return `${target.legend.title || scale}: ${target.entry.fullLabel ?? target.entry.label} (${aesthetics.join(" + ")} legend)`;
  }

  /**
   * Side titles shift keys via entry.x, and scene keys draw at entry.x + 4.
   * Left side-titles reserve PADDING (4) that keys skip; targets start at the
   * actual key glyph so title text stays outside the hit area.
   */
  function targetStart(target: InteractiveLegendEntry): number {
    const { titleHeight, titleX, entries: legendEntries } = target.legend;
    const leading =
      titleHeight === 0 && titleX === 4 && (legendEntries[0]?.x ?? 0) > 0
        ? 4
        : 0;
    return leading + (target.entry.x ?? 0);
  }

  function targetLeft(target: InteractiveLegendEntry): number {
    return target.legend.x + targetStart(target);
  }

  /** Right-hand titles occupy the box beyond this x; hit targets stop before it. */
  function contentRight(target: InteractiveLegendEntry): number {
    const { titleHeight, titleX, width } = target.legend;
    return titleHeight === 0 && titleX !== undefined && titleX > 4
      ? Math.min(width, titleX)
      : width;
  }

  function targetWidth(target: InteractiveLegendEntry, index: number): number {
    const start = targetStart(target);
    if (target.legend.direction !== "horizontal")
      return Math.max(24, contentRight(target) - start);
    const next = entries[index + 1];
    const end =
      next?.legend === target.legend && next.entry.y === target.entry.y
        ? targetStart(next)
        : contentRight(target);
    return Math.max(24, end - start);
  }
</script>

{#if entries.length > 0 || clearLayout !== null}
  <div
    class="gg-legend-chrome"
    role="presentation"
    onfocusin={pinChrome}
    onfocusout={onChromeFocusOut}
  >
    {#if entries.length > 0}
      <div
        class="gg-legend-targets"
        role="group"
        aria-label="Interactive legends"
      >
        {#each entries as target, index (`${target.identity.scale}:${target.identity.entryIndex}`)}
          <button
            type="button"
            class="gg-legend-target"
            class:gg-legend-target-active={sameIdentity(
              previewIdentity,
              target.identity,
            )}
            aria-label={targetAriaLabel(target)}
            aria-pressed={sameIdentity(pressedIdentity, target.identity)}
            tabindex={index === rovingIndex ? 0 : -1}
            data-gg-legend-target
            data-index={index}
            style:left={`${targetLeft(target)}px`}
            style:top={`${target.legend.y + target.entry.y}px`}
            style:width={`${targetWidth(target, index)}px`}
            style:height={`${Math.max(24, target.entry.height ?? 24)}px`}
            onpointerenter={(event) => {
              pinChrome();
              if (event.pointerType !== "touch")
                onPreviewIndex(index, "pointer");
            }}
            onpointerleave={(event) => {
              onPreviewClear();
              onChromeChildPointerLeave(event);
            }}
            onpointerdown={(event) => onPointerDown(event, index)}
            onpointerup={(event) => onPointerUp(event, index)}
            onpointercancel={() => onPointerCancel()}
            onfocus={() => onFocus(index)}
            onblur={onBlur}
            onclick={(event) => onClick(event, index)}
            onkeydown={(event) => onKeyDown(event, index)}
          >
            <span class="gg-legend-target-label">{target.entry.label}</span>
          </button>
        {/each}
      </div>
    {/if}
    {#if clearLayout !== null}
      <!-- clearLayout gates visibility (pressed legend scale). Anchored relative to
           the pressed legend box (below right stacks, beside bottom strips) so
           title/swatch labels stay readable. Fades after idle so screenshots of a
           committed series stay clean; reappears on legend chrome hover/focus.
           Smoke baseline: interaction-legend-focus-committed-light.png. -->
      <button
        type="button"
        class="gg-legend-clear"
        class:gg-legend-clear-faded={!clearVisible}
        aria-label="Clear legend focus"
        aria-hidden={!clearVisible ? true : undefined}
        tabindex={clearVisible ? 0 : -1}
        style:left={`${clearLayout.left}px`}
        style:top={`${clearLayout.top}px`}
        onpointerenter={pinChrome}
        onpointerleave={onChromeChildPointerLeave}
        onpointerdown={(event) => onClearPointerDown(event.pointerType)}
        onpointercancel={() => onClearPointerCancel()}
        onclick={(event) => onClearClick(event)}>Clear</button
      >
    {/if}
  </div>
{/if}

<style>
  .gg-legend-chrome {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }

  .gg-legend-clear {
    position: absolute;
    z-index: 5;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Compact row — matches legend entry height (AA 24px), not a 44×44 slab. */
    min-width: 24px;
    min-height: 24px;
    height: 24px;
    margin: 0;
    border: 1px solid
      var(--gg-tooltipBorder, var(--gg-theme-tooltipBorder, currentColor));
    border-radius: 0.2rem;
    padding: 0 0.4rem;
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
    font: 600 0.75rem/1 var(--gg-font-family, system-ui, sans-serif);
    letter-spacing: -0.01em;
    white-space: nowrap;
    pointer-events: auto;
    cursor: pointer;
    opacity: 1;
    transition: opacity 180ms ease;
  }

  .gg-legend-clear-faded {
    opacity: 0;
    pointer-events: none;
  }

  .gg-legend-clear:hover {
    background: color-mix(
      in srgb,
      var(--gg-tooltipInk, var(--gg-theme-tooltipInk, var(--gg-ink, #1f2328)))
        6%,
      var(
        --gg-tooltipPaper,
        var(--gg-theme-tooltipPaper, var(--gg-paper, #fff))
      )
    );
  }

  .gg-legend-targets {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }

  .gg-legend-target {
    position: absolute;
    min-width: 24px;
    min-height: 24px;
    margin: 0;
    border: 1px solid transparent;
    border-radius: 3px;
    padding: 0;
    background: transparent;
    color: transparent;
    pointer-events: auto;
    touch-action: manipulation;
  }

  .gg-legend-target:hover,
  .gg-legend-target-active,
  .gg-legend-target[aria-pressed="true"] {
    border-color: var(
      --gg-interactionInk,
      var(--gg-theme-interactionInk, currentColor)
    );
    background: color-mix(in srgb, currentColor 7%, transparent);
  }

  .gg-legend-target:focus-visible {
    outline: 2px solid var(--gg-focusRing, var(--gg-theme-focusRing, Highlight));
    outline-offset: -2px;
  }

  .gg-legend-clear:focus-visible {
    outline: 2px solid var(--gg-focusRing, var(--gg-theme-focusRing, Highlight));
    outline-offset: 2px;
  }

  @media (forced-colors: active) {
    .gg-legend-target:hover,
    .gg-legend-target-active,
    .gg-legend-target[aria-pressed="true"] {
      border-color: Highlight;
      background: Canvas;
    }

    .gg-legend-clear {
      border-color: ButtonText;
      background: Canvas;
      color: CanvasText;
    }
  }

  /* Local sr-only for target labels (GGPlot keeps its own .gg-sr-only for other chrome). */
  .gg-legend-target-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
</style>
