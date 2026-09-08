<script lang="ts">
  import { base } from "$app/paths";

  import { scaleSwatchFor } from "$lib/catalog/scale-swatches";
  import ReferenceLede from "$lib/components/ReferenceLede.svelte";
  import ScaleColorSwatch from "$lib/components/ScaleColorSwatch.svelte";

  import type { PageProps } from "./$types";

  const { data }: PageProps = $props();
  const entry = $derived(data.entry);
  const aliasTarget = $derived(data.aliasTarget);
  const swatch = $derived(scaleSwatchFor(entry));

  const aes = $derived(entry.aesthetics[0] ?? "x");
  const plotAes = $derived.by(() => {
    if (aes === "x" || aes === "y") {
      return 'aes={{ x: "x", y: "y" }}';
    }
    if (aes === "color" || aes === "fill") {
      return `aes={{ x: "x", y: "y", ${aes}: "group" }}`;
    }
    if (aes === "size" || aes === "linewidth" || aes === "alpha") {
      return `aes={{ x: "x", y: "y", ${aes}: "weight" }}`;
    }
    return `aes={{ x: "x", y: "y", ${aes}: "group" }}`;
  });
  const geom = $derived(
    aes === "linewidth" || aes === "linetype"
      ? "GeomLine"
      : aes === "fill"
        ? "GeomCol"
        : "GeomPoint",
  );

  const svelteSnippet = $derived(
    `import { GGPlot, ${geom}, ${entry.component} } from "@ggts-sh/svelte";\n\n<GGPlot data={rows} ${plotAes}>
  <${geom} />
  <${entry.component} />
</GGPlot>`,
  );

  const jsonSnippet = $derived.by(() => {
    const body: Record<string, unknown> = { type: entry.scaleType };
    if (entry.transform !== undefined) body.transform = entry.transform;
    if (entry.temporalKind !== undefined)
      body.temporalKind = entry.temporalKind;
    return `{\n  "scales": {\n    "${aes}": ${JSON.stringify(body, null, 2).split("\n").join("\n    ")}\n  }\n}`;
  });
</script>

<article class="scale-detail prose" aria-labelledby="scale-heading">
  <h1 id="scale-heading"><code>{entry.component}</code></h1>
  <ReferenceLede text={entry.summary} />

  {#if swatch !== null}
    <ScaleColorSwatch {swatch} />
  {/if}

  <h2 id="defaults">Defaults</h2>
  <dl class="defaults">
    <div>
      <dt>helper</dt>
      <dd><code>{entry.helper}</code></dd>
    </div>
    <div>
      <dt>family</dt>
      <dd><code>{entry.family}</code></dd>
    </div>
    <div>
      <dt>aesthetic</dt>
      <dd><code>{entry.aesthetics.join(", ")}</code></dd>
    </div>
    <div>
      <dt>scale type</dt>
      <dd><code>{entry.scaleType}</code></dd>
    </div>
    {#if entry.transform !== undefined}
      <div>
        <dt>transform</dt>
        <dd><code>{entry.transform}</code></dd>
      </div>
    {/if}
    {#if entry.temporalKind !== undefined}
      <div>
        <dt>temporalKind</dt>
        <dd><code>{entry.temporalKind}</code></dd>
      </div>
    {/if}
    <div>
      <dt>options type</dt>
      <dd><code>{entry.optionsType}</code></dd>
    </div>
  </dl>

  {#if entry.aliasOf !== undefined && aliasTarget !== undefined}
    <h2 id="alias">Alias</h2>
    <p>
      This component re-exports
      <a href={`${base}/reference/scales/${entry.aliasOf}`}
        ><code>{aliasTarget.component}</code></a
      >
      (same binding). Prefer the canonical spelling in new code.
    </p>
  {/if}

  {#if entry.alsoExportedAs.length > 0}
    <h2 id="aliases">Also exported as</h2>
    <ul class="token-list">
      {#each entry.alsoExportedAs as name (name)}
        <li><code>{name}</code></li>
      {/each}
    </ul>
  {/if}

  <h2 id="svelte">Svelte component</h2>
  <pre class="snippet"><code>{svelteSnippet}</code></pre>

  <h2 id="json">JSON scales</h2>
  <pre class="snippet"><code>{jsonSnippet}</code></pre>

  <h2 id="params">Params</h2>
  {#if entry.params.length === 0}
    <p>This scale has no authoring params beyond its fixed type/transform.</p>
  {:else}
    <dl class="param-list">
      {#each entry.params as param (param.name)}
        <div>
          <dt id={`param-${param.name}`}>
            <code>{param.name}</code>
            {#if param.required}
              <span class="badge">required</span>
            {/if}
          </dt>
          <dd>
            <p class="type"><code>{param.typeSummary}</code></p>
            <p>{param.description}</p>
          </dd>
        </div>
      {/each}
    </dl>
  {/if}

  <h2 id="guide">Guide interaction</h2>
  <p>{entry.guide}</p>

  {#if data.examples.length > 0}
    <h2 id="examples">Examples</h2>
    <ul class="example-list">
      {#each data.examples as example (example.id)}
        <li>
          <a href={`${base}${example.href}`}>{example.title}</a>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="back">
    <a href={`${base}/reference/scales`}>← All scales</a>
    ·
    <a href={`${base}/palettes`}>Palettes</a>
    ·
    <a href={`${base}/guide/scales-guides`}>Scales and guides</a>
  </p>
</article>

<style>
  .scale-detail {
    max-width: 52rem;
    margin: 2rem 0 4rem;
  }

  h1 {
    margin: 0 0 0.5rem;
  }

  .defaults {
    margin: 1rem 0 0;
  }

  .defaults > div {
    display: grid;
    grid-template-columns: minmax(8rem, 0.28fr) minmax(0, 1fr);
    gap: 1rem;
    padding: 0.55rem 0;
    border-top: 1px solid var(--line);
  }

  .defaults > div:last-child {
    border-bottom: 1px solid var(--line);
  }

  .defaults dt {
    font-weight: 600;
  }

  .defaults dd {
    margin: 0;
  }

  .snippet {
    overflow-x: auto;
    padding: 1rem 1.1rem;
    border-radius: 0.5rem;
    background: var(--code-bg, #1a1b26);
    color: var(--code-fg, #c0caf5);
    font-size: 0.88rem;
    line-height: 1.45;
  }

  .param-list {
    margin: 1rem 0 0;
  }

  .param-list > div {
    display: grid;
    grid-template-columns: minmax(8rem, 0.28fr) minmax(0, 1fr);
    gap: 1rem;
    padding: 0.85rem 0;
    border-top: 1px solid var(--line);
  }

  .param-list > div:last-child {
    border-bottom: 1px solid var(--line);
  }

  .param-list dt {
    font-weight: 600;
  }

  .param-list dd {
    margin: 0;
  }

  .param-list .type {
    margin: 0 0 0.35rem;
    color: var(--muted);
    font-size: 0.88rem;
  }

  .param-list p {
    margin: 0;
  }

  .badge {
    display: inline-block;
    margin-left: 0.35rem;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ink) 8%, transparent);
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    vertical-align: middle;
  }

  .token-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
  }

  .example-list {
    margin: 0.75rem 0 0;
    padding-left: 1.2rem;
  }

  .back {
    margin-top: 2.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
    color: var(--muted);
  }
</style>
