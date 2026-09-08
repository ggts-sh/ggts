<script lang="ts">
  import { base } from "$app/paths";

  import CopyCode from "$lib/components/CopyCode.svelte";

  const guideAxisExample = `import { GeomPoint, GGPlot, GuideAxis, Labs } from "@ggts-sh/svelte";

<GGPlot data={rows} aes={{ x: "hour", y: "pm25" }}>
  <GeomPoint />
  <GuideAxis channel="x" showTicks={false} collision="ellipsis" />
  <GuideAxis channel="y" title="µg/m³" />
  <Labs x="Hour of day" y="PM2.5" />
</GGPlot>`;

  const scaleBreaksExample = `<GGPlot data={rows} aes={{ x: "weight", y: "economy" }}>
  <GeomPoint />
  <Scale
    value={{
      x: {
        type: "linear",
        breaks: [2000, 3000, 4000],
        labels: ",d",
        minorBreaks: [2500, 3500],
      },
      y: { type: "linear", labels: ".1f" },
    }}
  />
</GGPlot>`;

  const bandGuideExample = `<GGPlot data={rows} aes={{ x: "category", y: "count" }}>
  <GeomCol />
  <Scale
    value={{
      x: {
        type: "band",
        guide: { mode: "rotate", angle: -35 },
      },
    }}
  />
</GGPlot>`;

  const builderGuidesExample = `import { guideAxis, guideNone } from "@ggts-sh/spec";

const guides = {
  x: guideAxis({ title: "Hour", showTicks: false }),
  y: guideAxis({ showLabels: true, collision: "preserve" }),
  color: guideNone(),
};`;
</script>

<article class="axes-reference prose" aria-labelledby="axes-heading">
  <h1 id="axes-heading">Axes and ticks</h1>
  <p>
    Axis titles, tick positions, tick label text, and tick collision policy come
    from three cooperating surfaces: <strong>labs</strong> (plot-level titles),
    <strong>scales</strong> (where ticks fall and how they format), and
    <strong>guides</strong> (whether the axis draws ticks/labels and how crowded labels
    behave). Grid lines are theme chrome, not axis-guide options.
  </p>

  <h2 id="who-owns-what">Who owns what</h2>
  <dl class="param-list">
    <div>
      <dt><a href={`${base}/reference/labs`}>Labs</a></dt>
      <dd>
        Human titles for the plot and each aesthetic (<code>x</code>/<code
          >y</code
        >/legends). Defaults humanize mapped field names.
      </dd>
    </div>
    <div>
      <dt>
        <a href={`${base}/guide/scales-guides#breaks-and-labels`}>Scales</a>
      </dt>
      <dd>
        <code>breaks</code>, <code>minorBreaks</code>, <code>labels</code>
        (format string), temporal <code>dateBreaks</code> /
        <code>dateLabels</code> / <code>locale</code>, and scale-local
        <code>guide</code> (including band-axis layout).
      </dd>
    </div>
    <div>
      <dt><code>GuideAxis</code></dt>
      <dd>
        Per-channel axis presentation: optional title override, show/hide ticks
        and labels, collision policy, and bounded guide theme overrides.
      </dd>
    </div>
    <div>
      <dt><a href={`${base}/themes`}>Theme</a></dt>
      <dd>
        Panel grid color, width, dasharray, and
        <code>gridX</code>/<code>gridY</code> toggles — not fields on
        <code>GuideAxis</code>.
      </dd>
    </div>
  </dl>

  <h2 id="guide-axis"><code>GuideAxis</code></h2>
  <p>
    Declaration-only child. Keys an axis guide by positional channel:
    <code>&lt;GuideAxis channel="x" showTicks=&#123;false&#125;/&gt;</code>
    assembles
    <code
      >guides: &#123; x: &#123; type: "axis", showTicks: false &#125; &#125;</code
    >. Prefer the shell when the shape is fixed; use
    <code>&lt;Guides value=&#123;…&#125; /&gt;</code> for multi-channel bags.
  </p>
  <dl class="param-list">
    <div>
      <dt id="opt-channel"><code>channel</code></dt>
      <dd>
        Required. <code>"x"</code> or <code>"y"</code> only — other aesthetics use
        legend, colorbar, or colorsteps guides.
      </dd>
    </div>
    <div>
      <dt id="opt-title"><code>title</code></dt>
      <dd>
        Optional axis title string (max 256). Overrides the title from
        <a href={`${base}/reference/labs`}>Labs</a> / humanized field defaults for
        this guide.
      </dd>
    </div>
    <div>
      <dt id="opt-show-ticks"><code>showTicks</code></dt>
      <dd>When false, omit tick marks.</dd>
    </div>
    <div>
      <dt id="opt-show-labels"><code>showLabels</code></dt>
      <dd>When false, omit tick labels (ticks may still draw).</dd>
    </div>
    <div>
      <dt id="opt-collision"><code>collision</code></dt>
      <dd>
        <code>"auto"</code> (default layout), <code>"preserve"</code> (keep full
        labels even when crowded), or <code>"ellipsis"</code> (truncate with ellipsis
        under pressure).
      </dd>
    </div>
    <div>
      <dt id="opt-theme"><code>theme</code></dt>
      <dd>
        Bounded presentation overrides for this guide block (<code
          >titleSize</code
        >, <code>labelSize</code>, gaps, colorbar sizes).
      </dd>
    </div>
  </dl>
  <CopyCode
    language="svelte"
    accessibleLabel="Copy GuideAxis Svelte example"
    code={guideAxisExample}
  />

  <h2 id="scale-breaks-labels">Scale breaks and label formats</h2>
  <p>
    Scales choose <em>which</em> ticks exist and <em>how</em> each tick’s text is
    formatted. Guides only decide whether those labels draw and how collisions resolve.
  </p>
  <ul>
    <li>
      <code>breaks</code> — explicit major tick positions in semantic source units
      (numbers, or ISO date strings on time scales). Omit for automatic ticks.
    </li>
    <li>
      <code>minorBreaks</code> — explicit minor gridline positions. A value that
      coincides with a major break draws only the major tick. Time scales use
      <code>dateMinorBreaks</code> instead.
    </li>
    <li>
      <code>labels</code> — format string, not a parallel array. Numeric:
      <code>",d"</code>, <code>".1f"</code>, <code>".0%"</code>,
      <code>"~s"</code>. Time: strftime-style such as <code>"%Y-%m"</code> or
      <code>"%b %d"</code>. Temporal authors usually prefer
      <code>dateLabels</code> + <code>locale</code> over the soft-fallback
      <code>labels</code> field — see
      <a href={`${base}/guide/temporal-scales`}>Dates without preprocessing</a>.
    </li>
  </ul>
  <CopyCode
    language="svelte"
    accessibleLabel="Copy scale breaks example"
    code={scaleBreaksExample}
  />
  <p>
    Explicit breaks outside the trained domain are omitted with
    <a href={`${base}/guide/errors#scale-break-outside-domain`}
      ><code>scale-break-outside-domain</code></a
    >. Major breaks win when major and minor coincide. <code>reverse</code>
    flips pixel direction without reordering semantic ticks.
  </p>

  <h2 id="band-axis-layout">Band axis label layout</h2>
  <p>
    Discrete (band) position scales accept a scale-local
    <code>guide</code> object with band layout fields retained separately from axis
    appearance:
  </p>
  <ul>
    <li>
      <code>mode</code>: <code>"auto"</code> | <code>"single"</code> |
      <code>"wrap"</code> | <code>"rotate"</code> | <code>"off"</code>
    </li>
    <li><code>angle</code> — degrees when mode is <code>"rotate"</code></li>
    <li>
      <code>wrap</code> — max wrapped lines (1–8) when mode is
      <code>"wrap"</code>
    </li>
  </ul>
  <CopyCode
    language="svelte"
    accessibleLabel="Copy band axis guide example"
    code={bandGuideExample}
  />
  <p>
    Top-level guide children still replace a scale-local guide on the same
    channel whole. The shells carry no scale knowledge: wrong guide types fail
    loudly rather than degrading.
  </p>

  <h2 id="builder-and-json">Builder and JSON</h2>
  <p>
    Portable helpers from <code>@ggts-sh/spec</code> match the Svelte shells:
  </p>
  <CopyCode
    language="ts"
    accessibleLabel="Copy guideAxis builder example"
    code={builderGuidesExample}
  />
  <p>
    Attach with fluent <code>.guides(guides)</code> or a
    <code>&lt;Guides value=&#123;guides&#125; /&gt;</code> child. Top-level
    <code>guides</code> win over scale-local <code>guide</code> entries. Two
    guide children on one channel emit <code>DUPLICATE_MERGE_KEY</code>; the
    later child wins.
  </p>

  <h2 id="grid">Grid lines</h2>
  <p>
    Major/minor positions come from scale breaks; whether and how grid lines
    paint is theme: <code>grid</code> color, <code>gridWidth</code>,
    <code>gridDasharray</code>, and boolean <code>gridX</code> /
    <code>gridY</code>. Open the
    <a href={`${base}/themes`}>chart themes</a> surface for named bases and role overrides.
  </p>

  <h2 id="related">Related surfaces</h2>
  <ul>
    <li>
      <a href={`${base}/reference/guides`}>Guides and legends</a> —
      schema-derived props for every guide type including
      <code>GuideAxis</code>.
    </li>
    <li>
      <a href={`${base}/reference/labs`}><code>Labs</code></a> — plot and axis titles.
    </li>
    <li>
      <a href={`${base}/reference/labels`}>Data labels</a> — per-mark text, not tick
      chrome.
    </li>
    <li>
      <a href={`${base}/guide/scales-guides#responsive-guide-presentation`}
        >Responsive guide presentation</a
      >
      — legends, colorbars, and viewport placement.
    </li>
    <li>
      <a href={`${base}/guide/scales-guides#date-and-time-axes`}
        >Date and time axes</a
      >
      — calendar ticks and explicit temporal conventions.
    </li>
    <li>
      <a href={`${base}/guide/errors`}>Errors reference</a> — scale break and guide
      collision diagnostics.
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
