---
name: ggsvelte
description: Build data visualizations with ggsvelte, a grammar-of-graphics charting library (ggplot2 semantics, React and Svelte 5 components, TypeScript builders, JSON specs, headless SVG rendering). Use whenever creating, editing, validating, or debugging charts, plots, graphs, scatter plots, bar charts, histograms, line charts, boxplots, density plots, violins, heatmaps, maps, faceted/small-multiple charts, or data visualization in a JavaScript/TypeScript/React/Svelte project; when code imports from "@ggsvelte/react", "@ggsvelte/svelte", "@ggsvelte/spec", or "@ggsvelte/core"; when composing GGPlot with Geom*/Scale*/Theme*/Facet*/Coord*/Guide*/Labs children; when emitting a ggsvelte plot spec JSON; or when rendering charts server-side/headless to SVG.
---

# ggsvelte

ggplot2’s layered grammar for TypeScript, with headless rendering and React
and Svelte adapters. A chart spec carries the same grammar between surfaces.

## Choose the target

1. Follow the user’s explicit framework choice. Otherwise inspect the target
   application’s package.json and imports. In a mixed monorepo, choose the
   application before generating component code.
2. For a sandbox or an unspecified framework, author PortableSpec JSON or use
   the TypeScript builder; run the CLI before shipping the chart.
3. For React, read [React](references/react.md). For Svelte, read
   [Svelte](references/svelte.md). Keep framework callbacks and host-only
   interactions in that adapter; PortableSpec holds the portable grammar.
4. In every agent sandbox, install `@ggsvelte/cli` and `@ggsvelte/skill`
   at matching local versions and keep the lockfile. Expose
   the installed skill to the agent, refreshing any copied skill on upgrades.
   Run `ggts check chart.json`, apply relevant diagnostics, then
   `ggts render chart.json > chart.svg` and inspect the output. A local npm
   install exposes these commands through `npm exec -- ggts`.

## Registration (call these)

The `@ggsvelte/core` barrel is side-effect-free. Call `registerAll()` once
at startup for every agent-authored JSON, builder, `layers`, or `<GGPlot spec>`
path. It installs the full grammar; both `ggts render` and `ggts check` do
this for you. Missing opt-ins throw `not registered in this build` and name
the required registration. `registerBasic()` alone is insufficient for
specialty stats and Temporal.

Framework geom children self-register their own geom and default stat;
stat overrides still need the matching family. Spec-driven temporal options
need `installTemporal()` or `registerAll()` because there is no Temporal child.
Use the full default for agents. If the user requests a lean bundle, read the
[registration reference](references/registration.md) for the exact family,
color, theme, and headless entry-point rules before selecting imports.

## Mental model

**Everything that composes a plot is a layer in component composition.** Marks _and_ the
seven grammar families (scale, theme, coord, facet, labs, guides, legend)
register as `Layer` kinds via `createPlotLayer` / geom factories. Never call
Scale/Theme/Guide/Labs/Coord/Facet/Legend “non-layers.”

Two serializations of the same grammar:

```text fragment
# React / Svelte composition
plot children = mark layers + grammar layers
  mark    = Geom*  → Layer.kind "mark"
  grammar = Scale* | Theme* | Coord* | Facet* | Labs | Guide* | Legend
            → Layer.kind "scale"|"theme"|"coord"|"facet"|"labs"|"guides"|"legend"

# PortableSpec JSON (agent / headless wire format)
spec = data + aes + layers[]          # layers[] = MARKS ONLY
       + scales? coord? facet? labs? theme? guides? legend?
one mark layer = { geom, stat?, position?, positionParams?, aes?, params?, render?, data? }
```

PortableSpec puts grammar pieces in top-level keys because that is how the
JSON schema folds them — **not** because they are outside the layer model.
“Non-mark layer” / “grammar layer” is correct; “non-layer grammar component”
is wrong and must never appear in issues, docs, or comments.

- **data**: `{"values": [rows]}`, `{"columns": {name: [...]}}`, or
  `{"name": "dataset"}` (resolved from `spec.datasets` or runtime data).
- **mark `layers[]`** draw in order — later marks on top (z-order).
- Geom defaults: bar → count+stack, histogram → bin+stack, col/area →
  identity+stack, boxplot → boxplot+dodge, violin → ydensity+dodge,
  jitter → point+jitter, freqpoly → bin, smooth → smooth, count → sum,
  density → density, hex → bin_hex, everything else identity+identity.

## Aes: JSON specs vs component props

The one rule that differs between the two skins:

| Surface                                     | `x: "displ"` bare string              | canonical                |
| ------------------------------------------- | ------------------------------------- | ------------------------ |
| JSON `PortableSpec` (incl. `spec` prop)     | INVALID                               | `{"field": "displ"}`     |
| React / Svelte `aes` prop (plot or `Geom*`) | valid shorthand, expands to `{field}` | same object form also OK |

Canonical channel forms: `{"field": "col"}` maps a column, `{"value": "red"}`
is a constant, `{"stat": "count"}` reads a stat output, `null` unsets an
inherited channel. Layer aes merges over plot aes per channel.
Channels (25): x, y, color, fill, size, linewidth, alpha, shape, linetype,
group, label, weight, ymin, ymax, xmin, xmax, xend, yend, width, height, z,
map_id, angle, radius, sample. Mapped size/linewidth/alpha/shape/linetype work
only on the geoms in `STYLE_AESTHETIC_GEOMS`.

## The validation contract (use it!)

`validate(spec)` = schema shape. `validate(spec, { profile })` adds data-aware
checks against a `DataProfile` —
`{"fields": [{"name": "displ", "type": "quantitative"}], "rowCount": 234}`
(types: quantitative | temporal | ordinal | nominal). Every error is:

```json fragment
{
  "code": "unknown-field",
  "path": "/layers/0/aes/x",
  "message": "Unknown field \"dsipl\" (available: displ, hwy). Did you mean \"displ\"?",
  "allowed": ["displ", "hwy"],
  "fix": {
    "description": "Map \"x\" to \"displ\".",
    "example": { "field": "displ" }
  }
}
```

**Errors include `fix.example` — apply it at `path` and re-validate.**
`validate(spec, { lint: true })` additionally returns advisories for
valid-but-questionable specs (line over unordered categories, >10 discrete
colors, stacked negative areas, discrete×discrete scatter, transform-domain
mixed-sign data, fractional calendar years on a linear scale); `lintSpec(spec)`
is the standalone equivalent. Advisories never block; fix them when they match
intent. `normalize(input)` canonicalizes
authoring sugar into a `PortableSpec`; `isPortable`/`toPortable` check and
strip runtime-only fields. CLIs: `ggts render spec.json > out.svg`
(from `@ggsvelte/cli`; JSON-line diagnostics on stderr — exit 3 means
validation errors, exit 0 with stderr output means quality warnings worth
fixing) and `ggsvelte-codemod [--write] src` (ships with `@ggsvelte/svelte`).

**CLI coverage for interaction:** the CLI always covers PortableSpec validation,
pipeline warnings/advisories, scale diagnostics (`source: "scale"`), and
spec-lint (`source: "spec-lint"`). Host inspect **mode** is not a PortableSpec
field — without intent the agent loop never sees inspect×geom bar/col guide
codes such as `INTERACTION_INSPECT_X_ON_COL`. When the host will enable inspect,
declare it:

```sh fragment
ggts render --inspect xy spec.json > out.svg
# stderr: kind advisory|warning, source "interaction", bar/col x-guide codes
```

Modes match the host enum (`auto|exact|x|y|xy`). This path covers the pure
bar/col axis-guide collectors only (same codes as host for that slice).
High-cardinality discrete and runtime key/lineage/wiring diagnostics still
require a mounted host's `ondiagnostic`.

## Interactions (host props / children, not PortableSpec fields)

Opt-in host capabilities: `<Inspect />` for tooltips and crosshairs;
`select` / `zoom` on `<GGPlot>`; legend emphasis and data-changing filter via
`<GuideLegend channel="color" focus />` / `filter` (per aesthetic; host-only,
not in `guideLegend()` / PortableSpec). Row identity for selection, legend
focus, and linked views **defaults** to an `id` column when present, else
the row index (order-stable only) — ordinary charts omit custom identity.
Override with `identity` on `<Inspect>`, object-form `select`, or
`createPlotInteraction` when a non-`id` durable field or accessor is needed
(for example `<Inspect identity="year" />`). Plot-level `key` is deprecated
since 0.21. Link plots by sharing one `createPlotInteraction()` controller
and matching `interactionScope` channels; observe everything through
`oninteraction` or per-capability handlers.

**Inspect mode and hit hygiene:** prefer `mode="auto"` when library auto matches
the mark; pin `mode="exact"` (or leave auto) on violin, boxplot, and discrete-axis
error bars — never freescrolling `x`/`y`/`xy` on those band geoms; use
`x`/`y`/`xy` only for continuous shared-axis or free 2d hits; set
`inspect={false}` on decorative layers in multi-layer stories. The CLI SVG
loop cannot validate host inspect mode — hover/pin in a browser after edits.
Read [references/interactions.md](references/interactions.md) (Choosing inspect
mode, Multi-layer hit hygiene) before enabling Inspect or writing interactive
or linked-view code.

## Pointers

- JSON Schema (constrained decoding): `packages/spec/schema/v0.json` in the
  repo, `/schema/v0.json` on the docs site, or
  `import schema from "@ggsvelte/spec/schema/v0.json"`.
- Full corpus for models: `/llms-full.txt` on the docs site (all guide prose
  plus every example with spec JSON and Svelte source); index at `/llms.txt`.
- Error catalog: `/guide/errors`; advisories: `/guide/advisories`;
  lifecycle/editions: `/guide/lifecycle` (specs are stamped with the current
  appearance edition, currently 2). Upgrading off deprecated props:
  `/guide/upgrading`.
- References in this skill — read the one that matches the task:
  [geoms-and-stats.md](references/geoms-and-stats.md) (any geom/stat/position
  beyond the everyday set, annotations),
  [scales-and-palettes.md](references/scales-and-palettes.md) (scale options,
  palettes, temporal),
  [themes.md](references/themes.md) (every product theme name, shells,
  role overrides),
  [composition-surfaces.md](references/composition-surfaces.md) (coords,
  facets, guides, merge semantics),
  [interactions.md](references/interactions.md) (tooltips, selection, linking),
  [recipes.md](references/recipes.md) (long-tail chart recipes).
  Registration calls live in the [registration reference](references/registration.md).

- [Grammar and recipes](references/grammar.md): choose charts, scales, and themes;
  the same recipes work in every adapter.
