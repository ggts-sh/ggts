<script lang="ts">
  import { onMount } from "svelte";

  import { observeUserIntent } from "$lib/load-on-intent";

  /**
   * Homepage grammar chart: static SVG shell until the user engages
   * (hover/focus or the explicit load button). Auto-import on mount pulled the
   * full chart stack and locked the homepage for seconds. Parent code-path
   * section owns the title and code tabs — this component is the chart only.
   *
   * The static SVG has no focusable nodes, so a "Load interactive chart"
   * button keeps a keyboard path after the old step accordion was removed.
   * After upgrade, focus is restored into .gg-capture so Tab does not jump to
   * document.body when the load button unmounts (#1362).
   */
  let {
    staticSvgLightSite,
    staticSvgDarkSite,
  }: {
    staticSvgLightSite: string;
    staticSvgDarkSite: string;
  } = $props();

  let host = $state<HTMLElement | null>(null);
  let Plot = $state<
    typeof import("$lib/components/GrammarDemoPlot.svelte").default | null
  >(null);
  let loadStarted = $state(false);
  let liveReady = $state(false);
  let shellVisible = $state(true);
  let mounted = $state(false);
  /** True when the user tabbed into the shell; hand focus to .gg-capture on ready. */
  let restoreKeyboardFocus = $state(false);

  function ensureLive(): void {
    if (loadStarted || Plot !== null) return;
    loadStarted = true;
    void import("$lib/components/GrammarDemoPlot.svelte").then((mod) => {
      Plot = mod.default;
    });
  }

  function hideShellIfReady(): void {
    if (liveReady) shellVisible = false;
  }

  function onStaticTransitionEnd(event: TransitionEvent): void {
    if (event.propertyName !== "opacity") return;
    hideShellIfReady();
  }

  function onShellFocusIn(): void {
    if (!liveReady) restoreKeyboardFocus = true;
  }

  function onShellFocusOut(event: FocusEvent): void {
    // relatedTarget === null means blur from unmount (keep restore pending).
    const next = event.relatedTarget;
    if (next === null) return;
    if (next instanceof Node && host !== null && host.contains(next)) return;
    restoreKeyboardFocus = false;
  }

  function focusAfterUpgrade(root: HTMLElement): boolean {
    const capture = root.querySelector<HTMLElement>(".gg-capture");
    const target =
      capture ??
      root.querySelector<HTMLElement>('.gg-plot-root[data-gg-ready="true"]') ??
      root.querySelector<HTMLElement>(".gg-plot-root");
    if (target === null) return false;
    const active = document.activeElement;
    if (
      active !== null &&
      active !== document.body &&
      active !== document.documentElement &&
      !root.contains(active)
    ) {
      return true; // user moved on — clear without focusing
    }
    if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) {
      target.tabIndex = -1;
    }
    queueMicrotask(() => {
      target.focus({ preventScroll: true });
    });
    return true;
  }

  onMount(() => {
    mounted = true;
    const el = host;
    if (el === null) return;
    return observeUserIntent(el, ensureLive);
  });

  const READY_FALLBACK_MS = 10_000;
  $effect(() => {
    if (Plot === null || host === null) {
      liveReady = false;
      return;
    }
    const root = host;
    const markReady = (): void => {
      liveReady = true;
    };
    const already = root.querySelector('.gg-plot-root[data-gg-ready="true"]');
    if (already !== null) {
      markReady();
      return;
    }
    liveReady = false;
    const observer = new MutationObserver(() => {
      if (root.querySelector('.gg-plot-root[data-gg-ready="true"]') !== null) {
        markReady();
        observer.disconnect();
      }
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-gg-ready"],
      subtree: true,
      childList: true,
    });
    const fallback = window.setTimeout(markReady, READY_FALLBACK_MS);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  });

  $effect(() => {
    if (!liveReady) {
      shellVisible = true;
      return;
    }
    const fallback = window.setTimeout(hideShellIfReady, 250);
    return () => {
      window.clearTimeout(fallback);
    };
  });

  // After keyboard-triggered upgrade, move focus into the plot so Tab order
  // does not jump to <body> when the load button unmounts (#1362).
  $effect(() => {
    if (!liveReady || host === null || !restoreKeyboardFocus) return;
    const root = host;
    const tryFocus = (): boolean => {
      if (!focusAfterUpgrade(root)) return false;
      restoreKeyboardFocus = false;
      return true;
    };
    if (tryFocus()) return;
    const mo = new MutationObserver(() => {
      if (tryFocus()) mo.disconnect();
    });
    mo.observe(root, { childList: true, subtree: true, attributes: true });
    const stop = window.setTimeout(() => {
      mo.disconnect();
      restoreKeyboardFocus = false;
    }, 30_000);
    return () => {
      mo.disconnect();
      window.clearTimeout(stop);
    };
  });
</script>

<div
  class="grammar-output"
  class:live-ready={liveReady}
  bind:this={host}
  onfocusin={onShellFocusIn}
  onfocusout={onShellFocusOut}
>
  {#if shellVisible}
    <div
      class="grammar-static-wrap"
      class:under-live={liveReady}
      class:fade-out={liveReady}
      ontransitionend={onStaticTransitionEnd}
    >
      <!--
        theme.js sets data-theme before paint. Mirror contrastChartTheme():
        fivethirtyeight on the light site, light chart on dark — no theme flash.
      -->
      <div class="grammar-static grammar-static--light-site">
        {@html staticSvgLightSite}
      </div>
      <div class="grammar-static grammar-static--dark-site">
        {@html staticSvgDarkSite}
      </div>
    </div>
  {/if}
  {#if !liveReady}
    <!-- Stay mounted and focusable while the import resolves (no disabled blur). -->
    <button
      type="button"
      class="load-interactive"
      onclick={ensureLive}
      disabled={!mounted}
      aria-disabled={!mounted || loadStarted}
      aria-busy={loadStarted}
    >
      {loadStarted ? "Loading…" : "Load interactive chart"}
    </button>
  {/if}
  {#if Plot !== null}
    <div class="grammar-live" class:revealed={liveReady}>
      <Plot />
    </div>
  {/if}
</div>

<style>
  .grammar-output {
    position: relative;
    min-width: 0;
    /*
     * Cap at the static shell width (DOCS_STATIC_PLOT_WIDTH_PX) and center.
     * The live plot is container-responsive, so an uncapped shell stretched
     * to the full code-path column on hover intent — far too wide vs its
     * 400px height. Keep the literal: importing the constant would pull the
     * headless renderer into the home client bundle.
     */
    max-width: 832px;
    margin-inline: auto;
  }

  .grammar-output :global(svg) {
    display: block;
    max-width: 100%;
    height: auto;
  }

  .grammar-static-wrap {
    transition: opacity var(--duration-popover) var(--ease-out);
  }

  .grammar-static-wrap.under-live {
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
  }

  .grammar-static-wrap.fade-out {
    opacity: 0;
    pointer-events: none;
  }

  .grammar-static--dark-site {
    display: none;
  }

  :global(:root[data-theme="dark"]) .grammar-static--light-site {
    display: none;
  }

  :global(:root[data-theme="dark"]) .grammar-static--dark-site {
    display: block;
  }

  .grammar-live:not(.revealed) {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
    z-index: 0;
  }

  .grammar-live.revealed {
    position: relative;
    opacity: 1;
  }

  .load-interactive {
    position: absolute;
    right: 0.75rem;
    bottom: 0.75rem;
    z-index: 2;
    margin: 0;
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--line, #ccc);
    border-radius: 0.35rem;
    background: color-mix(in srgb, var(--paper, #fff) 92%, transparent);
    color: var(--ink, #111);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    transition: transform var(--duration-press) var(--ease-out);
  }

  .load-interactive:active:not([aria-disabled="true"]) {
    transform: scale(0.97);
  }

  .load-interactive:focus-visible {
    outline: 2px solid var(--ink, #111);
    outline-offset: 2px;
  }
</style>
