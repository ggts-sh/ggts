<script lang="ts">
  import { base } from "$app/paths";

  import {
    THEME_COLOR_ROLES,
    THEME_SHELLS,
    THEME_TYPE_AND_GEOMETRY_ROLES,
  } from "$lib/catalog/theme-reference";
  import CopyCode from "$lib/components/CopyCode.svelte";

  // Join so the example's closing script tag does not terminate this module.
  const namedExample = [
    '<script lang="ts">',
    '  import { GeomPoint, GGPlot, ThemeDark } from "@ggts-sh/svelte";',
    "",
    "  const rows = [",
    "    { x: 1, y: 2 },",
    "    { x: 2, y: 4 },",
    "  ];",
    ["</", "script>"].join(""),
    "",
    '<GGPlot data={rows} aes={{ x: "x", y: "y" }}>',
    "  <GeomPoint />",
    '  <ThemeDark ink="#f5f5f5" tooltipPaper="#1a1a1a" tooltipInk="#f5f5f5" />',
    "</GGPlot>",
  ].join("\n");

  const genericExample = `<Theme name={activeTheme} paper="none" focusRing="#ffcc00" />`;
</script>

<article class="theme-reference prose" aria-labelledby="theme-ref-heading">
  <h1 id="theme-ref-heading">Themes</h1>
  <p>
    Chart themes style paper, ink, axes, type, and interaction chrome. Compose a
    declaration-only child under <code>&lt;GGPlot&gt;</code> — a named shell
    such as
    <code>&lt;ThemeMinimal /&gt;</code>, or the generic
    <code>&lt;Theme name=&#123;…&#125; /&gt;</code> escape hatch. Themes do not
    encode data colors; those come from
    <a href={`${base}/reference/palettes`}>palette schemes on color scales</a>.
  </p>
  <p>
    Visual portraits of every built-in live on the
    <a href={`${base}/themes`}>Themes showcase</a>.
  </p>

  <h2 id="components">Components</h2>
  <p>
    Named shells fix the base theme. Every shell accepts the same optional role
    overrides as props (<code>ink</code>, <code>paper</code>,
    <code>tooltipPaper</code>, …). The generic <code>&lt;Theme&gt;</code> also
    accepts <code>name</code> for a reactive base.
  </p>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th scope="col">PortableSpec name</th>
          <th scope="col">Svelte component</th>
          <th scope="col">Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>(dynamic)</code></td>
          <td><code>Theme</code></td>
          <td>Escape hatch: <code>name</code> + role overrides.</td>
        </tr>
        {#each THEME_SHELLS as shell (shell.name)}
          <tr>
            <td><code>{shell.name}</code></td>
            <td><code>{shell.component}</code></td>
            <td>
              {#if shell.aliasOf !== undefined}
                Alias of <code>{shell.aliasOf}</code> (same token map).
              {:else}
                Named base.
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <h2 id="usage">Usage</h2>
  <p>
    One theme child per plot. Composition is <strong>replace</strong>: if you
    declare two theme children, the last one wins. Role overrides merge onto the
    named base — unset roles keep the built-in values.
  </p>
  <CopyCode
    language="svelte"
    accessibleLabel="Copy theme override example"
    code={namedExample}
  />
  <p>Reactive base name:</p>
  <CopyCode
    language="svelte"
    accessibleLabel="Copy generic Theme example"
    code={genericExample}
  />

  <h2 id="color-and-interaction-roles">Color and interaction roles</h2>
  <p>
    These props are CSS colors (or, for <code>interactionMuted</code>, a 0–1
    opacity). Color roles ride <code>--gg-*</code> custom properties so a host
    can restyle without re-authoring the plot. Interaction roles also publish
    <code>--gg-theme-*</code> on the plot root for tool rails, tooltips, focus
    rings, and selection chrome — keep <code>tooltipPaper</code> /
    <code>tooltipInk</code> and <code>interactionInk</code> contrasty so
    recovery controls like legend <strong>Clear</strong> stay readable on dark bases.
  </p>
  <p>
    Named bases that share paper and panel paint elevated tooltip chrome so tips
    read as a card off the chart surface:
    <code>solarized</code>, <code>solarized_2</code>,
    <code>solarizeddark</code>, <code>solarized_2dark</code>,
    <code>dark</code>, <code>hcdark</code>, <code>fivethirtyeight</code>, and
    <code>economist</code>. A <code>ThemeSpec</code> object or named shell that
    only overrides non-tip roles keeps that elevated package unless
    <code>tooltipPaper</code>, <code>tooltipInk</code>, or
    <code>tooltipBorder</code> is set.
  </p>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th scope="col">Prop</th>
          <th scope="col">Kind</th>
          <th scope="col">Affects</th>
          <th scope="col">CSS</th>
        </tr>
      </thead>
      <tbody>
        {#each THEME_COLOR_ROLES as role (role.name)}
          <tr>
            <td><code>{role.name}</code></td>
            <td>{role.kind}</td>
            <td>{role.affects}</td>
            <td><code>{role.css}</code></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <h2 id="type-and-geometry-roles">Type and geometry roles</h2>
  <p>
    Sizes are in CSS px unless noted. Boolean flags blank axis/grid pieces
    (void-style themes turn labels and grids off).
  </p>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th scope="col">Prop</th>
          <th scope="col">Kind</th>
          <th scope="col">Affects</th>
        </tr>
      </thead>
      <tbody>
        {#each THEME_TYPE_AND_GEOMETRY_ROLES as role (role.name)}
          <tr>
            <td><code>{role.name}</code></td>
            <td>{role.kind}</td>
            <td>{role.affects}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <h2 id="safe-overrides">Safe overrides</h2>
  <ul>
    <li>
      Prefer typed theme props (<code>&lt;ThemeDark paper="#0b0b0b" /&gt;</code
      >) when authoring in Svelte — values land in PortableSpec and stay
      edition-stable.
    </li>
    <li>
      Host CSS on <code>--gg-ink</code>, <code>--gg-paper</code>, and the other
      <code>--gg-*</code> roles works without a re-render; only override roles you
      intend to change.
    </li>
    <li>
      Never treat <code>interactionMuted</code> as a color — it is a numeric alpha
      applied to de-emphasized marks.
    </li>
    <li>
      When you darken <code>paper</code> / <code>panel</code>, also set
      <code>tooltipPaper</code>, <code>tooltipInk</code>,
      <code>interactionInk</code>, and <code>focusRing</code> so inspect chrome and
      legend Clear keep contrast.
    </li>
    <li>
      Themes style chrome only. Data series colors use
      <a href={`${base}/reference/palettes`}>named palette schemes</a> on
      <code>ScaleColor*</code> / <code>ScaleFill*</code> children.
    </li>
  </ul>

  <h2 id="see-also">See also</h2>
  <ul>
    <li>
      <a href={`${base}/themes`}>Themes showcase</a> — live portraits of every built-in
    </li>
    <li>
      <a href={`${base}/reference/palettes`}>Palettes reference</a> — scheme names
      as scale inputs
    </li>
    <li>
      <a href={`${base}/guide/scales-guides`}>Scales and guides</a> — position, color,
      and legend channels
    </li>
    <li>
      <a href={`${base}/guide/upgrading#compose-the-theme-as-a-child-layer`}
        >Upgrade guide</a
      >
      — theme child migration
    </li>
  </ul>
</article>

<style>
  .theme-reference {
    max-width: 52rem;
    margin: 2rem 0 4rem;
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
</style>
