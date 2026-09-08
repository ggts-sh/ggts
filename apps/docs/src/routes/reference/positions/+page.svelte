<script lang="ts">
  import { base } from "$app/paths";
  import {
    positionReferenceList,
    type PositionReferenceEntry,
  } from "@ggts-sh/spec";

  let query = $state("");
  const all = positionReferenceList();
  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const results = $derived(
    normalizedQuery === ""
      ? all
      : all.filter((entry) => matchesPosition(entry, normalizedQuery)),
  );

  function matchesPosition(entry: PositionReferenceEntry, q: string): boolean {
    const haystack = [
      entry.name,
      entry.summary,
      ...entry.params.map((p) => p.name),
      ...entry.compatibleGeoms,
      ...entry.defaultForGeoms,
    ]
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(q);
  }
</script>

<main class="position-reference" aria-labelledby="reference-heading">
  <h1 id="reference-heading">Positions</h1>

  <label for="position-search">Search</label>
  <input
    id="position-search"
    type="search"
    bind:value={query}
    placeholder="stack, dodge, jitter…"
    autocomplete="off"
  />

  <p class="count" aria-live="polite">
    {results.length}
    {results.length === 1 ? "position" : "positions"}
  </p>

  <h2 id="all-positions">All positions</h2>
  {#if results.length === 0}
    <p class="empty">No match.</p>
  {:else}
    <ul class="results">
      {#each results as entry (entry.name)}
        <li>
          <a href={`${base}/reference/positions/${entry.slug}`}>
            <strong><code>{entry.name}</code></strong>
            <span class="meta">
              {#if entry.params.length > 0}
                params: {entry.params.map((p) => p.name).join(", ")}
              {:else}
                no positionParams
              {/if}
              · {entry.compatibleGeoms.length}
              {entry.compatibleGeoms.length === 1 ? "geom" : "geoms"}
              {#if entry.defaultForGeoms.length > 0}
                · default for {entry.defaultForGeoms.length}
              {/if}
            </span>
            <span class="summary">{entry.summary}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}

  <h2 id="how-to-set">How to set a position</h2>
  <p>
    Pass the <code>position</code> prop on a geom shell. Only values listed on
    that geom's
    <a href={`${base}/reference/geoms`}>Geoms</a> page validate. Omit it to use the
    geom default.
  </p>
  <pre class="snippet"><code
      >{`import { GGPlot, GeomBar } from "@ggts-sh/svelte";

<GGPlot data={rows} aes={{ x: "category", fill: "group" }}>
  <GeomBar position="dodge" />
</GGPlot>`}</code
    ></pre>
</main>

<style>
  .position-reference {
    max-width: 52rem;
    margin: 2rem 0 4rem;
  }

  h1 {
    margin: 0.15rem 0 0.6rem;
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
