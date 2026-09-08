<script lang="ts">
  import { base } from "$app/paths";

  import CopyCode from "$lib/components/CopyCode.svelte";

  const geomTextExample = `import { GeomPoint, GeomText, GGPlot, Labs } from "@ggts-sh/svelte";

<GGPlot data={cities} aes={{ x: "lon", y: "lat", label: "name" }}>
  <GeomPoint />
  <GeomText dy={-8} size={11} />
  <Labs title="City labels" x="Longitude" y="Latitude" />
</GGPlot>`;

  const geomLabelExample = `<GGPlot data={cities} aes={{ x: "lon", y: "lat", label: "name" }}>
  <GeomPoint />
  <GeomLabel dy={-10} size={11} />
</GGPlot>`;
</script>

<article class="labels-reference prose" aria-labelledby="labels-heading">
  <h1 id="labels-heading">Labels</h1>
  <p>
    “Label” means three different contracts in ggsvelte. Use the right surface
    so titles, ticks, and per-mark text do not get mixed up.
  </p>

  <h2 id="three-kinds">Three kinds of labels</h2>
  <dl class="param-list">
    <div>
      <dt>
        <a href={`${base}/reference/labs`}>Plot chrome</a>
      </dt>
      <dd>
        <code>Labs</code> title, subtitle, caption, and aesthetic titles (axes/legends).
        Not drawn from row data.
      </dd>
    </div>
    <div>
      <dt>
        <a href={`${base}/reference/axes`}>Tick labels</a>
      </dt>
      <dd>
        Scale <code>breaks</code> / <code>labels</code> /
        <code>dateLabels</code> choose values and format;
        <code>GuideAxis</code> chooses show/hide and collision (<code>auto</code
        >
        | <code>preserve</code> | <code>ellipsis</code>).
      </dd>
    </div>
    <div>
      <dt>Data labels</dt>
      <dd>
        Geoms that place <code>aes.label</code> at data coordinates:
        <code>GeomText</code>, <code>GeomLabel</code>, and their SF variants.
        Full param tables live on each geom page.
      </dd>
    </div>
  </dl>

  <h2 id="geom-text"><code>GeomText</code></h2>
  <p>
    One text mark per data row at <code>(x, y)</code>. Requires
    <code>x</code>, <code>y</code>, and <code>label</code> channels. There is
    <strong>no collision detection</strong> — labels draw exactly where placed.
    Offset with <code>dx</code>/<code>dy</code> or
    <code>position="nudge"</code> plus
    <code>positionParams</code>.
  </p>
  <p>
    Schema-derived defaults, params, and allowed stats:
    <a href={`${base}/reference/geoms/text`}><code>GeomText</code></a>.
  </p>
  <CopyCode
    language="svelte"
    accessibleLabel="Copy GeomText example"
    code={geomTextExample}
  />

  <h2 id="geom-label"><code>GeomLabel</code></h2>
  <p>
    Same placement contract as text, with a rounded rectangular background box.
    Still no collision detection. <code>color</code> paints ink and box stroke;
    <code>fill</code> paints the box background when mapped.
  </p>
  <p>
    Full reference:
    <a href={`${base}/reference/geoms/label`}><code>GeomLabel</code></a>.
  </p>
  <CopyCode
    language="svelte"
    accessibleLabel="Copy GeomLabel example"
    code={geomLabelExample}
  />

  <h2 id="sf-labels">Simple-features labels</h2>
  <ul>
    <li>
      <a href={`${base}/reference/geoms/sf_text`}><code>GeomSfText</code></a>
      — places <code>aes.label</code> at representative geometry points (<code
        >Multi*</code
      >
      → one label per part;
      <code>stat_sf_coordinates</code>).
    </li>
    <li>
      <a href={`${base}/reference/geoms/sf_label`}><code>GeomSfLabel</code></a>
      — same placement with a measured rounded background rect.
    </li>
  </ul>
  <p>
    Runnable contracts:
    <a href={`${base}/examples/sf/labels`}>SF region labels</a> and
    <a href={`${base}/examples/sf/boxed-labels`}>SF boxed labels</a>.
  </p>

  <h2 id="collision">Collision: geoms vs guides</h2>
  <p>
    Guide collision policies only apply to guide chrome. Axes use
    <code>auto</code> / <code>preserve</code> / <code>ellipsis</code>; legends
    and colorbars may use <code>ellipsis</code>, <code>wrap</code>, or
    <code>error</code>. Data-label geoms never auto-dodge or drop overlapping
    marks — you author placement. A guide with <code>collision: "error"</code>
    that cannot fit fails with a guide-collision diagnostic rather than silently clipping
    (see <a href={`${base}/guide/errors`}>Errors reference</a>).
  </p>

  <h2 id="related">Related surfaces</h2>
  <ul>
    <li>
      <a href={`${base}/reference/labs`}><code>Labs</code></a> — titles and axis/legend
      names.
    </li>
    <li>
      <a href={`${base}/reference/axes`}>Axes and ticks</a> — breaks, formats, and
      axis guides.
    </li>
    <li>
      <a href={`${base}/reference/geoms`}>Geoms index</a> — every mark including text
      and label families.
    </li>
    <li>
      <a href={`${base}/reference/positions/nudge`}>position nudge</a> — fixed offsets
      for labels beside points.
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
