<script lang="ts">
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import type { ThemeName } from "@ggts-sh/spec";

  import { observeUserIntent } from "$lib/load-on-intent";
  import {
    isMarksOnlyTheme,
    marksOnlyDarkSiteShellPath,
  } from "$lib/marks-only-theme-contrast";
  import type {
    SchemeName,
    ThemeSpecimenKind,
  } from "$lib/theme-specimens/catalog";

  const {
    name,
    label,
    caption,
    kind,
    scheme,
    legendFocus,
    staticSrc,
  }: {
    name: ThemeName;
    label: string;
    caption: string;
    kind: ThemeSpecimenKind;
    scheme: SchemeName;
    legendFocus: boolean;
    /** Path under /theme-shells/ (no inlined SVG in HTML). */
    staticSrc: string;
  } = $props();

  const plotHeight = 380;
  /** Transparent-paper themes need a dark-site static shell before hydrate. */
  const darkSiteStaticSrc = $derived(
    isMarksOnlyTheme(name) ? marksOnlyDarkSiteShellPath(name) : null,
  );

  let host = $state<HTMLDivElement | null>(null);
  let Live = $state<typeof import("./ThemeSpecimenLive.svelte").default | null>(
    null,
  );

  onMount(() => {
    const el = host;
    if (el === null) return;
    let cancelled = false;

    const stop = observeUserIntent(el, () => {
      if (cancelled || Live !== null) return;
      void import("./ThemeSpecimenLive.svelte").then((mod) => {
        if (!cancelled) Live = mod.default;
      });
    });
    return () => {
      cancelled = true;
      stop();
    };
  });
</script>

<article class="specimen">
  <header>
    <h3>{label}</h3>
    <p class="caption">{caption}</p>
  </header>

  <div class="plot-panel" bind:this={host} style:min-height="{plotHeight}px">
    {#if Live !== null}
      <Live {name} {label} {kind} {scheme} {legendFocus} height={plotHeight} />
    {:else if darkSiteStaticSrc !== null}
      <!--
        theme.js sets data-theme before paint. Dual shells so marks-only
        themes stay high-contrast on the dark docs shell before hydrate.
      -->
      <img
        class="static-shell static-shell--light-site"
        src={`${base}${staticSrc}`}
        alt=""
        width="832"
        height={plotHeight}
        decoding="async"
        loading="lazy"
      />
      <img
        class="static-shell static-shell--dark-site"
        src={`${base}${darkSiteStaticSrc}`}
        alt=""
        width="832"
        height={plotHeight}
        decoding="async"
        loading="lazy"
      />
    {:else}
      <img
        class="static-shell"
        src={`${base}${staticSrc}`}
        alt=""
        width="832"
        height={plotHeight}
        decoding="async"
        loading="lazy"
      />
    {/if}
  </div>
</article>

<style>
  .specimen {
    display: grid;
    gap: 0.65rem;
    min-width: 0;
  }

  header {
    min-width: 0;
  }

  h3 {
    margin: 0;
    font-size: 1.25rem;
    letter-spacing: -0.01em;
  }

  .caption {
    margin: 0.25rem 0 0;
    max-width: 40rem;
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.4;
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

  .static-shell--dark-site {
    display: none;
  }

  :global(:root[data-theme="dark"]) .static-shell--light-site {
    display: none;
  }

  :global(:root[data-theme="dark"]) .static-shell--dark-site {
    display: block;
  }
</style>
