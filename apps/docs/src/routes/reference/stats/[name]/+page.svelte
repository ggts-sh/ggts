<script lang="ts">
  import { base } from "$app/paths";

  import { componentNameForGeom } from "$lib/component-name-for-geom";
  import ReferenceLede from "$lib/components/ReferenceLede.svelte";
  import { plotAesLiteral } from "$lib/reference-snippets";

  import type { PageProps } from "./$types";

  const { data }: PageProps = $props();
  const entry = $derived(data.entry);

  const primaryGeom = $derived(
    entry.defaultForGeoms[0] ?? entry.compatibleGeoms[0],
  );
  const primaryComponent = $derived(
    primaryGeom === undefined ? "GeomBar" : componentNameForGeom(primaryGeom),
  );
  const geomName = $derived(primaryGeom ?? "bar");
  const plotAes = $derived(plotAesLiteral(geomName, entry.name));
  const plotOpen = $derived(
    plotAes === "" ? "<GGPlot data={rows}>" : `<GGPlot data={rows} ${plotAes}>`,
  );

  const svelteSnippet = $derived(
    `import { GGPlot, ${primaryComponent} } from "@ggts-sh/svelte";\n\n${plotOpen}\n  <${primaryComponent} stat="${entry.name}" />\n</GGPlot>`,
  );
  const jsonSnippet = $derived(
    `{\n  "geom": "${geomName}",\n  "stat": "${entry.name}"\n}`,
  );
</script>

<article class="stat-detail prose" aria-labelledby="stat-heading">
  <h1 id="stat-heading"><code>stat: "{entry.name}"</code></h1>
  <ReferenceLede text={entry.summary} />

  <h2 id="usage">Usage</h2>
  <pre class="snippet"><code>{svelteSnippet}</code></pre>
  <pre class="snippet"><code>{jsonSnippet}</code></pre>

  <h2 id="generated-columns">Generated columns (after_stat)</h2>
  {#if entry.generatedColumns.length === 0}
    <p>
      This stat does not publish named after_stat columns in
      <code>STAT_COLUMNS</code>. It may still rewrite positions or filter rows;
      map aesthetics to data fields as usual.
    </p>
  {:else}
    <p>
      Resolve these with channel objects such as
      <code>{`{ stat: "${entry.generatedColumns[0]}" }`}</code> in
      <code>aes</code>.
    </p>
    <ul class="token-list">
      {#each entry.generatedColumns as col (col)}
        <li><code>{col}</code></li>
      {/each}
    </ul>
  {/if}

  <h2 id="default-for">Default for geoms</h2>
  {#if entry.defaultForGeoms.length === 0}
    <p>No geom uses this as its default stat. Set it explicitly when needed.</p>
  {:else}
    <ul class="token-list">
      {#each entry.defaultForGeoms as geom (geom)}
        <li>
          <a href={`${base}/reference/geoms/${geom}`}
            ><code>{componentNameForGeom(geom)}</code></a
          >
        </li>
      {/each}
    </ul>
  {/if}

  <h2 id="compatible-geoms">Compatible geoms</h2>
  <ul class="token-list">
    {#each entry.compatibleGeoms as geom (geom)}
      <li>
        <a href={`${base}/reference/geoms/${geom}`}
          ><code>{componentNameForGeom(geom)}</code></a
        >
        {#if entry.defaultForGeoms.includes(geom)}
          <span class="badge">default</span>
        {/if}
      </li>
    {/each}
  </ul>

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
    <a href={`${base}/reference/stats`}>← All stats</a>
    ·
    <a href={`${base}/reference/geoms`}>Geoms</a>
    ·
    <a href={`${base}/guide/statistics-positions`}>Statistics and positions</a>
  </p>
</article>

<style>
  .stat-detail {
    max-width: 52rem;
    margin: 2rem 0 4rem;
  }

  h1 {
    margin: 0 0 0.5rem;
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

  .snippet + .snippet {
    margin-top: 0.75rem;
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
