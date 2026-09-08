<script lang="ts">
  import { base } from "$app/paths";
</script>

<article class="reference-landing" aria-labelledby="reference-heading">
  <header>
    <h1 id="reference-heading">Reference</h1>
    <p>
      Public contracts for geoms, guides, labs, axes, labels, interactions, CLI,
      diagnostics, lifecycle, and schema.
    </p>
  </header>

  <nav aria-label="Reference sections">
    <a href={`${base}/reference/geoms`}>
      <strong>Geoms</strong>
      <span
        >Every Geom* component: defaults, stats, positions, and params from the
        schema.</span
      >
    </a>
    <a href={`${base}/reference/stats`}>
      <strong>Stats</strong>
      <span
        >Every statistical transform: after_stat columns and compatible geoms.</span
      >
    </a>
    <a href={`${base}/reference/positions`}>
      <strong>Positions</strong>
      <span
        >Every position adjustment: stack, dodge, jitter params, and compatible
        geoms.</span
      >
    </a>
    <a href={`${base}/reference/scales`}>
      <strong>Scales</strong>
      <span
        >Every Scale* component: position, color/fill, and style channels with
        params and guides.</span
      >
    </a>
    <a href={`${base}/reference/coords`}>
      <strong>Coords</strong>
      <span
        >Every Coord* shell: cartesian, flip, transform, fixed, and sf with
        helpers and props.</span
      >
    </a>
    <a href={`${base}/reference/guides`}>
      <strong>Guides and legends</strong>
      <span
        >GuideLegend, GuideColorbar, GuideColorsteps, GuideAxis, and GuideNone:
        channels, props, and helpers.</span
      >
    </a>
    <a href={`${base}/reference/labs`}>
      <strong>Labs</strong>
      <span
        >Title, subtitle, caption, and per-aesthetic axis/legend titles.</span
      >
    </a>
    <a href={`${base}/reference/axes`}>
      <strong>Axes and ticks</strong>
      <span
        >GuideAxis, scale breaks/labels, band layout, collision, and theme
        grids.</span
      >
    </a>
    <a href={`${base}/reference/labels`}>
      <strong>Labels</strong>
      <span
        >Plot chrome vs tick labels vs GeomText / GeomLabel / SF label geoms.</span
      >
    </a>
    <a href={`${base}/reference/interactions`}>
      <strong>Interaction reference</strong>
      <span>Capabilities, events, diagnostics, accessibility defaults.</span>
    </a>
    <a href={`${base}/reference/themes`}>
      <strong>Themes</strong>
      <span
        >Theme* components, role tokens, CSS variables, and interaction chrome.</span
      >
    </a>
    <a href={`${base}/reference/palettes`}>
      <strong>Palettes</strong>
      <span
        >Named schemes as scale inputs: categorical and sequential catalogs.</span
      >
    </a>
    <a href={`${base}/reference/cli`}>
      <strong>CLI reference</strong>
      <span>Flags, streams, diagnostics, exit classes.</span>
    </a>
    <a href={`${base}/guide/errors`}>
      <strong>Errors reference</strong>
      <span>Validation, pipeline, interaction, and CLI diagnostics.</span>
    </a>
    <a href={`${base}/guide/advisories`}>
      <strong>Advisories</strong>
      <span>Valid-but-questionable specs and disclosed heuristics.</span>
    </a>
    <a href={`${base}/guide/lifecycle`}>
      <strong>Lifecycle and editions</strong>
      <span>Stability tags and defaults-edition behavior.</span>
    </a>
    <a href={`${base}/kyoto-sakura.json`}>
      <strong><code>@ggts-sh/core/data</code></strong>
      <span>
        Bundled datasets. <code>kyotoSakura</code>, <code>palmerPenguins</code>,
        <code>mpg</code>, <code>chocolateBars</code>,
        <code>coffeeRatings</code>,
        <code>beerProduction</code>, <code>fastfoodMenu</code>. Also served as
        JSON.
      </span>
    </a>
    <a href={`${base}/schema/v0.json`}>
      <strong>PortableSpec JSON Schema</strong>
      <span>Machine-readable constrained specification.</span>
    </a>
  </nav>
</article>

<style>
  header {
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--line);
  }

  h1 {
    margin: 0;
    font-size: clamp(3rem, 7vw, 6rem);
    line-height: 0.9;
    letter-spacing: -0.04em;
  }

  header p {
    max-width: 42rem;
    margin: 1.25rem 0 0;
    color: var(--muted);
    font-size: 1.05rem;
  }

  nav {
    display: grid;
    margin-top: 2rem;
  }

  /*
   * Borders between list rows only. The last link must not draw a bottom
   * rule — DocsShell's .prev-next already has border-top, and a trailing
   * row border stacked a second separator under PortableSpec (and every
   * other final reference entry).
   */
  nav a {
    display: grid;
    min-height: 5rem;
    align-content: center;
    padding: 1rem 0;
    color: var(--ink);
    text-decoration: none;
    gap: 0.35rem;
  }

  nav a + a {
    border-top: 1px solid var(--line);
  }

  nav strong {
    font-family: var(--display-font);
    font-size: 1.1rem;
  }

  nav a:hover strong {
    text-decoration: underline;
  }

  nav span {
    color: var(--muted);
  }
</style>
