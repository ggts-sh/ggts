<script lang="ts">
  import { base } from "$app/paths";
  import {
    SHARED_LAYER_PROPS,
    geomReferenceList,
    type GeomReferenceEntry,
  } from "@ggts-sh/spec";

  import { thumbnailPathForGeom } from "$lib/geom-thumbnails";

  let query = $state("");
  const all = geomReferenceList();
  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const results = $derived(
    normalizedQuery === ""
      ? all
      : all.filter((entry) => matchesGeom(entry, normalizedQuery)),
  );

  function matchesGeom(entry: GeomReferenceEntry, q: string): boolean {
    const haystack = [
      entry.name,
      entry.component,
      entry.summary,
      entry.defaultStat,
      entry.defaultPosition,
      ...entry.allowedStats,
      ...entry.allowedPositions,
      ...entry.params.map((p) => p.name),
      entry.aliasOf ?? "",
    ]
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(q);
  }

  function thumbSrc(entry: GeomReferenceEntry): string | undefined {
    const path = thumbnailPathForGeom(entry.name);
    return path === undefined ? undefined : `${base}${path}`;
  }
</script>

<main class="geom-reference" aria-labelledby="reference-heading">
  <h1 id="reference-heading">Geoms</h1>

  <label for="geom-search">Search</label>
  <input
    id="geom-search"
    type="search"
    bind:value={query}
    placeholder="bar, point, line…"
    autocomplete="off"
  />

  <p class="count" aria-live="polite">
    {results.length}
    {results.length === 1 ? "geom" : "geoms"}
  </p>

  <h2 id="all-geoms">All geoms</h2>
  {#if results.length === 0}
    <p class="empty">No match.</p>
  {:else}
    <ul class="results">
      {#each results as entry (entry.name)}
        {@const thumb = thumbSrc(entry)}
        <li>
          <a href={`${base}/reference/geoms/${entry.slug}`}>
            {#if thumb !== undefined}
              <span class="thumb" aria-hidden="true">
                <img
                  src={thumb}
                  alt=""
                  width="96"
                  height="96"
                  loading="lazy"
                  decoding="async"
                />
              </span>
            {/if}
            <span class="body">
              <strong><code>{entry.component}</code></strong>
              <span class="meta">
                <code>{entry.name}</code>
                · {entry.defaultStat} + {entry.defaultPosition}
                {#if entry.aliasOf !== undefined}
                  · alias of <code>{entry.aliasOf}</code>
                {/if}
              </span>
              <span class="summary">{entry.summary}</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}

  <h2 id="shared-layer-props">Shared layer props</h2>
  <p>
    Every geom shell accepts these props in addition to its own params. On the
    JSON layer they are top-level fields next to <code>geom</code>.
  </p>
  <dl class="shared-props">
    {#each SHARED_LAYER_PROPS as prop (prop.name)}
      <div>
        <dt><code>{prop.name}</code></dt>
        <dd>
          <p class="type"><code>{prop.typeSummary}</code></p>
          <p>{prop.description}</p>
        </dd>
      </div>
    {/each}
  </dl>
</main>

<style>
  .geom-reference {
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
    grid-template-columns: 5.5rem minmax(0, 1fr);
    gap: 0.9rem 1rem;
    align-items: start;
    padding: 0.9rem 0;
    color: var(--ink);
    text-decoration: none;
  }

  .results a:hover strong {
    text-decoration: underline;
  }

  .thumb {
    display: block;
    width: 5.5rem;
    aspect-ratio: 1;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 0.45rem;
    background: color-mix(in srgb, var(--ink) 3%, transparent);
  }

  .thumb img {
    display: block;
    width: 100%;
    height: 100%;
    /* Crop title/legend chrome; bias into the panel so the mark is central. */
    object-fit: cover;
    object-position: center 58%;
  }

  .body {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
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

  @media (max-width: 36rem) {
    .results a {
      grid-template-columns: 4.25rem minmax(0, 1fr);
      gap: 0.75rem;
    }

    .thumb {
      width: 4.25rem;
    }
  }

  .shared-props {
    margin: 1rem 0 0;
  }

  .shared-props > div {
    display: grid;
    grid-template-columns: minmax(7rem, 0.28fr) minmax(0, 1fr);
    gap: 1rem;
    padding: 0.85rem 0;
    border-top: 1px solid var(--line);
  }

  .shared-props > div:last-child {
    border-bottom: 1px solid var(--line);
  }

  .shared-props dt {
    font-weight: 600;
  }

  .shared-props dd {
    margin: 0;
  }

  .shared-props .type {
    margin: 0 0 0.35rem;
    color: var(--muted);
    font-size: 0.88rem;
  }

  .shared-props p {
    margin: 0;
  }
</style>
