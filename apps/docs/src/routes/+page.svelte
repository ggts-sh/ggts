<script lang="ts">
  import { base } from "$app/paths";

  import CodeTabs from "$lib/CodeTabs.svelte";
  import { FEATURED_EXAMPLES, galleryCatalog } from "$lib/catalog/gallery";
  import BenchmarkHighlights from "$lib/components/BenchmarkHighlights.svelte";
  import { SANDBOX_INSTALL, SANDBOX_COMMANDS } from "$scripts/agent-quickstart";
  import GrammarDemo from "$lib/components/GrammarDemo.svelte";
  import { EXAMPLES } from "$lib/examples-manifest";
  import { HOME_CODE_PATH_TABS } from "$lib/home-code-path";

  import type { PageProps } from "./$types";

  const { data }: PageProps = $props();

  const entries = galleryCatalog(EXAMPLES);
  const featured = FEATURED_EXAMPLES.map((item) =>
    entries.find((entry) => entry.id === item.id)!,
  );
  const tabs = HOME_CODE_PATH_TABS;
</script>

<section class="home-hero" aria-labelledby="home-heading">
  <h1 id="home-heading">
    ggts: ggplot2’s grammar for <span class="hero-fast">TypeScript</span>
  </h1>
  <div>
    <p>
      Built for coding agents. Check charts in a sandbox, then use the same spec
      in React or Svelte.
    </p>
    <CodeTabs
      tabs={[
        {
          label: "Agent sandbox",
          code: `${SANDBOX_INSTALL}\n${SANDBOX_COMMANDS}`,
          language: "bash",
        },
      ]}
    />
    <p>
      <a href={`${base}/guide/agents`}>Set up an agent sandbox</a> ·
      <a href={`${base}/guide/getting-started`}>React and Svelte quickstarts</a>
    </p>
  </div>
</section>

<section class="home-performance" aria-labelledby="benchmark-heading">
  <h2 id="benchmark-heading">The grammar you want. The speed you need.</h2>
  <p>
    Render thousands of points without hand-writing scales, axes, or legends.
  </p>
  <BenchmarkHighlights />
  <p class="benchmark-source">
    Selected SVG comparisons · lower is better ·
    <a href="https://github.com/ggts-sh/ggts/tree/main/benchmarks/competitive"
      >Benchmarks on GitHub</a
    >
  </p>
</section>

<section class="home-featured" aria-label="Examples">
  <header>
    <a href={`${base}/examples`}>Gallery</a>
  </header>
  <ol>
    {#each featured as entry (entry.id)}
      <li>
        <a href={`${base}/examples/${entry.id}`} aria-label={entry.title}>
          <figure>
            <div class="preview-paper">
              <img
                src={`${base}${entry.previewPath}`}
                alt=""
                width="640"
                height={entry.vrHeight ?? 400}
              />
            </div>
          </figure>
        </a>
      </li>
    {/each}
  </ol>
</section>

<section class="code-path" aria-labelledby="code-path-heading">
  <div class="code-path-chart">
    <GrammarDemo
      staticSvgLightSite={data.grammarStaticSvgLightSite}
      staticSvgDarkSite={data.grammarStaticSvgDarkSite}
    />
  </div>
  <div class="code-path-copy">
    <h2 id="code-path-heading">One grammar. React, Svelte, or a sandbox.</h2>
    <p>
      Compose charts with familiar ggplot2 names, or generate PortableSpec JSON.
      Both framework adapters use the same TypeScript pipeline.
    </p>
  </div>
  <div class="code-path-tabs">
    <CodeTabs {tabs} />
  </div>
</section>

<section class="evidence" aria-labelledby="evidence-heading">
  <header>
    <h2 id="evidence-heading">Docs</h2>
  </header>
  <dl>
    <div>
      <dt>Getting started</dt>
      <dd>
        <a href={`${base}/guide/getting-started`}>Install and render a chart</a>
      </dd>
    </div>
    <div>
      <dt>Themes</dt>
      <dd>
        <a href={`${base}/themes`}>Built-in chart themes</a>
      </dd>
    </div>
    <div>
      <dt>Palettes</dt>
      <dd>
        <a href={`${base}/palettes`}
          >Categorical palettes and sequential scales</a
        >
      </dd>
    </div>
    <div>
      <dt>Headless SVG</dt>
      <dd>
        <a href={`${base}/guide/production`}>No-DOM renderer and CLI</a>
      </dd>
    </div>
  </dl>
</section>

<style>
  .home-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: clamp(2rem, 5vw, 4.5rem);
    min-width: 0;
    padding: clamp(2rem, 5vw, 4rem) 0 0;
  }

  .home-hero h1 {
    margin: 0;
    font-size: clamp(1.9rem, 3.4vw, 3.1rem);
    line-height: 1.04;
    letter-spacing: -0.035em;
  }

  .hero-fast {
    color: var(--accent);
    font-style: italic;
  }

  .home-performance {
    padding-top: clamp(2rem, 5vw, 4rem);
  }

  .home-performance h2 {
    margin-bottom: 0.5rem;
  }

  .benchmark-source {
    color: var(--muted);
    font-size: 0.85rem;
  }

  .home-featured {
    padding-block: clamp(2.5rem, 6vw, 5rem) clamp(4rem, 8vw, 7rem);
  }

  .home-featured header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1rem;
  }

  .evidence header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 2rem;
    margin-bottom: 2rem;
  }

  .evidence h2 {
    max-width: 13ch;
    margin: 0.25rem 0 0;
    font-size: clamp(2.5rem, 5vw, 4.75rem);
    line-height: 0.94;
  }

  .code-path h2 {
    max-width: 14ch;
    margin: 0.25rem 0 0;
    font-size: clamp(1.9rem, 3.4vw, 3.1rem);
    line-height: 1.04;
    letter-spacing: -0.035em;
  }

  .home-featured ol {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  figure {
    margin: 0;
  }

  .home-featured a {
    color: inherit;
    text-decoration: none;
  }

  .home-featured header a {
    font-weight: 600;
    text-decoration: underline;
  }

  .preview-paper {
    display: grid;
    aspect-ratio: 4 / 3;
    place-items: center;
    overflow: hidden;
  }

  .preview-paper img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /*
   * One section: live/static penguins chart on top, then title + code tabs.
   * Chart spans full width; copy and tabs sit side by side below.
   */
  .code-path {
    display: grid;
    grid-template-areas:
      "chart chart"
      "copy tabs";
    grid-template-columns: minmax(16rem, 0.65fr) minmax(0, 1.35fr);
    gap: clamp(1.5rem, 4vw, 3rem) clamp(2rem, 6vw, 6rem);
    padding-block: clamp(4rem, 9vw, 8rem);
    border-top: 1px solid var(--line);
  }

  .code-path-chart {
    grid-area: chart;
    min-width: 0;
  }

  .code-path-copy {
    grid-area: copy;
  }

  .code-path-tabs {
    grid-area: tabs;
    min-width: 0;
  }

  .code-path-copy > p:last-child {
    color: var(--muted);
  }

  .evidence {
    padding-block: clamp(4rem, 8vw, 7rem);
    border-top: 1px solid var(--line);
  }

  .evidence dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 0;
    border-top: 1px solid var(--line);
  }

  .evidence dl > div {
    padding: 1.5rem 1.5rem 1.5rem 0;
    border-bottom: 1px solid var(--line);
  }

  .evidence dt {
    font: 700 1.4rem/1.1 var(--display-font);
  }

  .evidence dd {
    margin: 0.5rem 0 0;
    color: var(--muted);
  }

  @media (max-width: 64rem) {
    .home-hero {
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
    }

    .home-featured ol {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 42rem) {
    .home-hero {
      padding-top: 1.5rem;
    }

    .home-hero h1 {
      font-size: clamp(1.8rem, 7.5vw, 2.5rem);
    }

    .home-featured {
      margin-inline: -1rem;
    }

    .home-featured header {
      align-items: start;
      margin-inline: 1rem;
    }

    .home-featured ol {
      grid-auto-columns: min(85vw, 21rem);
      grid-template-columns: none;
      grid-auto-flow: column;
      gap: 1rem;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding-inline: 1rem;
    }

    .home-featured li {
      scroll-snap-align: start;
    }

    .code-path {
      grid-template-areas:
        "chart"
        "copy"
        "tabs";
      grid-template-columns: 1fr;
    }

    .evidence dl {
      grid-template-columns: 1fr;
    }
  }
</style>
