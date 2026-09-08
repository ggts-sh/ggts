<script lang="ts">
  import { base } from "$app/paths";
  import { REACT_SPEC_HOST_SOURCE } from "$scripts/agent-quickstart";

  import CodeTabs from "$lib/CodeTabs.svelte";
  import { galleryCatalog } from "$lib/catalog/gallery";
  import ExampleLiveFrame from "$lib/components/ExampleLiveFrame.svelte";
  import { EXAMPLES } from "$lib/examples-manifest";
  import { rankRelatedExamples } from "$lib/gallery-filter";

  import type { PageProps } from "./$types";

  const { data }: PageProps = $props();
  const frameWidth = $derived(data.entry.vrWidth ?? 640);
  const frameHeight = $derived(data.entry.vrHeight ?? 400);
  /** Named theme only — object-form overrides skip the marks-only dark remap. */
  const themeName = $derived(
    typeof data.spec.theme === "string" ? data.spec.theme : undefined,
  );
  const galleryEntries = galleryCatalog(EXAMPLES);
  // Seed from the page entry so exposition aliases (outside galleryCatalog)
  // still get gallery neighbours instead of an empty "More examples" section.
  const related = $derived(
    rankRelatedExamples(data.entry.id, galleryEntries, 3, data.entry),
  );
  const tabs = $derived([
    {
      label: "React",
      code: data.reactSource ?? REACT_SPEC_HOST_SOURCE,
      language: "tsx",
    },
    { label: "Svelte", code: data.svelteSource, language: "svelte" },
    { label: "Builder (TS)", code: data.specSource, language: "typescript" },
    {
      label: "Spec (JSON)",
      code: JSON.stringify(data.spec, null, 2),
      language: "json",
    },
  ]);
</script>

<article class="example-page">
  <header class="example-prose example-heading">
    <p class="crumbs">
      <a href={`${base}/examples`}>Gallery</a> / {data.entry.docsSection}
    </p>
    <p class="eyebrow">{data.entry.category}</p>
    <h1>{data.entry.title}</h1>
    {#if data.entry.description.trim() !== ""}
      <p class="proof">{data.entry.description}</p>
    {/if}
  </header>

  {#if data.entry.journey?.pointer || data.entry.journey?.keyboard || data.entry.journey?.touch}
    <section class="example-prose try-it" aria-labelledby="try-it-heading">
      <h2 id="try-it-heading">Interaction</h2>
      <dl>
        {#if data.entry.journey.pointer}
          <div>
            <dt>Pointer</dt>
            <dd>{data.entry.journey.pointer}</dd>
          </div>
        {/if}
        {#if data.entry.journey.keyboard}
          <div>
            <dt>Keyboard</dt>
            <dd>{data.entry.journey.keyboard}</dd>
          </div>
        {/if}
        {#if data.entry.journey.touch}
          <div>
            <dt>Touch</dt>
            <dd>{data.entry.journey.touch}</dd>
          </div>
        {/if}
      </dl>
    </section>
  {/if}

  {#key data.entry.id}
    <ExampleLiveFrame
      exampleId={data.entry.id}
      previewPath={data.previewPath}
      title={data.entry.title}
      width={frameWidth}
      height={frameHeight}
      fullWidth={data.entry.journey?.fullWidth ?? false}
      {themeName}
    />
  {/key}

  <section
    class="example-prose code-section"
    aria-labelledby="example-code-heading"
  >
    <div class="section-heading">
      <div>
        <p class="eyebrow">Source</p>
        <h2 id="example-code-heading">React, Svelte, builder, JSON</h2>
      </div>
    </div>
    {#if data.reactSource === null}
      <p>
        For React, save the complete Spec JSON as <code>chart.json</code>
        beside the component. This host renders the chart grammar. The live Svelte
        example may add interactions; follow the
        <a href={`${base}/guide/interactions`}>interaction guide</a>
        for inspection, selection, and linked state in your framework.
      </p>
    {/if}
    <CodeTabs {tabs} />
  </section>

  <section
    class="example-prose implementation"
    aria-labelledby="implementation-heading"
  >
    <div>
      <p class="eyebrow">Meta</p>
      <h2 id="implementation-heading">Details</h2>
    </div>
    <dl>
      <div>
        <dt>Family</dt>
        <dd>{data.entry.docsSection}</dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd><code>{data.entry.id}</code></dd>
      </div>
      <div>
        <dt>Rendering</dt>
        <dd>
          {data.entry.tags.includes("canvas")
            ? "Canvas marks with SVG chrome"
            : "SVG"}
        </dd>
      </div>
      <div>
        <dt>Techniques</dt>
        <dd><p class="tags">{data.entry.tags.join(" · ")}</p></dd>
      </div>
    </dl>
    {#if data.entry.journey?.references && data.entry.journey.references.length > 0}
      <nav class="references" aria-label="Related interaction reference">
        <span>Reference:</span>
        {#each data.entry.journey.references as reference, index (reference.href)}
          {#if index > 0}<span aria-hidden="true"> · </span>{/if}
          <a href={`${base}${reference.href}`}>{reference.label}</a>
        {/each}
      </nav>
    {/if}
  </section>

  {#if related.length > 0}
    <section class="example-prose related" aria-labelledby="related-heading">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Related</p>
          <h2 id="related-heading">More examples</h2>
        </div>
        <a href={`${base}/examples`}>All {galleryEntries.length}</a>
      </div>
      <ul>
        {#each related as entry (entry.id)}
          <li>
            <a href={`${base}/examples/${entry.id}`} aria-label={entry.title}>
              <div class="preview-paper">
                <img
                  src={`${base}${entry.previewPath}`}
                  alt=""
                  width="640"
                  height={entry.vrHeight ?? 400}
                  loading="lazy"
                />
              </div>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</article>

<style>
  .example-page {
    padding-block: clamp(2rem, 6vw, 5rem);
  }

  .example-prose {
    max-width: 68rem;
  }

  .example-heading {
    max-width: 52rem;
  }

  .crumbs,
  .eyebrow {
    color: var(--muted);
    font-size: 0.78rem;
  }

  .eyebrow {
    margin: 0;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0.25rem 0 0.75rem;
    font-size: clamp(1.9rem, 3.4vw, 3.1rem);
    line-height: 1.04;
    letter-spacing: -0.035em;
  }

  .proof {
    max-width: 40rem;
    margin: 0;
    color: var(--muted);
    font-size: 1rem;
    line-height: 1.45;
  }

  .try-it {
    margin-top: 2rem;
    padding-block: 1rem;
    border-block: 1px solid var(--line);
  }

  .try-it h2 {
    margin: 0 0 0.75rem;
    font-size: 1.15rem;
  }

  .try-it dl {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    margin: 0;
  }

  .try-it dt {
    font-weight: 600;
  }

  .try-it dd {
    margin: 0.25rem 0 0;
    color: var(--muted);
  }

  .code-section,
  .implementation,
  .related {
    margin-top: clamp(4rem, 8vw, 7rem);
  }

  .section-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--line);
  }

  .code-section :global(.code-tabs) {
    margin-top: 1.25rem;
  }

  .section-heading h2,
  .implementation h2 {
    margin: 0.25rem 0 0;
  }

  .implementation {
    display: grid;
    grid-template-columns: minmax(14rem, 0.6fr) minmax(0, 1.4fr);
    gap: 2rem;
    padding-block: 2rem;
    border-block: 1px solid var(--line);
  }

  .implementation dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.5rem;
    margin: 0;
  }

  .implementation dt {
    color: var(--muted);
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .implementation dd {
    margin: 0.25rem 0 0;
  }

  .references {
    grid-column: 2;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .related ul {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    margin: 1.5rem 0 0;
    padding: 0;
    list-style: none;
  }

  .related a {
    display: grid;
    gap: 0.75rem;
    color: inherit;
    text-decoration: none;
  }

  .preview-paper {
    display: grid;
    aspect-ratio: 4 / 3;
    place-items: center;
    overflow: hidden;
    border: 1px solid var(--line);
    background: #fff;
  }

  .preview-paper img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  @media (max-width: 48rem) {
    .try-it dl,
    .implementation,
    .implementation dl,
    .related ul {
      grid-template-columns: 1fr;
    }

    .references {
      grid-column: 1;
    }

    .section-heading {
      align-items: start;
      flex-direction: column;
    }
  }
</style>
