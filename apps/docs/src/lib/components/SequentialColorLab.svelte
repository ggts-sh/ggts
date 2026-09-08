<script lang="ts">
  import type { ColorScaleSpec } from "@ggts-sh/spec";

  import CopyCode from "$lib/components/CopyCode.svelte";
  import SequentialDeferredPlot from "$lib/components/SequentialDeferredPlot.svelte";
  import { SEQUENTIAL_RASTER_SNIPPET } from "$lib/theme-specimens/snippets";

  const {
    examples,
  }: {
    examples: readonly {
      label: string;
      scale: ColorScaleSpec;
      staticSrc: string;
    }[];
  } = $props();
</script>

<section class="sequential-lab" aria-label="Sequential color scales">
  <header class="section-heading">
    <div>
      <p class="eyebrow">Behavior</p>
      <h2>Read on the colorbar</h2>
    </div>
  </header>

  <p class="lede">
    Continuous fill on a Macdonell man-count grid. Reverse, custom range, and
    pinned domain should read clearly on the colorbar — not only on a few cells.
  </p>

  <ol class="examples" aria-label="Sequential scale examples">
    {#each examples as example (example.label)}
      <li>
        <article>
          <header>
            <h3>{example.label}</h3>
          </header>
          <SequentialDeferredPlot
            label={example.label}
            scale={example.scale}
            staticSrc={example.staticSrc}
          />
        </article>
      </li>
    {/each}
  </ol>

  <div class="section-code">
    <p class="fragment-label">Authoring fragment</p>
    <CopyCode
      code={SEQUENTIAL_RASTER_SNIPPET}
      language="svelte"
      accessibleLabel="Copy sequential raster authoring fragment"
    />
  </div>
</section>

<style>
  .sequential-lab {
    padding-block: clamp(2.5rem, 6vw, 4.5rem);
    border-top: 1px solid var(--line);
  }

  .eyebrow {
    margin: 0;
    color: var(--muted);
    font-size: 0.7rem;
    font-weight: 650;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .section-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 1rem 2rem;
    min-width: 0;
    margin-bottom: 0.75rem;
  }

  h2 {
    margin: 0.2rem 0 0;
    font-size: clamp(1.75rem, 3.5vw, 2.5rem);
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .lede {
    margin: 0 0 1.5rem;
    max-width: 40rem;
    color: var(--muted);
    font-size: 0.95rem;
    line-height: 1.45;
  }

  .examples {
    display: grid;
    grid-template-columns: 1fr;
    gap: clamp(2.5rem, 5vw, 4rem);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  article {
    display: grid;
    gap: 0.65rem;
    min-width: 0;
  }

  h3 {
    margin: 0;
    font-size: 1.25rem;
    letter-spacing: -0.01em;
  }

  .section-code {
    width: min(100%, 52rem);
    margin-top: clamp(2rem, 4vw, 3rem);
  }

  .fragment-label {
    margin: 0 0 0.5rem;
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
