<script lang="ts">
  import { base } from "$app/paths";
  import type { ThemeName } from "@ggts-sh/spec";
  import { onMount } from "svelte";

  import { CATEGORICAL_PALETTES, THEME_OPTIONS } from "$lib/catalog/themes";
  import { observeUserIntent } from "$lib/load-on-intent";

  type SchemeName = (typeof CATEGORICAL_PALETTES)[number]["name"];

  const {
    initialStaticSrc,
  }: {
    /** Path to default-theme shell under /theme-shells/. */
    initialStaticSrc: string;
  } = $props();

  let theme = $state<ThemeName>("default");
  let scheme = $state<SchemeName>("observable10");
  let host = $state<HTMLElement | null>(null);
  let LiveTemps = $state<
    typeof import("./TemperaturesSpecimen.svelte").default | null
  >(null);
  let loadStarted = false;

  function ensureLive(): void {
    if (loadStarted || LiveTemps !== null) return;
    loadStarted = true;
    void import("./TemperaturesSpecimen.svelte").then((mod) => {
      LiveTemps = mod.default;
    });
  }

  onMount(() => {
    const el = host;
    if (el === null) return;
    // Static shell until the user engages the lab (hover/focus/change).
    // Immediate onMount import blocked SPA nav off /themes for seconds.
    return observeUserIntent(el, ensureLive);
  });
</script>

<section
  class="theme-lab"
  aria-label="Chart theme and palette lab"
  bind:this={host}
>
  <div class="plot-panel">
    {#if LiveTemps !== null}
      <LiveTemps
        {theme}
        {scheme}
        height={400}
        legendFocus={true}
        ariaLabel={`${theme} theme with ${scheme} palette`}
      />
    {:else}
      <img
        class="static-shell"
        src={`${base}${initialStaticSrc}`}
        alt=""
        width="832"
        height="400"
        decoding="async"
        fetchpriority="high"
      />
    {/if}
  </div>

  <div class="controls">
    <div class="select-control">
      <label for="chart-theme">Chart theme</label>
      <select
        id="chart-theme"
        bind:value={theme}
        onfocus={() => {
          ensureLive();
        }}
      >
        {#each THEME_OPTIONS as option (option.name)}
          <option value={option.name}>{option.label}</option>
        {/each}
      </select>
    </div>
    <div class="select-control">
      <label for="chart-palette">Categorical palette</label>
      <select
        id="chart-palette"
        bind:value={scheme}
        onfocus={() => {
          ensureLive();
        }}
      >
        {#each CATEGORICAL_PALETTES as palette (palette.name)}
          <option value={palette.name}>{palette.label}</option>
        {/each}
      </select>
    </div>
  </div>
</section>

<style>
  .theme-lab {
    display: grid;
    gap: 0.85rem;
    min-width: 0;
    padding-block: clamp(1.5rem, 4vw, 2.5rem) clamp(2.5rem, 6vw, 4rem);
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

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem 1.25rem;
    align-items: end;
    width: min(100%, 52rem);
  }

  .select-control {
    display: grid;
    gap: 0.4rem;
    min-width: min(100%, 12rem);
    font-size: 0.82rem;
    font-weight: 650;
  }

  select {
    width: 100%;
    min-height: 44px;
    padding: 0.6rem 2.5rem 0.6rem 0.75rem;
    border: 1px solid var(--line-strong, var(--line));
    border-radius: 2px;
    background: var(--paper);
    color: var(--ink);
    font: inherit;
  }
</style>
