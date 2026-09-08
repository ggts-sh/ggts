<script lang="ts">
  import { base } from "$app/paths";
  import { coordReferenceList, type CoordReferenceEntry } from "@ggts-sh/spec";

  let query = $state("");
  const all = coordReferenceList();
  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const results = $derived(
    normalizedQuery === ""
      ? all
      : all.filter((entry) => matchesCoord(entry, normalizedQuery)),
  );

  function matchesCoord(entry: CoordReferenceEntry, q: string): boolean {
    const haystack = [
      entry.name,
      entry.component,
      entry.helper,
      entry.helperAlias,
      entry.summary,
      ...entry.alsoHelpers,
      ...entry.alsoExportedAs,
      ...entry.builderMethods,
      ...entry.params.map((p) => p.name),
      ...entry.axisParams.map((p) => p.name),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(q);
  }
</script>

<main class="coord-reference" aria-labelledby="reference-heading">
  <h1 id="reference-heading">Coords</h1>
  <p class="intro">
    Plot coordinate systems. Compose declaration-only shells such as
    <code>CoordFlip</code> and <code>CoordFixed</code>, or portable helpers such
    as <code>coordTransform</code>. Coords are a REPLACE family (last
    registration wins). Narrative guide:
    <a href={`${base}/guide/facets-coordinates`}>Facets and coordinates</a>.
  </p>

  <label for="coord-search">Search</label>
  <input
    id="coord-search"
    type="search"
    bind:value={query}
    placeholder="flip, fixed, log10, ratio…"
    autocomplete="off"
  />

  <p class="count" aria-live="polite">
    {results.length}
    {results.length === 1 ? "coord" : "coords"}
  </p>

  <h2 id="all-coords">All coords</h2>
  {#if results.length === 0}
    <p class="empty">No match.</p>
  {:else}
    <ul class="results">
      {#each results as entry (entry.name)}
        <li>
          <a href={`${base}/reference/coords/${entry.slug}`}>
            <strong><code>{entry.component}</code></strong>
            <span class="meta">
              type <code>"{entry.typeLiteral}"</code>
              {#if entry.params.length > 0}
                · {entry.params.map((p) => p.name).join(", ")}
              {:else}
                · no options
              {/if}
              {#if entry.helper}
                · <code>{entry.helper}</code>
              {/if}
            </span>
            <span class="summary">{entry.summary}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}

  <h2 id="how-to-set">How to set a coord</h2>
  <p>
    Prefer a typed shell as a child of <code>&lt;GGPlot&gt;</code>. Coords
    replace whole; only one coord is active. Omit coord for default Cartesian.
  </p>
  <pre class="snippet"><code
      >{`import { GGPlot, GeomCol, CoordFlip } from "@ggts-sh/svelte";

<GGPlot data={rows} aes={{ x: "category", y: "value" }}>
  <GeomCol />
  <CoordFlip />
</GGPlot>`}</code
    ></pre>
  <p>
    Portable helpers assemble the same JSON for the builder or
    <code>normalize()</code>:
  </p>
  <pre class="snippet"><code
      >{`import { coordFixed, coordTransform } from "@ggts-sh/spec";

coordFixed({ ratio: 1 })
// → { type: "fixed" }

coordTransform({ x: "log10", y: { transform: "sqrt", reverse: true } })
// → { type: "transform", x: { transform: "log10" }, y: { transform: "sqrt", reverse: true } }`}</code
    ></pre>
  <p>
    Builder sugar includes <code>.coordFlip()</code>,
    <code>.coordTransform(…)</code>, <code>.coordFixed(…)</code>,
    <code>.coordEqual(…)</code>, and <code>.coordSf(…)</code>, plus
    <code>.coord(…)</code> for a full <code>CoordSpec</code> or the
    <code>"flip"</code> shorthand.
  </p>

  <h2 id="escape-hatch">Escape hatch</h2>
  <p>
    For a computed fragment, use
    <code>&lt;Coord value=&#123;spec&#125; /&gt;</code> where
    <code>value</code> is a <code>CoordSpec</code> or <code>"flip"</code>. Named
    shells are preferred when the form is known at authoring time.
  </p>
  <pre class="snippet"><code
      >{`import { GGPlot, GeomPoint, Coord } from "@ggts-sh/svelte";

const coord = condition ? { type: "flip" } : { type: "fixed", ratio: 2 };

<GGPlot data={rows} aes={{ x: "x", y: "y" }}>
  <GeomPoint />
  <Coord value={coord} />
</GGPlot>`}</code
    ></pre>
  <p>
    <code>&lt;CoordCartesian /&gt;</code> registers
    <code>&#123; type: "cartesian" &#125;</code>, which
    <code>normalize()</code> drops when bare — useful mid-migration under REPLACE
    so a child can clear a prior flip or fixed coord.
  </p>
</main>

<style>
  .coord-reference {
    max-width: 52rem;
    margin: 2rem 0 4rem;
  }

  h1 {
    margin: 0.15rem 0 0.6rem;
  }

  .intro {
    max-width: 44rem;
    color: var(--muted);
  }

  h2 {
    margin: 2.5rem 0 0.75rem;
  }

  label {
    display: block;
    margin: 1.5rem 0 0.4rem;
    font-weight: 600;
  }

  input[type="search"] {
    width: min(100%, 28rem);
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--line);
    border-radius: 0.4rem;
    background: var(--surface, transparent);
    color: var(--ink);
    font: inherit;
  }

  .count {
    margin: 0.75rem 0 0;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .empty {
    color: var(--muted);
  }

  .results {
    list-style: none;
    margin: 1rem 0 0;
    padding: 0;
  }

  .results li {
    border-top: 1px solid var(--line);
  }

  .results li:last-child {
    border-bottom: 1px solid var(--line);
  }

  .results a {
    display: grid;
    gap: 0.25rem;
    padding: 0.9rem 0;
    color: var(--ink);
    text-decoration: none;
  }

  .results a:hover strong {
    text-decoration: underline;
  }

  .meta {
    color: var(--muted);
    font-size: 0.88rem;
  }

  .summary {
    max-width: 44rem;
    color: var(--muted);
    font-size: 0.92rem;
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
</style>
