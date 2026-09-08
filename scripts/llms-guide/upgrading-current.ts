/**
 * Current-era upgrade guidance (latest releases, 0.26 onward).
 */

export const UPGRADING_CURRENT_MD = `# Upgrade guide

One section per released 0.x transition, newest first. Each heading is a
stable anchor that changesets and release notes link to. Pre-1.0, breaking
changes ride minor releases; every deprecation or removal ships with a
migration note here.

## Five-minute path

- Check that linked \`@ggts-sh/*\` packages (\`spec\`, \`core\`, \`compose\`, \`react\`, \`svelte\`, \`cli\`, \`skill\`) resolve to one compatible release.
- Read only the adjacent transition sections needed for the installed version.
- Apply the before/after source change backed by the migration fixtures.
- Run strict type, build, render, and visual checks before deploying.
- Follow a stable diagnostic anchor if blocked; roll package versions back together if needed.

The accepted lifecycle and deprecation policy remains in
[Lifecycle and editions](/guide/lifecycle#lifecycle-tags); this page applies it
rather than creating a second policy.

## 0.42 to 0.43

### ggsvelte is now ggts

The seven packages move from \`@ggsvelte/*\` to \`@ggts-sh/*\`. The repository
is \`ggts-sh/ggts\` and the documentation is at [ggts.sh](https://ggts.sh).
The old npm versions remain available. PortableSpec JSON, appearance editions,
builder names, and grammar semantics keep their existing contracts.

Install the packages your application imports, keeping all seven on the same
release. For example, a Svelte application with the local agent feedback loop:

\`\`\`sh complete
npm uninstall @ggsvelte/svelte @ggsvelte/core @ggsvelte/cli @ggsvelte/skill
npm install @ggts-sh/svelte @ggts-sh/core
npm install --save-dev @ggts-sh/cli @ggts-sh/skill
\`\`\`

Use \`@ggts-sh/react\` for a React application. Core and spec can run without
installing either framework. Update imports from \`@ggsvelte/spec\`,
\`@ggsvelte/core\`, \`@ggsvelte/compose\`, \`@ggsvelte/react\`, and
\`@ggsvelte/svelte\` to the matching \`@ggts-sh/*\` package.

Teaching datasets now live at \`@ggts-sh/core/data\`; install core directly
when importing them. \`@ggts-sh/svelte/data\` remains a compatibility re-export.

Replace \`ggsvelte-render chart.json\` with \`ggts render chart.json\`:

\`\`\`sh complete
npm exec -- ggts check chart.json
npm exec -- ggts render chart.json > chart.svg
\`\`\`

Both commands retain JSON Lines diagnostics on stderr and the existing exit
classes. \`check\` runs the rendering checks without writing SVG. The Svelte
migration executable is now \`ggts-codemod\`.

Point agent instructions at \`node_modules/@ggts-sh/skill/SKILL.md\`. The
skill name is now \`ggts\`. Replace any copied skill directory with the new
package contents; dependency upgrades do not refresh a copy. One skill covers
the shared grammar and routes to React or Svelte references.

Keep the updated lockfile, then typecheck, build, render, and verify chart
interactions in a browser. The [complete quickstarts](/guide/getting-started)
and [agent workflow](/guide/agents) exercise the new package names.

Earlier sections describe the pre-rename releases; old names in those notes
refer to the packages published at that time.

## 0.38 to 0.39

### Explicit Temporal registration for spec-driven charts

\`GGPlot\` no longer installs \`@js-temporal/polyfill\` when its module loads.
The numeric scatter fixture drops 59.5 KB gzip as a result.

Temporal scale children such as \`<ScaleXDate>\`, \`<ScaleYDatetime>\`, and
\`<ScaleColorDate>\` install full Temporal parsing and guide planning, so
component-composed temporal charts need no source change. ISO strings with no
explicit temporal options keep the lean UTC inference path.

Charts driven through \`spec\` or \`layers\` have no temporal child to install
the runtime. Call \`installTemporal()\` once before mounting when those charts
use an explicit temporal parser, timezone, date interval, or full Temporal
guide planning. \`registerAll()\` includes the same install.

\`\`\`svelte fragment
<script lang="ts">
  import { GGPlot, installTemporal } from "@ggsvelte/svelte";

  installTemporal();

  const temporalSpec = {
    data: {
      values: [
        { when: "2026-01-01", value: 10 },
        { when: "2026-02-01", value: 20 },
        { when: "2026-03-01", value: 15 },
      ],
    },
    layers: [{ geom: "point" as const, aes: { x: "when", y: "value" } }],
    scales: {
      x: {
        type: "time" as const,
        temporalKind: "date" as const,
      },
    },
  };
</script>

<GGPlot spec={temporalSpec} width={480} height={320} />
\`\`\`

## 0.28 to 0.29

### Removed Tableau 10, Summer, Winter, and stone schemes

Six categorical \`scheme\` names (and matching public \`*_PALETTE\` constants)
are gone:

- \`tableau10\`
- \`tableau_summer\`, \`tableau_winter\`
- \`tableau_miller_stone\`, \`tableau_superfishel_stone\`,
  \`tableau_nuriel_stone\`

Prefer \`observable10\`, \`colorblind\`, \`Dark2\`, \`pander\`, or another
remaining Tableau scheme (\`tableau20\`, \`tableau_colorblind\`,
\`tableau_jewel_bright\`, …), or pass an explicit \`range\`.

\`\`\`json fragment
// Before
{
  "scales": { "color": { "type": "ordinal", "scheme": "tableau10" } }
}
\`\`\`

\`\`\`json fragment
// After
{
  "scales": { "color": { "type": "ordinal", "scheme": "observable10" } }
}
\`\`\`

## 0.27 to 0.28

### Removed spreadsheet, Highcharts, and extra Stata schemes and themes

Nine categorical \`scheme\` names (and the matching public \`*_PALETTE\` constants
from \`@ggsvelte/core\`) are gone:

- \`stata_s1color\`, \`stata_s1rcolor\`, \`stata_mono\`
- \`hc\`, \`hc_dark\`
- \`calc\`, \`excel\`, \`excel_fill\`, \`excel_new\`

A PortableSpec that still names one of those schemes fails validation. Switch
to a remaining scheme — \`stata\`, \`observable10\`, \`Dark2\`, and \`pander\` are
the usual replacements — or pass an explicit \`range\` of hex color stops.

Four chart **themes** are also gone: \`stata_mono\`, \`calc\`, \`excel\`, and
\`excel_new\` (and their Svelte shells \`ThemeStatamono\`, \`ThemeCalc\`,
\`ThemeExcel\`, \`ThemeExcelnew\`). Prefer \`stata\`, \`stata_s1color\`, \`bw\`,
\`classic\`, or \`minimal\`.

\`\`\`json fragment
// Before: scheme / theme names that no longer validate
{
  "theme": "excel_new",
  "scales": { "color": { "type": "ordinal", "scheme": "excel_new" } }
}
\`\`\`

\`\`\`json fragment
// After: pick remaining theme + scheme (or an explicit color range)
{
  "theme": "minimal",
  "scales": { "color": { "type": "ordinal", "scheme": "observable10" } }
}
\`\`\`

### Removed Accent, Paired, Grey, Google Docs, and Tableau multi-hue schemes

Eight more categorical \`scheme\` names (and matching public \`*_PALETTE\`
constants where they existed) are gone:

- \`Accent\`, \`Paired\`
- \`grey\`, \`gray\`
- \`gdocs\`
- \`tableau_green_orange_teal\`, \`tableau_red_blue_brown\`,
  \`tableau_purple_pink_gray\`

Theme \`gdocs\` (and Svelte shell \`ThemeGdocs\`) is also gone. Prefer
\`minimal\`, \`classic\`, or \`bw\`.

\`scaleColorGrey()\` / \`<ScaleColorGrey />\` still work: they bake an explicit
greyscale \`range\` (optional \`start\`/\`end\`). They no longer emit
\`scheme: "grey"\`.

\`\`\`json fragment
// Before
{
  "theme": "gdocs",
  "scales": { "color": { "type": "ordinal", "scheme": "Accent" } }
}
\`\`\`

\`\`\`json fragment
// After
{
  "theme": "minimal",
  "scales": { "color": { "type": "ordinal", "scheme": "Dark2" } }
}
\`\`\`

`;
