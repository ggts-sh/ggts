<script lang="ts">
  import { base } from "$app/paths";
  import {
    SCALE_FAMILY_LABELS,
    scaleReferenceByFamily,
    scaleReferenceList,
    type ScaleFamily,
    type ScaleReferenceEntry,
  } from "@ggts-sh/spec";

  let query = $state("");
  /** Full catalog (primaries + Colour/Ordinal aliases) for search. */
  const all = scaleReferenceList();
  const byFamily = scaleReferenceByFamily();
  const familyOrder = Object.keys(SCALE_FAMILY_LABELS) as ScaleFamily[];
  const primaryCount = $derived(
    familyOrder.reduce((n, f) => n + byFamily[f].length, 0),
  );

  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const results = $derived(
    normalizedQuery === ""
      ? all.filter((e) => e.aliasOf === undefined)
      : all.filter((entry) => matchesScale(entry, normalizedQuery)),
  );

  const groupedResults = $derived.by(() => {
    if (normalizedQuery === "") {
      return familyOrder.map((family) => ({
        family,
        label: SCALE_FAMILY_LABELS[family],
        entries: byFamily[family],
      }));
    }
    const map = new Map<ScaleFamily, ScaleReferenceEntry[]>();
    for (const entry of results) {
      const list = map.get(entry.family) ?? [];
      list.push(entry);
      map.set(entry.family, list);
    }
    return familyOrder
      .filter((family) => (map.get(family)?.length ?? 0) > 0)
      .map((family) => ({
        family,
        label: SCALE_FAMILY_LABELS[family],
        entries: map.get(family) ?? [],
      }));
  });

  function matchesScale(entry: ScaleReferenceEntry, q: string): boolean {
    const haystack = [
      entry.helper,
      entry.component,
      entry.slug,
      entry.summary,
      entry.family,
      entry.scaleType,
      entry.optionsType,
      ...entry.aesthetics,
      ...entry.params.map((p) => p.name),
      ...entry.alsoExportedAs,
      entry.aliasOf ?? "",
    ]
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(q);
  }
</script>

<main class="scale-reference" aria-labelledby="reference-heading">
  <h1 id="reference-heading">Scales</h1>
  <p class="lede">
    Every public <code>Scale*</code> component: position, color/fill, and style
    channels. Props match the fluent helpers on <code>@ggts-sh/spec</code> and
    the PortableSpec <code>scales</code> object. For palette specimens, see
    <a href={`${base}/palettes`}>Palettes</a>; for guide behavior, see
    <a href={`${base}/guide/scales-guides`}>Scales and guides</a>.
  </p>

  <label for="scale-search">Search</label>
  <input
    id="scale-search"
    type="search"
    bind:value={query}
    placeholder="color continuous, x log, size…"
    autocomplete="off"
  />

  <p class="count" aria-live="polite">
    {results.length}
    {results.length === 1 ? "scale" : "scales"}
    {#if normalizedQuery === ""}
      <span class="muted">
        ({primaryCount} primary components; search also matches Colour/Ordinal aliases)</span
      >
    {/if}
  </p>

  {#if groupedResults.length === 0}
    <p class="empty">No match.</p>
  {:else}
    {#each groupedResults as group (group.family)}
      <h2 id={group.family}>{group.label}</h2>
      <ul class="results">
        {#each group.entries as entry (entry.slug)}
          <li>
            <a href={`${base}/reference/scales/${entry.slug}`}>
              <strong><code>{entry.component}</code></strong>
              <span class="meta">
                <code>{entry.helper}</code>
                · {entry.aesthetics.join(", ")}
                · {entry.scaleType}
                {#if entry.aliasOf !== undefined}
                  · alias
                {/if}
              </span>
              <span class="summary">{entry.summary}</span>
            </a>
          </li>
        {/each}
      </ul>
    {/each}
  {/if}

  <h2 id="how-to-set">How to set a scale</h2>
  <p>
    Nest a <code>Scale*</code> child under <code>GGPlot</code>, call the
    matching fluent helper on a builder, or write the PortableSpec
    <code>scales</code>
    object. Channels not configured are inferred from data.
  </p>
  <pre class="snippet"><code
      >{`import {
  GGPlot,
  GeomPoint,
  ScaleColorContinuous,
  ScaleXContinuous,
} from "@ggts-sh/svelte";

<GGPlot data={rows} aes={{ x: "year", y: "value", color: "temp" }}>
  <GeomPoint />
  <ScaleXContinuous labels="d" />
  <ScaleColorContinuous scheme="viridis" />
</GGPlot>`}</code
    ></pre>
</main>

<style>
  .scale-reference {
    max-width: 52rem;
    margin: 2rem 0 4rem;
  }

  h1 {
    margin: 0.15rem 0 0.6rem;
  }

  .lede {
    max-width: 44rem;
    margin: 0 0 1.25rem;
    color: var(--muted);
  }

  .lede a {
    color: var(--ink);
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

  .count .muted {
    color: var(--muted);
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
