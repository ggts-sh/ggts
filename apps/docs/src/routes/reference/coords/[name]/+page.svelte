<script lang="ts">
  import { base } from "$app/paths";

  import ReferenceLede from "$lib/components/ReferenceLede.svelte";

  import type { PageProps } from "./$types";

  const { data }: PageProps = $props();
  const entry = $derived(data.entry);

  const svelteSnippet = $derived.by(() => {
    const imports = ["GGPlot", "GeomPoint", entry.component];
    let shell = `<${entry.component} />`;
    if (entry.name === "fixed" || entry.name === "sf") {
      shell = `<${entry.component} ratio={1} />`;
    } else if (entry.name === "transform") {
      shell = `<${entry.component} x="log10" y={{ transform: "sqrt" }} />`;
    }
    return `import { ${imports.join(", ")} } from "@ggts-sh/svelte";\n\n<GGPlot data={rows} aes={{ x: "x", y: "y" }}>\n  <GeomPoint />\n  ${shell}\n</GGPlot>`;
  });

  const helperSnippet = $derived.by(() => {
    if (entry.helper === "") {
      if (entry.name === "flip") {
        return `// Builder\nimport { gg } from "@ggts-sh/spec";\n\ngg(rows, aes({ x: "category", y: "value" }))\n  .geomCol()\n  .coordFlip()\n  .build();\n// → { …, coord: { type: "flip" } }`;
      }
      return `// Default when coord is omitted. Explicit clear under REPLACE:\n// <CoordCartesian /> → { type: "cartesian" } (normalize() drops bare cartesian)`;
    }
    if (entry.name === "transform") {
      return `import { ${entry.helper} } from "@ggts-sh/spec";\n\n${entry.helper}({ x: "log10", y: { transform: "sqrt", reverse: true }, clip: true })\n// → { type: "transform", x: { transform: "log10" }, y: { transform: "sqrt", reverse: true } }`;
    }
    if (entry.name === "fixed" || entry.name === "sf") {
      return `import { ${entry.helper} } from "@ggts-sh/spec";\n\n${entry.helper}({ ratio: 1 })\n// → { type: "${entry.typeLiteral}" }  // ratio 1 is the default and normalize() may drop it`;
    }
    return `import { ${entry.helper} } from "@ggts-sh/spec";\n\n${entry.helper}()`;
  });

  const jsonSnippet = $derived.by(() => {
    if (entry.name === "cartesian") {
      return `// Omit coord for the default. Explicit object (dropped by normalize when bare):\n{\n  "coord": { "type": "cartesian" }\n}`;
    }
    if (entry.name === "flip") {
      return `{\n  "coord": { "type": "flip" }\n}`;
    }
    if (entry.name === "transform") {
      return `{\n  "coord": {\n    "type": "transform",\n    "x": { "transform": "log10" },\n    "y": { "transform": "sqrt", "reverse": true },\n    "clip": true\n  }\n}`;
    }
    if (entry.name === "fixed") {
      return `{\n  "coord": { "type": "fixed", "ratio": 2 }\n}`;
    }
    return `{\n  "coord": { "type": "sf", "ratio": 1 }\n}`;
  });
</script>

<article class="coord-detail prose" aria-labelledby="coord-heading">
  <h1 id="coord-heading"><code>{entry.component}</code></h1>
  <ReferenceLede text={entry.summary} />

  <h2 id="svelte">Svelte component</h2>
  <pre class="snippet"><code>{svelteSnippet}</code></pre>
  <p class="meta-note">
    Declaration-only: emits no markup. Registers a live coord layer on init;
    inert without a <code>&lt;GGPlot&gt;</code> ancestor. Coords are REPLACE — the
    last registered coord wins.
  </p>

  <h2 id="json">JSON and helpers</h2>
  <pre class="snippet"><code>{helperSnippet}</code></pre>
  <pre class="snippet"><code>{jsonSnippet}</code></pre>
  <p class="meta-note">
    {#if entry.helper}
      Helper: <code>{entry.helper}</code>
      {#if entry.helperAlias}
        (alias <code>{entry.helperAlias}</code>)
      {/if}
      {#if entry.alsoHelpers.length > 0}
        · also
        {#each entry.alsoHelpers as h, i (h)}
          <code>{h}</code>{i < entry.alsoHelpers.length - 1 ? ", " : ""}
        {/each}
      {/if}.
    {:else if entry.name === "flip"}
      No free-standing helper — use <code>&lt;CoordFlip /&gt;</code>,
      <code>builder.coordFlip()</code>, or <code>builder.coord("flip")</code>.
    {:else}
      No free-standing helper — omit coord, or use
      <code>&lt;CoordCartesian /&gt;</code> to clear under REPLACE.
    {/if}
    Schema type: <code>{entry.schemaType}</code>. Portable
    <code>type</code>: <code>"{entry.typeLiteral}"</code>. Builder: {#each entry.builderMethods as m, i (m)}
      <code>.{m}()</code>{i < entry.builderMethods.length - 1 ? ", " : ""}
    {/each}.
  </p>

  <h2 id="props">Props</h2>
  {#if entry.params.length === 0}
    <p>
      <code>{entry.component}</code> has no option props — only the fixed
      portable <code>type: "{entry.typeLiteral}"</code>.
    </p>
  {:else}
    <p>
      Options map 1:1 to the portable <code>coord</code> object (excluding the
      <code>type</code> discriminant). On
      <code>CoordTransform</code>, <code>x</code> and <code>y</code> also accept a
      bare transform name string via the helper/shell sugar.
    </p>
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

  {#if entry.axisParams.length > 0}
    <h2 id="axis-options">Axis options</h2>
    <p>
      Shared fields for <code>x</code> and <code>y</code> under
      <code>type: "transform"</code>. Coordinate limits are a viewport in
      semantic units — they never drop rows or re-run statistics. Non-identity
      transforms require continuous, non-temporal position scales on that axis.
      <code>coord_transform</code> cannot compose with
      <code>coord_flip</code> in one PortableSpec yet.
    </p>
    <dl class="param-list">
      {#each entry.axisParams as param (param.name)}
        <div>
          <dt id={`axis-${param.name}`}>
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

  {#if entry.alsoExportedAs.length > 0}
    <h2 id="aliases">Also exported as</h2>
    <ul class="token-list">
      {#each entry.alsoExportedAs as alias (alias)}
        <li><code>{alias}</code></li>
      {/each}
    </ul>
    <p>
      Binding-identical re-export of <code>{entry.component}</code> (equal-unit spelling
      of fixed aspect).
    </p>
  {/if}

  <h2 id="related">Related</h2>
  <ul class="token-list">
    <li>
      <a href={`${base}/guide/facets-coordinates`}>Facets and coordinates</a>
    </li>
    {#if entry.name === "sf"}
      <li>
        <a href={`${base}/reference/geoms/sf`}><code>GeomSf</code></a>
      </li>
    {/if}
    {#if entry.name === "transform"}
      <li>
        <a href={`${base}/guide/scales-guides`}>Scales and guides</a>
        — pre-stat scale transforms
      </li>
    {/if}
    {#if entry.name === "fixed" || entry.name === "sf"}
      <li>
        Free positional facet scales fail with
        <a href={`${base}/guide/errors#coord-fixed-free-scales`}
          ><code>coord-fixed-free-scales</code></a
        >
      </li>
    {/if}
  </ul>

  <p class="back">
    <a href={`${base}/reference/coords`}>← All coords</a>
    ·
    <a href={`${base}/reference/scales`}>Scales</a>
    ·
    <a href={`${base}/guide/facets-coordinates`}>Facets and coordinates</a>
  </p>
</article>

<style>
  .coord-detail {
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

  .meta-note {
    margin-top: 0.75rem;
    color: var(--muted);
    font-size: 0.9rem;
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
    padding: 0.05rem 0.35rem;
    border-radius: 0.25rem;
    background: var(--line);
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .token-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    list-style: none;
    margin: 0.75rem 0 0;
    padding: 0;
  }

  .back {
    margin-top: 2.5rem;
    color: var(--muted);
  }
</style>
