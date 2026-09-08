<script lang="ts">
  import { base } from "$app/paths";

  import {
    CATEGORICAL_SCHEME_REFS,
    PALETTE_HELPER_GROUPS,
    SEQUENTIAL_SCHEME_REFS,
  } from "$lib/catalog/palette-reference";
  import {
    categoricalSwatchFor,
    chooserSchemeFor,
    sequentialSwatchFor,
  } from "$lib/catalog/palette-ref-swatches";
  import CopyCode from "$lib/components/CopyCode.svelte";
  import SchemeStrip from "$lib/components/SchemeStrip.svelte";

  // Join so the example's closing script tag does not terminate this module.
  const discreteExample = [
    '<script lang="ts">',
    "  import {",
    "    GeomPoint,",
    "    GGPlot,",
    "    ScaleColorDiscrete,",
    '  } from "@ggts-sh/svelte";',
    "",
    "  const rows = [",
    '    { x: 1, y: 2, species: "a" },',
    '    { x: 2, y: 4, species: "b" },',
    "  ];",
    ["</", "script>"].join(""),
    "",
    '<GGPlot data={rows} aes={{ x: "x", y: "y", color: "species" }}>',
    "  <GeomPoint />",
    '  <ScaleColorDiscrete scheme="observable10" />',
    "</GGPlot>",
  ].join("\n");

  const sequentialExample = [
    `<ScaleColorContinuous scheme="viridis" />`,
    `<!-- or family shell: -->`,
    `<ScaleColorViridisC option="magma" />`,
  ].join("\n");
</script>

<article class="palette-reference prose" aria-labelledby="palette-ref-heading">
  <h1 id="palette-ref-heading">Palettes</h1>
  <p>
    Named color schemes are <strong>scale inputs</strong>, not themes. Pass a
    scheme name into a color or fill scale child to encode data series. Chart
    paper and axes stay on
    <a href={`${base}/reference/themes`}>themes</a>.
  </p>
  <p>
    Every scheme shows its swatch inline below. Select a categorical swatch to
    preview it on a chart on the
    <a href={`${base}/palettes`}>Palettes showcase</a>; sequential ramps live on
    <a href={`${base}/palettes/ramps`}>Sequential color ramps</a>.
  </p>

  <h2 id="using-schemes">Using schemes</h2>
  <p>
    Categorical names pair with discrete / ordinal scales. Sequential names pair
    with continuous, binned, or discrete-sampled viridis shells. A scheme from
    the wrong family is a validation error (<code>scale-scheme-type</code>).
  </p>
  <CopyCode
    language="svelte"
    accessibleLabel="Copy discrete palette example"
    code={discreteExample}
  />
  <CopyCode
    language="svelte"
    accessibleLabel="Copy sequential palette example"
    code={sequentialExample}
  />

  <h2 id="helper-map">Scale helpers</h2>
  {#each PALETTE_HELPER_GROUPS as group (group.id)}
    <h3 id={group.id}>{group.title}</h3>
    <p>{group.summary}</p>
    <ul class="shell-list">
      {#each group.shells as shell (shell)}
        <li><code>&lt;{shell} /&gt;</code></li>
      {/each}
    </ul>
  {/each}
  <p>
    British <code>Colour</code> aliases export the same components (<code
      >ScaleColourDiscrete</code
    >, …). Snake_case builder helpers (<code>scale_color_discrete</code>) accept
    the same options.
  </p>

  <h2 id="categorical-schemes">Categorical schemes</h2>
  <p>
    Use with <code>ScaleColorDiscrete</code>, <code>ScaleFillDiscrete</code>,
    ordinal shells, or family-specific helpers. Default when unset:
    <code>observable10</code>.
  </p>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th scope="col">scheme</th>
          <th scope="col">swatch</th>
          <th scope="col">Primary helpers</th>
          <th scope="col">Notes</th>
        </tr>
      </thead>
      <tbody>
        {#each CATEGORICAL_SCHEME_REFS as entry (entry.name)}
          {@const swatch = categoricalSwatchFor(entry.name)}
          {@const chooserScheme = chooserSchemeFor(entry.name)}
          <tr>
            <td><code>{entry.name}</code></td>
            <td class="swatch-cell">
              {#if swatch !== null}
                <SchemeStrip
                  colors={swatch}
                  href={chooserScheme !== null
                    ? `${base}/palettes?scheme=${chooserScheme}`
                    : null}
                  label={entry.name}
                />
              {:else}
                —
              {/if}
            </td>
            <td>
              {#each entry.helpers.slice(0, 4) as helper, i (helper)}
                {#if i > 0},
                {/if}<code>{helper}</code>
              {/each}
              {#if entry.helpers.length > 4}
                <span class="more">+{entry.helpers.length - 4}</span>
              {/if}
            </td>
            <td>{entry.notes ?? "—"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <h2 id="sequential-schemes">Sequential schemes</h2>
  <p>
    Use with continuous / binned color scales, viridis family shells,
    ColorBrewer distiller/fermenter, or discrete sampling of a viridis ramp (<code
      >ScaleColorViridisD</code
    >).
  </p>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th scope="col">scheme</th>
          <th scope="col">swatch</th>
          <th scope="col">Primary helpers</th>
          <th scope="col">Notes</th>
        </tr>
      </thead>
      <tbody>
        {#each SEQUENTIAL_SCHEME_REFS as entry (entry.name)}
          {@const swatch = sequentialSwatchFor(entry.name)}
          <tr>
            <td><code>{entry.name}</code></td>
            <td class="swatch-cell">
              {#if swatch !== null}
                <SchemeStrip
                  colors={swatch}
                  href={`${base}/palettes/ramps`}
                  label={entry.name}
                />
              {:else}
                —
              {/if}
            </td>
            <td>
              {#each entry.helpers.slice(0, 4) as helper, i (helper)}
                {#if i > 0},
                {/if}<code>{helper}</code>
              {/each}
              {#if entry.helpers.length > 4}
                <span class="more">+{entry.helpers.length - 4}</span>
              {/if}
            </td>
            <td>{entry.notes ?? "—"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <h2 id="see-also">See also</h2>
  <ul>
    <li>
      <a href={`${base}/palettes`}>Palettes showcase</a> — preview any categorical
      scheme on a chart
    </li>
    <li>
      <a href={`${base}/palettes/ramps`}>Sequential color ramps</a> — every sequential
      ramp, plus scale behavior on a chart
    </li>
    <li>
      <a href={`${base}/reference/themes`}>Themes reference</a> — paper, ink, and
      interaction chrome
    </li>
    <li>
      <a href={`${base}/guide/scales-guides`}>Scales and guides</a> — channels, exhaustion,
      and guide presentation
    </li>
    <li>
      <a href={`${base}/guide/errors#palette-exhausted`}>palette-exhausted</a> — when
      a discrete domain outruns the finite palette
    </li>
  </ul>
</article>

<style>
  .palette-reference {
    max-width: 52rem;
    margin: 2rem 0 4rem;
  }

  .shell-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem 1rem;
    margin: 0.75rem 0 1.5rem;
    padding: 0;
    list-style: none;
  }

  .shell-list li {
    margin: 0;
  }

  .table-wrap {
    overflow-x: auto;
    margin: 1.25rem 0 1.75rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92rem;
  }

  th,
  td {
    text-align: left;
    vertical-align: top;
    padding: 0.55rem 0.65rem 0.55rem 0;
    border-top: 1px solid var(--line);
  }

  thead th {
    border-top: none;
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  tbody tr:last-child td {
    border-bottom: 1px solid var(--line);
  }

  td code {
    white-space: nowrap;
  }

  .swatch-cell {
    width: 7rem;
    min-width: 6rem;
    vertical-align: middle;
  }

  .more {
    color: var(--muted);
    margin-left: 0.25rem;
  }

  @media (max-width: 40rem) {
    .shell-list {
      grid-template-columns: 1fr;
    }
  }
</style>
