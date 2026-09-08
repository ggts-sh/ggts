<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import { untrack } from "svelte";
  import type { CATEGORICAL_SCHEME_NAMES, ThemeName } from "@ggts-sh/spec";

  import PaletteIndex from "$lib/components/PaletteIndex.svelte";
  import PalettePreview from "$lib/components/PalettePreview.svelte";
  import {
    resolveInitialScheme,
    sortPaletteSpecimens,
    type PaletteSort,
  } from "$lib/catalog/palette-chooser";

  import type { PageProps } from "./$types";

  type CategoricalSchemeName = (typeof CATEGORICAL_SCHEME_NAMES)[number];

  const { data }: PageProps = $props();

  let paperTheme = $state<ThemeName>("light");
  let reversed = $state(false);
  let sort = $state<PaletteSort>("name");

  const sortedSpecimens = $derived(
    sortPaletteSpecimens(data.paletteSpecimens, sort),
  );

  // Pinned to the registry default on first paint; the ?scheme= deep link
  // resolves client-side (the site is prerendered, so the query string is
  // not available to the server load). The effect re-runs on same-route
  // query changes — back/forward between ?scheme= variants must re-apply.
  let pinned = $state<CategoricalSchemeName>(
    untrack(() => data.paletteSpecimens[0]?.name ?? "observable10"),
  );
  let hovered = $state<CategoricalSchemeName | null>(null);

  const previewName = $derived(hovered ?? pinned);
  const previewSpecimen = $derived(
    data.paletteSpecimens.find((s) => s.name === previewName) ??
      data.paletteSpecimens[0],
  );

  let lastAppliedScheme = $state<string | null>(null);
  $effect(() => {
    const requested = page.url.searchParams.get("scheme");
    if (requested === untrack(() => lastAppliedScheme)) return;
    lastAppliedScheme = requested;
    const initial = resolveInitialScheme(requested, data.paletteSpecimens);
    if (initial === null) return;
    pinned = initial;
    const target = document.querySelector(`#scheme-${initial}`);
    if (target === null) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      block: "center",
      behavior: reduced ? "auto" : "smooth",
    });
  });
</script>

<main class="palettes-page">
  <header class="palettes-intro">
    <p class="eyebrow">Palettes</p>
    <h1>Color palettes</h1>
    <p>
      Categorical schemes color discrete series. Sequential ramps encode
      continuous fill. Chart themes style paper and chrome separately — see
      <a href={`${base}/themes`}>Themes</a>. Sequential ramps live on
      <a href={`${base}/palettes/ramps`}>Sequential color ramps</a>.
    </p>
    <p class="guide-link">
      Scheme names as scale inputs:
      <a href={`${base}/reference/palettes`}>Palettes reference</a>. How to set
      a palette on a plot:
      <a href={`${base}/reference/scales`}>Scale reference</a>
      (e.g.
      <a href={`${base}/reference/scales/color_discrete`}>ScaleColorDiscrete</a
      >,
      <a href={`${base}/reference/scales/color_continuous`}
        >ScaleColorContinuous</a
      >). Narrative guide:
      <a href={`${base}/guide/scales-guides`}>Scales and guides</a>.
    </p>
  </header>

  <section class="chooser" aria-label="Categorical palettes">
    <div class="rail">
      <fieldset class="picker">
        <legend class="eyebrow">Preview settings</legend>
        <label class="field">
          Chart paper
          <select bind:value={paperTheme}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={reversed} />
          Reverse
        </label>
        <label class="field">
          Sort
          <select bind:value={sort}>
            <option value="name">Name</option>
            <option value="capacity">Color count</option>
          </select>
        </label>
      </fieldset>

      {#if previewSpecimen !== undefined}
        <PalettePreview
          name={previewSpecimen.name}
          label={previewSpecimen.label}
          capacity={previewSpecimen.capacity}
          reverse={reversed}
          {paperTheme}
          staticSrc={previewSpecimen.staticSrc}
        />

        <p class="visually-hidden" role="status">
          Previewing {previewSpecimen.label}, {previewSpecimen.capacity} colors
        </p>
      {/if}
    </div>

    <PaletteIndex
      specimens={sortedSpecimens}
      selected={pinned}
      reverse={reversed}
      onpreview={(name) => (hovered = name)}
      onselect={(name) => (pinned = name)}
    />

    <p class="footnote">
      CB-safe marks schemes whose source palette declares colorblind-safe
      colors. Unmarked palettes have not been audited yet.
    </p>
  </section>

  <nav class="learning-path" aria-label="Next steps">
    <p class="eyebrow">Next</p>
    <ul>
      <li>
        <a href={`${base}/palettes/ramps`}>Sequential color ramps</a>
        — every sequential scheme strip, plus scale behavior on a chart
      </li>
      <li>
        <a href={`${base}/reference/palettes`}>Palettes reference</a>
        — scheme → ScaleColor* / ScaleFill* mapping
      </li>
      <li>
        <a href={`${base}/themes`}>Themes</a>
        — paper, grids, axes, and type
      </li>
      <li>
        <a href={`${base}/reference/scales`}>Scale reference</a>
        — every Scale* component and how to set color on a plot
      </li>
      <li>
        <a href={`${base}/guide/scales-guides`}>Scales and guides</a>
        — position, color, and legend channels
      </li>
      <li>
        <a href={`${base}/examples/bar/dodged`}>Dodged bars</a>,
        <a href={`${base}/examples/line/multi-series`}>multi-series line</a>,
        <a href={`${base}/examples/area/stacked`}>stacked area</a>
        — gallery sources for categorical color
      </li>
    </ul>
  </nav>
</main>

<style>
  .palettes-page {
    min-width: 0;
    max-width: 100%;
    padding-bottom: clamp(3rem, 7vw, 6rem);
  }

  .palettes-intro {
    max-width: 42rem;
    padding: clamp(2rem, 5vw, 3.5rem) 0 1.5rem;
  }

  .palettes-intro h1 {
    margin: 0.25rem 0 0.75rem;
    font-size: clamp(2.25rem, 5vw, 3.5rem);
    line-height: 0.95;
    letter-spacing: -0.03em;
  }

  .palettes-intro > p:not(.eyebrow, .guide-link) {
    margin: 0;
    color: var(--muted);
    font-size: 1.02rem;
  }

  .palettes-intro a {
    color: var(--ink);
  }

  .guide-link {
    margin: 0.85rem 0 0;
    color: var(--muted);
    font-size: 0.92rem;
  }

  .guide-link a {
    color: var(--ink);
  }

  .eyebrow {
    margin: 0;
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 650;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .chooser {
    display: grid;
    gap: 1.5rem;
    min-width: 0;
  }

  .rail {
    display: grid;
    gap: 1rem;
    align-content: start;
    min-width: 0;
  }

  @media (min-width: 64rem) {
    .rail {
      position: sticky;
      top: 0;
      z-index: 2;
      padding-block: 0.75rem;
      background: var(--paper);
      border-bottom: 1px solid var(--line);
    }
  }

  .footnote {
    margin: 0;
    max-width: 52rem;
    color: var(--muted);
    font-size: 0.75rem;
  }

  .picker {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.25rem;
    align-items: flex-end;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .picker legend {
    padding: 0;
    margin-bottom: 0.25rem;
  }

  .field {
    display: grid;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .field select {
    font: inherit;
    color: var(--fg);
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 0;
    padding: 0.45rem 0.6rem;
    min-height: 44px;
  }

  .check {
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    min-height: 44px;
    font-size: 0.85rem;
    color: var(--muted);
    cursor: pointer;
  }

  .check input {
    width: 1.05rem;
    height: 1.05rem;
    accent-color: var(--accent);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  .learning-path {
    padding-block: clamp(2rem, 5vw, 3.5rem);
    border-top: 1px solid var(--line);
  }

  .learning-path ul {
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.55rem;
    max-width: 42rem;
    color: var(--muted);
    font-size: 0.95rem;
    line-height: 1.45;
  }

  .learning-path a {
    color: var(--ink);
  }
</style>
