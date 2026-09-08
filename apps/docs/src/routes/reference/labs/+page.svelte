<script lang="ts">
  import { base } from "$app/paths";

  import CopyCode from "$lib/components/CopyCode.svelte";

  const svelteExample = `import { GeomCol, GGPlot, Labs } from "@ggts-sh/svelte";

<GGPlot data={rows} aes={{ x: "quarter", y: "sales" }}>
  <GeomCol />
  <Labs
    title="Quarterly sales"
    subtitle="FY25"
    caption="Source: internal ledger"
    x="Quarter"
    y="Sales (M USD)"
  />
</GGPlot>`;

  const jsonExample = `{
  "data": [{ "quarter": "Q1", "sales": 12 }],
  "mapping": { "x": "quarter", "y": "sales" },
  "layers": [{ "geom": "col" }],
  "labs": {
    "title": "Quarterly sales",
    "subtitle": "FY25",
    "caption": "Source: internal ledger",
    "x": "Quarter",
    "y": "Sales (M USD)"
  }
}`;

  const mergeExample = `<GGPlot data={rows} aes={{ x: "quarter", y: "sales", color: "region" }}>
  <GeomCol />
  <Labs title="Sales" x="Quarter" />
  <Labs color="Region" caption="Internal" />
  <!-- keyed merge: color joins; a second title would win and warn -->
</GGPlot>`;
</script>

<article class="labs-reference prose" aria-labelledby="labs-heading">
  <h1 id="labs-heading"><code>Labs</code></h1>
  <p>
    Plot chrome labels: title, subtitle, caption, and per-aesthetic guide titles
    (axes and legends). <code>&lt;Labs&gt;</code> is a declaration-only child of
    <code>&lt;GGPlot&gt;</code> — it emits no markup and registers a live
    <code>labs</code> layer. Without a plot ancestor it is inert.
  </p>

  <h2 id="props">Props</h2>
  <p>
    Flat optional strings. There is no <code>value=&#123;…&#125;</code> escape
    hatch: <code>&lt;Labs &#123;...computed&#125; /&gt;</code> already covers computed
    bags.
  </p>
  <dl class="param-list">
    <div>
      <dt id="prop-title"><code>title</code></dt>
      <dd>Plot title above the panel.</dd>
    </div>
    <div>
      <dt id="prop-subtitle"><code>subtitle</code></dt>
      <dd>Subtitle under the title.</dd>
    </div>
    <div>
      <dt id="prop-caption"><code>caption</code></dt>
      <dd>Small caption under the plot.</dd>
    </div>
    <div>
      <dt id="prop-x"><code>x</code></dt>
      <dd>
        X axis title. Default is a humanized form of the mapped field name
        (sentence case).
      </dd>
    </div>
    <div>
      <dt id="prop-y"><code>y</code></dt>
      <dd>
        Y axis title. Default is a humanized form of the mapped field name
        (sentence case).
      </dd>
    </div>
    <div>
      <dt id="prop-color"><code>color</code></dt>
      <dd>Color legend title (humanized field name by default).</dd>
    </div>
    <div>
      <dt id="prop-fill"><code>fill</code></dt>
      <dd>Fill legend title (humanized field name by default).</dd>
    </div>
    <div>
      <dt id="prop-size"><code>size</code></dt>
      <dd>Size legend title (humanized field name by default).</dd>
    </div>
    <div>
      <dt id="prop-linewidth"><code>linewidth</code></dt>
      <dd>Linewidth legend title (humanized field name by default).</dd>
    </div>
    <div>
      <dt id="prop-alpha"><code>alpha</code></dt>
      <dd>Alpha legend title (humanized field name by default).</dd>
    </div>
    <div>
      <dt id="prop-shape"><code>shape</code></dt>
      <dd>Shape legend title (humanized field name by default).</dd>
    </div>
    <div>
      <dt id="prop-linetype"><code>linetype</code></dt>
      <dd>Linetype legend title (humanized field name by default).</dd>
    </div>
  </dl>

  <h2 id="svelte">Svelte</h2>
  <CopyCode
    language="svelte"
    accessibleLabel="Copy Labs Svelte example"
    code={svelteExample}
  />

  <h2 id="json">PortableSpec JSON</h2>
  <p>
    The same strings live on the top-level <code>labs</code> object. The fluent
    builder merges with <code>.labs(&#123;…&#125;)</code>.
  </p>
  <CopyCode
    language="json"
    accessibleLabel="Copy Labs JSON example"
    code={jsonExample}
  />

  <h2 id="merge">Keyed merge</h2>
  <p>
    <code>labs</code> is a keyed-merge family. Two <code>&lt;Labs&gt;</code>
    children that set different keys both survive. Two children that set the same
    key emit a <code>DUPLICATE_MERGE_KEY</code> advisory; the later value wins.
  </p>
  <CopyCode
    language="svelte"
    accessibleLabel="Copy Labs merge example"
    code={mergeExample}
  />

  <h2 id="related">Related surfaces</h2>
  <ul>
    <li>
      <a href={`${base}/reference/guides`}>Guides and legends</a> — legend and axis
      guide components and props.
    </li>
    <li>
      <a href={`${base}/reference/axes`}>Axes and ticks</a> —
      <code>GuideAxis</code>, scale breaks/labels, and collision policy.
    </li>
    <li>
      <a href={`${base}/reference/labels`}>Data labels</a> —
      <code>GeomText</code>, <code>GeomLabel</code>, and SF label geoms (not
      plot chrome).
    </li>
    <li>
      <a href={`${base}/guide/scales-guides`}>Scales and guides</a> — continuous,
      discrete, and temporal scales plus responsive guide presentation.
    </li>
    <li>
      <a href={`${base}/guide/upgrading#compose-labs-as-a-child-layer`}
        >Upgrade: compose labs as a child layer</a
      >
      — the removed <code>labs</code> prop on <code>&lt;GGPlot&gt;</code>.
    </li>
  </ul>
</article>

<style>
  .param-list {
    margin: 1.5rem 0;
  }

  .param-list > div {
    display: grid;
    grid-template-columns: minmax(8rem, 0.3fr) minmax(0, 1fr);
    padding: 0.85rem 0;
    border-top: 1px solid var(--line);
    gap: 1rem;
  }

  .param-list > div:last-child {
    border-bottom: 1px solid var(--line);
  }

  dt,
  dd {
    margin: 0;
  }

  @media (max-width: 40rem) {
    .param-list > div {
      grid-template-columns: 1fr;
    }
  }
</style>
