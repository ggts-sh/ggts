<script lang="ts">
  import { base } from "$app/paths";
  import { guideReferenceList, type GuideReferenceEntry } from "@ggts-sh/spec";

  let query = $state("");
  const all = guideReferenceList();
  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const results = $derived(
    normalizedQuery === ""
      ? all
      : all.filter((entry) => matchesGuide(entry, normalizedQuery)),
  );

  function matchesGuide(entry: GuideReferenceEntry, q: string): boolean {
    const haystack = [
      entry.name,
      entry.component,
      entry.helper,
      entry.helperAlias,
      entry.summary,
      ...entry.channels,
      ...entry.params.map((p) => p.name),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(q);
  }
</script>

<main class="guide-reference" aria-labelledby="reference-heading">
  <h1 id="reference-heading">Guides and legends</h1>
  <p class="intro">
    Appearance-only guides keyed by aesthetic. Compose declaration-only shells
    such as <code>GuideLegend</code> and <code>GuideColorbar</code>, or portable
    helpers such as <code>guideLegend</code>. Placement here is guide
    <strong>position</strong> (right/bottom) — not geom
    <a href={`${base}/reference/positions`}>position adjustments</a> (stack, dodge,
    jitter).
  </p>

  <label for="guide-search">Search</label>
  <input
    id="guide-search"
    type="search"
    bind:value={query}
    placeholder="legend, colorbar, axis, none…"
    autocomplete="off"
  />

  <p class="count" aria-live="polite">
    {results.length}
    {results.length === 1 ? "guide" : "guides"}
  </p>

  <h2 id="all-guides">All guides</h2>
  {#if results.length === 0}
    <p class="empty">No match.</p>
  {:else}
    <ul class="results">
      {#each results as entry (entry.name)}
        <li>
          <a href={`${base}/reference/guides/${entry.slug}`}>
            <strong><code>{entry.component}</code></strong>
            <span class="meta">
              type <code>"{entry.typeLiteral}"</code>
              · channels: {entry.channels.join(", ")}
              {#if entry.params.length > 0}
                · {entry.params.length}
                {entry.params.length === 1 ? "option" : "options"}
              {:else}
                · no options
              {/if}
            </span>
            <span class="summary">{entry.summary}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}

  <h2 id="how-to-set">How to set a guide</h2>
  <p>
    Prefer a typed shell with a <code>channel</code> prop. Guides merge by
    channel; the value at a channel is replaced whole. Top-level guide children
    win over a scale-local <code>guide</code> on the same aesthetic.
  </p>
  <pre class="snippet"><code
      >{`import { GGPlot, GeomPoint, GuideLegend } from "@ggts-sh/svelte";

<GGPlot data={rows} aes={{ x: "displ", y: "hwy", color: "class" }}>
  <GeomPoint />
  <GuideLegend channel="color" position="bottom" direction="horizontal" />
</GGPlot>`}</code
    ></pre>
  <p>
    Portable helpers assemble the same JSON for the builder or
    <code>normalize()</code>:
  </p>
  <pre class="snippet"><code
      >{`import { guideLegend, guides } from "@ggts-sh/spec";

guides({ color: guideLegend({ position: "bottom" }) })
// → { guides: { color: { type: "legend", position: "bottom" } } }`}</code
    ></pre>
  <p>
    For a computed multi-channel bag, use the escape hatch
    <code>&lt;Guides value=&#123;…&#125; /&gt;</code>. Suppress one channel with
    <a href={`${base}/reference/guides/none`}><code>GuideNone</code></a>.
  </p>

  <h2 id="legend-focus">Legend focus, filter, and clear recovery</h2>
  <p>
    Discrete color and fill legends can host interaction controls when
    <code>&lt;GuideLegend focus /&gt;</code> or
    <code>&lt;GuideLegend filter /&gt;</code> is enabled for that aesthetic. Do
    not put <code>legendFocus</code> / <code>legendFilter</code> on
    <code>&lt;GGPlot&gt;</code> — those plot props are deprecated dual-reads.
    Focus is presentation emphasis only; Clear legend focus restores the
    unfocused view without changing data. Filter changes included rows.
    Authoring the guide itself is separate — see
    <a href={`${base}/reference/guides/legend`}><code>GuideLegend</code></a>,
    the
    <a href={`${base}/guide/interaction-reference#legendfocus`}
      >interaction reference</a
    >, and the
    <a href={`${base}/examples/interaction/legend-focus`}
      >legend focus example</a
    >.
  </p>
</main>

<style>
  .guide-reference {
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
