import {
  REACT_QUICKSTART_SOURCE,
  SVELTE_QUICKSTART_SOURCE,
  TYPESCRIPT_QUICKSTART_SOURCE,
} from "../agent-quickstart";

/**
 * Getting-started guide section (docs pages + llms surfaces).
 */
import {
  QUICKSTART_BUILDER_FRAGMENT,
  QUICKSTART_CLI_FRAGMENT,
  QUICKSTART_HEADLESS_FRAGMENT,
  QUICKSTART_PAGE_FILENAME,
  QUICKSTART_PAGE_SVELTE,
  QUICKSTART_PORTABLE_SPEC_FRAGMENT,
} from "../quickstart";

export const GETTING_STARTED_MD = `# Getting started

ggsvelte is ggplot2's layered grammar for TypeScript, React, and Svelte 5. A plot is data + an
aesthetic mapping + one or more layers, and every plot normalizes to a
PortableSpec: strict JSON, no functions, no closures. That JSON is the surface
to generate, validate, and correct against.

## Choose your surface

For an agent sandbox, start with the [CLI and skill setup](/guide/agents).
For a browser application, install its adapter. React and Svelte use the
same PortableSpec and grammar; the rest of your application chooses the framework.

## React

\`\`\`sh complete
npm install @ggsvelte/react
\`\`\`

React DOM 18.2 and 19 are supported. In a server-component application, keep
interactive charts behind a client component boundary. Save SalesChart.tsx:

\`\`\`tsx complete
${REACT_QUICKSTART_SOURCE}
\`\`\`

## Svelte

\`\`\`svelte complete
${SVELTE_QUICKSTART_SOURCE}
\`\`\`

## TypeScript

For a script without a browser or framework, install the core and spec packages:

\`\`\`sh complete
npm install @ggsvelte/core @ggsvelte/spec
\`\`\`

Save this complete program as \`chart.ts\`:

\`\`\`ts complete
${TYPESCRIPT_QUICKSTART_SOURCE}
\`\`\`

Run it with Bun to write the SVG:

\`\`\`sh complete
bun chart.ts > chart.svg
\`\`\`

## Svelte install and composition

\`\`\`sh complete
bun add @ggsvelte/svelte @ggsvelte/core
# or: npm install @ggsvelte/svelte @ggsvelte/core
# or: pnpm add @ggsvelte/svelte @ggsvelte/core
\`\`\`

\`@ggsvelte/spec\` (schema, validate, builder) and \`@ggsvelte/core\`
(pipeline, headless render) are dependencies of the Svelte package. Install
them directly when importing their APIs or bundled data. The \`ggts\` CLI is
its own package — install \`@ggsvelte/cli\` in every sandbox where an agent
authors specs, so validation errors and chart-quality warnings surface
before a chart ships. The agent skill is also its own package:
\`@ggsvelte/skill\` (\`SKILL.md\` + \`references/\` at the package root) —
install it and copy/symlink \`node_modules/@ggsvelte/skill\` into the agent's
skills directory as \`ggsvelte/\` (or point the agent at
\`node_modules/@ggsvelte/skill/SKILL.md\` directly). Bundled teaching data
lives at \`@ggsvelte/core/data\`.

## A complete Svelte file

\`${QUICKSTART_PAGE_FILENAME}\`:

\`\`\`svelte complete
${QUICKSTART_PAGE_SVELTE}
\`\`\`

Omitted width follows the container; default height is 400px. No chart CSS is
required. During server rendering the plot uses a deterministic 832 x 400
fallback, then measures the real container after hydration; inside
\`display: none\` or a zero-width track it stays not-ready until the container
has positive width.

## The PortableSpec contract

The same chart as JSON. This is the canonical form — the Svelte component and
the TypeScript builder both normalize to it.

\`\`\`json fragment
${QUICKSTART_PORTABLE_SPEC_FRAGMENT}
\`\`\`

Rules that matter when generating specs:

- Channels are objects, never bare strings: \`{"field": "year"}\` maps a
  column, \`{"value": "#777777"}\` sets a constant, \`null\` unsets a channel
  inherited from the plot-level \`aes\`.
- Data has three forms. \`{"values": [...]}\` inlines rows; \`{"columns": {...}}\`
  is the columnar form; \`{"name": "..."}\` refers to a \`datasets\` entry.
  Inline \`values\` for data small enough to read, \`datasets\` + \`columns\`
  for anything large or shared between layers. Never truncate rows silently —
  say so, or point at the full source.
- \`layers\` is ordered bottom to top and must hold at least one layer. A layer
  may carry its own \`data\`, which then replaces the plot's for that layer.
- Stats are declarative. \`{"geom": "smooth", "params": {"method": "loess"}}\`
  fits in the pipeline; do not precompute a trend column and pass it off as
  raw data.

The full machine-readable contract is /schema/v0.json.

## The validate loop

\`validate(spec)\` checks schema shape; \`validate(spec, { profile })\` adds
data-aware checks without shipping data; \`{ lint: true }\` also returns
advisories for valid-but-questionable specs.

Every error carries a stable \`code\`, a JSON \`path\` into the spec, a
\`message\`, and a \`fix\` naming the change to make. That is the correction
loop: emit, validate, apply the fix at the path, re-emit. Do not guess, and do
not fall back to a different chart — the fix says what is wrong.

\`\`\`ts fragment
import { validate } from "@ggsvelte/spec";

const result = validate(spec);
if (!result.ok) {
  for (const error of result.errors) {
    console.error(error.code, error.path, error.fix);
  }
}
\`\`\`

The complete error catalog, with the fix for each code, is at /guide/errors;
advisories are at /guide/advisories.

## Headless rendering

No browser, no DOM. \`renderToSVGString\` is pure:

\`\`\`ts fragment
${QUICKSTART_HEADLESS_FRAGMENT}
\`\`\`

The installed CLI writes SVG to stdout and JSON Lines diagnostics to stderr,
with exit classes documented at /reference/cli:

\`\`\`sh fragment
${QUICKSTART_CLI_FRAGMENT}
\`\`\`

## Building specs in TypeScript

The fluent builder produces the same PortableSpec, with types:

\`\`\`ts fragment
${QUICKSTART_BUILDER_FRAGMENT}
\`\`\`

## Bundled data

\`@ggsvelte/core/data\` exports seven cited teaching tables (each also served
as JSON under the same name on the docs site):

- \`kyotoSakura\` — 838 peak cherry-blossom dates for Kyoto, 812-2026 CE
  (\`year\`, \`bloomDate\`, \`bloomDoy\`). Time series. Data
  copyright Yasuyuki Aono; cite \`KYOTO_SAKURA_CITATION\`.
- \`palmerPenguins\` — 333 complete Palmer Archipelago penguin measurements
  (\`species\`, \`island\`, bill/flipper/mass, \`sex\`, \`year\`, stable \`id\`).
  Distribution and categorical groups. CC0; cite \`PALMER_PENGUINS_CITATION\`.
- \`mpg\` — 234 EPA fuel-economy rows for 38 popular models, 1999/2008
  (\`manufacturer\`, \`model\`, \`displ\`, \`class\`, \`drv\`, \`cty\`, \`hwy\`, …).
  Categorical comparison. Cite \`MPG_CITATION\`.

- \`chocolateBars\` — 2,530 Flavors of Cacao bar reviews (\`cocoaPercent\`,
  \`rating\`, company location, bean origin). Dense scatter and heatmaps.
  Via TidyTuesday 2022-01-18; cite \`CHOCOLATE_BARS_CITATION\`.
- \`coffeeRatings\` — 1,338 Coffee Quality Institute cupping lots
  (\`totalCupPoints\`, aroma/flavor, origin, processing). Distributions and
  continuous scatter. Via TidyTuesday 2020-07-07; cite \`COFFEE_RATINGS_CITATION\`.
- \`beerProduction\` — 36 US national beer-production totals by package type,
  2008–2019 (\`year\`, \`package\`, \`barrelsMillions\`). Dodged multi-series bars.
  Via TidyTuesday 2020-03-31; cite \`BEER_PRODUCTION_CITATION\`.
- \`fastfoodMenu\` — 515 US fast-food entrée nutrition rows (\`restaurant\`,
  \`calories\`, fat/protein/sodium). Categorical scatter and jitter. Via
  TidyTuesday 2018-09-04; cite \`FASTFOOD_MENU_CITATION\`.

## Grammar vocabulary

- [Geoms](/reference/geoms) — every mark, defaults, stats, positions, and params
- [Guides and legends](/reference/guides) — GuideLegend, colorbar, colorsteps, axis, none
- [Labs](/reference/labs) — title, subtitle, caption, axis/legend titles
- [Axes and ticks](/reference/axes) — GuideAxis, breaks/labels, collision, grids
- [Labels](/reference/labels) — chrome vs ticks vs GeomText/GeomLabel/SF labels
- [Statistics and positions](/guide/statistics-positions) — stats, jitter, stacking
- [Scales](/reference/scales) — every Scale* component (position, color, style)
- [Scales and guides](/guide/scales-guides) — continuous, discrete, manual, temporal
- [Facets and coordinates](/guide/facets-coordinates) — small multiples, flip, fixed aspect
- [Chart themes](/themes) and [palettes](/palettes) — paper/ink chrome and data color
- [Themes reference](/reference/themes) and [palettes reference](/reference/palettes) — props, tokens, scheme → scale helpers
- [Interactions](/guide/interactions) — inspect, pin, selection, zoom, linked views
- [Production](/guide/production) — sizing, SVG/canvas, SSR, export, support matrix
- [Lifecycle](/guide/lifecycle) — what is stable and what is not
`;
