<script lang="ts">
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import type { CATEGORICAL_SCHEME_NAMES, ThemeName } from "@ggts-sh/spec";

  import { paletteSpecimenChart } from "$lib/theme-specimens/palette-bars";

  type CategoricalSchemeName = (typeof CATEGORICAL_SCHEME_NAMES)[number];

  const {
    name,
    label,
    capacity,
    reverse,
    paperTheme,
    staticSrc,
  }: {
    name: CategoricalSchemeName;
    label: string;
    capacity: number;
    reverse: boolean;
    paperTheme: ThemeName;
    /** Shell path for reverse=false + light paper; only used pre-hydration. */
    staticSrc: string;
  } = $props();

  const chart = $derived(paletteSpecimenChart(capacity));
  const plotHeight = $derived(chart.height);
  /** Shell matches only the prerender defaults; other combos wait for live. */
  const shellMatches = $derived(
    !reverse && paperTheme === "light" && staticSrc !== "",
  );

  let Live = $state<
    typeof import("./PaletteSpecimenLive.svelte").default | null
  >(null);

  onMount(() => {
    let cancelled = false;
    // Eager hydration: the preview is the page's single chart anchor, so the
    // load-on-intent gate (built for ~50 specimens on one page) does not apply.
    void import("./PaletteSpecimenLive.svelte").then((mod) => {
      if (!cancelled) Live = mod.default;
    });
    return () => {
      cancelled = true;
    };
  });
</script>

<section class="preview" aria-label="Palette preview">
  <header>
    <h2>{label}</h2>
    <span class="capacity">{capacity} colors</span>
  </header>

  <div class="plot-panel" style:min-height="{plotHeight}px">
    {#if Live !== null}
      <Live
        {name}
        {label}
        {capacity}
        {reverse}
        {paperTheme}
        height={plotHeight}
      />
    {:else if shellMatches}
      <img
        class="static-shell"
        src={`${base}${staticSrc}`}
        alt=""
        width="832"
        height={plotHeight}
        decoding="async"
      />
    {:else}
      <div class="plot-shell" style:height={`${String(plotHeight)}px`}></div>
    {/if}
  </div>
</section>

<style>
  .preview {
    display: grid;
    gap: 0.5rem;
    min-width: 0;
  }

  h2 {
    display: inline;
    margin: 0;
    font-size: 1.05rem;
    letter-spacing: -0.01em;
  }

  .capacity {
    margin-left: 0.5rem;
    color: var(--muted);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }

  .plot-panel {
    width: min(100%, 52rem);
    min-width: 0;
  }

  .plot-panel :global(svg),
  .static-shell {
    display: block;
    max-width: 100%;
    height: auto;
  }

  .plot-shell {
    width: 100%;
    background: var(--wash);
    border: 1px solid var(--line);
  }
</style>
