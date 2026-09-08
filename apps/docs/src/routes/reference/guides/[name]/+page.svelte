<script lang="ts">
  import { base } from "$app/paths";

  import ReferenceLede from "$lib/components/ReferenceLede.svelte";

  import type { PageProps } from "./$types";

  const { data }: PageProps = $props();
  const entry = $derived(data.entry);

  const primaryChannel = $derived(entry.channels[0] ?? "color");

  const optionProps = $derived(
    entry.params
      .filter((p) => p.name !== "theme")
      .slice(0, 3)
      .map((p) => {
        if (p.name === "position") return 'position="bottom"';
        if (p.name === "direction") return 'direction="horizontal"';
        if (p.name === "showTicks") return "showTicks={false}";
        if (p.name === "showLabels") return "showLabels={false}";
        if (p.name === "title") return `title="Label"`;
        if (p.name === "keySize") return "keySize={14}";
        if (p.name === "order") return "order={1}";
        if (p.name === "force") return "force={true}";
        if (p.name === "collision") return 'collision="ellipsis"';
        return `${p.name}={…}`;
      }),
  );

  const shellAttrs = $derived(
    entry.name === "none"
      ? `channel="${primaryChannel}"`
      : [`channel="${primaryChannel}"`, ...optionProps.slice(0, 2)].join(" "),
  );

  const svelteSnippet = $derived(
    `import { GGPlot, GeomPoint, ${entry.component} } from "@ggts-sh/svelte";\n\n<GGPlot data={rows} aes={{ x: "displ", y: "hwy", color: "class" }}>
  <GeomPoint />
  <${entry.component} ${shellAttrs} />
</GGPlot>`,
  );

  const helperArgs = $derived(
    entry.name === "none"
      ? ""
      : optionProps.length === 0
        ? ""
        : `{ ${optionProps
            .slice(0, 2)
            .map((a) => {
              // Convert prop attrs to object fields for the helper call.
              if (a.includes("={")) {
                const [k, v] = a.split("={");
                return `${k}: ${v?.replace(/}$/, "")}`;
              }
              const m = a.match(/^(\w+)="([^"]*)"$/);
              if (m) return `${m[1]}: "${m[2]}"`;
              return a;
            })
            .join(", ")} }`,
  );

  const helperSnippet = $derived(
    entry.name === "none"
      ? `import { ${entry.helper}, guides } from "@ggts-sh/spec";\n\nguides({ ${primaryChannel}: ${entry.helper}() })\n// → { guides: { ${primaryChannel}: { type: "none" } } }`
      : `import { ${entry.helper}, guides } from "@ggts-sh/spec";\n\nguides({ ${primaryChannel}: ${entry.helper}(${helperArgs}) })\n// → { guides: { ${primaryChannel}: { type: "${entry.typeLiteral}", … } } }`,
  );

  const jsonSnippet = $derived(
    entry.name === "none"
      ? `{\n  "guides": {\n    "${primaryChannel}": { "type": "none" }\n  }\n}`
      : `{\n  "guides": {\n    "${primaryChannel}": {\n      "type": "${entry.typeLiteral}"${
          optionProps[0]?.includes('position="bottom"')
            ? ',\n      "position": "bottom"'
            : optionProps[0]?.includes("showTicks")
              ? ',\n      "showTicks": false'
              : ""
        }\n    }\n  }\n}`,
  );
</script>

<article class="guide-detail prose" aria-labelledby="guide-heading">
  <h1 id="guide-heading"><code>{entry.component}</code></h1>
  <ReferenceLede text={entry.summary} />

  <h2 id="channels">Channels</h2>
  <p>
    Bind this guide with the shell <code>channel</code> prop (or the matching
    key under <code>guides</code> in JSON). Only these aesthetics validate:
  </p>
  <ul class="token-list">
    {#each entry.channels as channel (channel)}
      <li><code>{channel}</code></li>
    {/each}
  </ul>
  {#if entry.name === "legend"}
    <p>
      On <code>color</code> / <code>fill</code>, a discrete or ordinal scale is
      required. Sequential scales need
      <a href={`${base}/reference/guides/colorbar`}
        ><code>GuideColorbar</code></a
      >; binned scales need
      <a href={`${base}/reference/guides/colorsteps`}
        ><code>GuideColorsteps</code></a
      >. Positional <code>x</code> / <code>y</code> use
      <a href={`${base}/reference/guides/axis`}><code>GuideAxis</code></a>.
    </p>
  {:else if entry.name === "colorbar"}
    <p>
      Valid when the color or fill scale is sequential (or left to default
      continuous training). Discrete legends use
      <a href={`${base}/reference/guides/legend`}><code>GuideLegend</code></a>;
      binned scales use
      <a href={`${base}/reference/guides/colorsteps`}
        ><code>GuideColorsteps</code></a
      >.
    </p>
  {:else if entry.name === "colorsteps"}
    <p>
      Valid when the color or fill scale type is <code>binned</code>. Discrete
      categories use
      <a href={`${base}/reference/guides/legend`}><code>GuideLegend</code></a>;
      continuous ramps use
      <a href={`${base}/reference/guides/colorbar`}
        ><code>GuideColorbar</code></a
      >.
    </p>
  {:else if entry.name === "axis"}
    <p>
      Only <code>x</code> and <code>y</code>. Style aesthetics never accept an
      axis guide — use legend, colorbar, colorsteps, or none instead.
    </p>
  {:else if entry.name === "none"}
    <p>
      Suppress any aesthetic's guide while keeping the scale mapping. Common for
      hiding a size or shape legend.
    </p>
  {/if}

  <h2 id="svelte">Svelte component</h2>
  <pre class="snippet"><code>{svelteSnippet}</code></pre>

  <h2 id="json">JSON and helpers</h2>
  <pre class="snippet"><code>{helperSnippet}</code></pre>
  <pre class="snippet"><code>{jsonSnippet}</code></pre>
  <p class="meta-note">
    Helper: <code>{entry.helper}</code> (alias
    <code>{entry.helperAlias}</code>). Schema type:
    <code>{entry.schemaType}</code>. Portable
    <code>type</code>: <code>"{entry.typeLiteral}"</code>.
  </p>

  <h2 id="props">Props</h2>
  <p>
    Every shell takes a required <code>channel</code> prop (not part of the
    portable guide object — it is the key under <code>guides</code>). Options
    below map 1:1 to the guide JSON fields.
  </p>
  <dl class="param-list">
    <div>
      <dt id="param-channel">
        <code>channel</code>
        <span class="badge">required</span>
      </dt>
      <dd>
        <p class="type">
          <code
            >{entry.channels.map((c) => `"${c}"`).join(" | ") ||
              "GuideChannel"}</code
          >
        </p>
        <p>
          Aesthetic this guide configures. Must be one of the channels listed
          above.
        </p>
      </dd>
    </div>
    {#each entry.params as param (param.name)}
      <div>
        <dt id={`param-${param.name}`}>
          <code>{param.name}</code>
          {#if param.required}
            <span class="badge">required</span>
          {/if}
        </dt>
        <dd>
          <p class="type"><code>{param.typeSummary}</code></p>
          <p>{param.description}</p>
        </dd>
      </div>
    {/each}
  </dl>
  {#if entry.params.length === 0}
    <p>
      <code>{entry.component}</code> has no option props beyond
      <code>channel</code>.
    </p>
  {/if}

  {#if entry.name === "legend"}
    <h2 id="legend-focus">Legend focus and filter</h2>
    <p>
      Opt in per aesthetic with <code>focus</code> and/or
      <code>filter</code> on this component (for example
      <code>&lt;GuideLegend channel="color" focus filter /&gt;</code>). Discrete
      color and fill legends host HTML controls for preview/commit focus and
      Show-group filter checkboxes. Clear legend focus removes presentation
      emphasis only — it does not reset filter clauses or data. See the
      <a href={`${base}/guide/interaction-reference#legendfocus`}
        >interaction reference</a
      >
      and
      <a href={`${base}/examples/interaction/legend-focus`}
        >legend focus example</a
      >.
    </p>
  {/if}

  <p class="back">
    <a href={`${base}/reference/guides`}>← All guides</a>
    ·
    <a href={`${base}/reference/positions`}>Positions</a>
    ·
    <a href={`${base}/guide/scales-guides`}>Scales and guides</a>
  </p>
</article>

<style>
  .guide-detail {
    max-width: 52rem;
    margin: 2rem 0 4rem;
  }

  h1 {
    margin: 0 0 0.5rem;
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

  .snippet + .snippet {
    margin-top: 0.75rem;
  }

  .meta-note {
    margin-top: 0.75rem;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .param-list {
    margin: 1rem 0 0;
  }

  .param-list > div {
    display: grid;
    grid-template-columns: minmax(8rem, 0.28fr) minmax(0, 1fr);
    gap: 1rem;
    padding: 0.85rem 0;
    border-top: 1px solid var(--line);
  }

  .param-list > div:last-child {
    border-bottom: 1px solid var(--line);
  }

  .param-list dt {
    font-weight: 600;
  }

  .param-list dd {
    margin: 0;
  }

  .param-list .type {
    margin: 0 0 0.35rem;
    color: var(--muted);
    font-size: 0.88rem;
  }

  .param-list p {
    margin: 0;
  }

  .badge {
    display: inline-block;
    margin-left: 0.35rem;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ink) 8%, transparent);
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    vertical-align: middle;
  }

  .token-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
  }

  .back {
    margin-top: 2.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
    color: var(--muted);
  }
</style>
