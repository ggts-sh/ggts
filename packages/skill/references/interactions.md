<!-- Source of truth: packages/svelte/src/lib/plot-props.ts, packages/svelte/src/lib/interaction/ (controller, config, diagnostics), packages/svelte/src/lib/index.ts. -->

# Svelte interactions

`@ggts-sh/svelte` requires Svelte `^5.33.1` (peerDependency). Interactions are
opt-in host capabilities — they are not PortableSpec fields. Prefer declaration
children where they exist (`<Inspect>`, `<GuideLegend focus>`). Row identity for
selection, legend focus, and coordinated intervals **defaults** to an `id`
column when present, otherwise the row index (order-stable only) — ordinary
charts omit custom identity. Prefer `identity` on `<Inspect>`, object-form
`select`, or `createPlotInteraction` for a non-`id` durable field or accessor
(for example `<Inspect identity="year" />`). Plot-level `key` is deprecated.

## Inspect capability (preferred: child)

```svelte fragment
<script lang="ts">
  import { GeomPoint, GGPlot, Inspect } from "@ggts-sh/svelte";
</script>

<GGPlot data={rows} aes={{ x: "x", y: "y" }}>
  <GeomPoint />
  <Inspect mode="xy" />
</GGPlot>
```

Empty `<Inspect />` enables defaults. Options match `InspectOptions`: `mode`,
`pin`, `maxDistance`, `contentMode`, `muteSiblings`, `tooltipTotal`, `identity`
(column or accessor), `content` (Snippet). Prefer the child form in new code;
the GGPlot `inspect` prop is a dual-read alias, not the primary teaching surface.

### Inspect mode by geom family

Leave `mode` as `"auto"` (or set `"exact"`) unless the chart needs axis-group
hover on a continuous series. **Never put `x` / `y` / `xy` guides on violin,
boxplot, errorbar, linerange, pointrange, or crossbar** — those marks sit on a
discrete band; freescrolling guides cut the mark body and often leave the band
tooltip row blank. Prefer exact mark focus (click/hover the violin or interval
itself). The same rule already applies to bar/col. Explicit axis guides on
those families emit advisories (`INTERACTION_INSPECT_AXIS_ON_*`,
`INTERACTION_INSPECT_X_ON_COL` / `_BAR`).

### Mark eligibility (opt-out)

Layers are inspectable by default. Set `inspect={false}` on a geom (or
`"inspect": false` in the portable layer) so decorative bands, labels, or
full-panel rects never become tooltip targets (#1065 / #1068). This is portable
and unrelated to the host `<Inspect>` capability.

## Choosing inspect mode

`mode` is a **host** option on `<Inspect>` (and the dual-read plot `inspect`
alias). It is **not** a PortableSpec field. Empty `<Inspect />` defaults to
`mode="auto"`. Auto matches common mark families (bar/col/violin/boxplot/
interval geoms → exact; continuous lines → x). Prefer auto unless geometry
needs an explicit axis-group or free 2d mode.

### Default preference

1. Prefer `mode="auto"` when library auto matches the mark (bar, col, tile, point,
   violin, boxplot, interval geoms, continuous line/area/freqpoly). Prefer an
   explicit mode when you know the geometry better than auto.
2. Use `mode="x"` only for continuous shared-x series: time series, multi-series
   lines/areas/freqpolys at a common continuous x, stacked continuous areas.
3. Use `mode="y"` only when the shared continuous axis is vertical and grouping
   by y is the product intent.
4. Use `mode="xy"` for free 2d hits (scatters, paths, maps, jitter clouds) when
   nearest-point inspection is better than snapping to one axis.
5. **Pin `mode="exact"`** (or leave `auto`) on violin, boxplot, errorbar,
   pointrange, linerange, and crossbar. Never use freescrolling `x` / `y` / `xy`
   on those band geoms (#1528).

### Anti-patterns (do not ship these)

| Pattern                                                                      | Why it is wrong                                                                       | Use instead                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Violin with `mode="x"` / `"y"` / `"xy"`                                      | Categorical run labels get freescrolling axis guides and blank axis tooltip rows      | Pin `mode="exact"` or leave `auto` (auto → exact)         |
| Boxplot with `mode="x"` / `"y"` / `"xy"`                                     | Same discrete-group problem as violin                                                 | Pin `mode="exact"` or leave `auto`                        |
| Discrete-axis errorbar / pointrange / linerange / crossbar with `x`/`y`/`xy` | Caps and intervals are not continuous shared-x series; freescrolling guides add noise | Pin `mode="exact"` or leave `auto`                        |
| Bar / col with explicit `mode="x"` or `"xy"`                                 | Vertical guide cuts filled bands; library already advises exact/auto                  | `mode="exact"` or leave `auto` (auto → exact for bar/col) |
| Copying a gallery family's mode without reading the mark geometry            | Family-to-mode tables go stale; geometry decides                                      | Match scale type + mark geometry                          |

Treat **violin, boxplot, and discrete-axis errorbar / pointrange / linerange /
crossbar** the same: exact mark focus (auto or explicit). When in doubt on other
geoms, ship `auto`.

## Multi-layer hit hygiene

Every inspectable layer competes for pointer hits. Decorative furniture that
stays hit-testable steals focus from the data story.

Rules:

1. Mark decorative layers `inspect={false}`: rivers, annotation labels, full-panel
   rects, value labels that are only visual guides, background rugs, and similar
   non-primary marks.
2. For multi-layer maps and stories (**Minard-class** charts), keep **one primary
   story family** on the map panel (troop path). Furniture stays quiet with
   `inspect={false}` (rivers, city labels, strength text). Do not invent a second
   hit series just to drive cross-chart selection when the underlying tables are
   different cardinalities (Minard's nine cold readings vs many path vertices).
3. When a summary layer sits on a raw scatter (mean–SE errorbar over points), prefer
   inspecting the summary and set `inspect={false}` on the background cloud unless
   both layers are intentional hit targets.

Gallery reference: `examples/path/trajectory` (Minard's 1812 map) opts rivers and
city/strength text out of hits; the troop path is the primary story mark on the
map. The cold strip is a separate panel with its own path and points — shared
longitude only, not linked selection between series that do not share row identity.

## CLI cannot catch host inspect behaviour

`ggts render` validates PortableSpec and prints pipeline warnings/advisories
on stderr. It does **not** validate host Inspect mode, tooltip content, or which
layers steal hover hits. Layer `"inspect": false` is portable and can appear in
the JSON loop; **mode is not**. Agents that only re-render SVG never see blank
x-rows, freescrolling guides, or noisy multi-layer hits.

After changing interaction, verify with a **real hover and pin** (docs site,
playground, or browser test) — not only `ggts render` / an SVG dump. Read
this file before enabling Inspect on any chart.

**Skill packaging decision (#1530):** keep a **single skill** (`@ggts-sh/skill`)
for both PortableSpec agents and Svelte app agents. Do not split until progressive
disclosure fails (agents ignore `references/`, or the frontmatter description
cannot route both audiences).

## Capability props

| Prop / surface | Input                                                                    | What it enables                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<Inspect>`    | child of `<GGPlot>` (options as props)                                   | Tooltip, semantic crosshair, keyboard traversal, pinning. **Preferred.** Options: `mode` (`"auto" \| "exact" \| "x" \| "y" \| "xy"`), `pin`, `maxDistance` (CSS px), `contentMode` (`"informational" \| "interactive"`), `muteSiblings`, `tooltipTotal` (`"auto" \| "off" \| "top" \| "bottom"`), `identity` (column or accessor), `content` (Snippet, see Tooltip below). Do not put `inspect=` on `<GGPlot>` in new examples. |
| `select`       | `false \| "point" \| "interval" \| SelectOptions`                        | Point or interval selection. Options: `type` (`"point" \| "interval"`), `mode` (`"x" \| "y" \| "xy"`, interval only), `multiple`, `persistent`, `preset` (faceted intervals, below), `identity` (column or accessor).                                                                                                                                                                                                           |
| `zoom`         | `boolean \| ZoomOptions`                                                 | Brush zoom. Options: `mode` (`"x" \| "y" \| "xy"`), `trigger` (`"brush"`). Currently requires one unfaceted panel.                                                                                                                                                                                                                                                                                                              |
| `focus`        | `boolean \| { preview?: boolean }` on `<GuideLegend>`                    | Discrete legend preview, focus, and linked emphasis **for that aesthetic channel**. Emphasis only — never changes included rows. Discrete legends only; continuous ramps stay static. Mute de-emphasizes non-focused marks; dashed rings appear only on sparse point marks (≤48 anchors), never on paths/areas/bars/segments/text. Host-only — not a PortableSpec / `guideLegend()` field.                                      |
| `filter`       | `boolean \| LegendFilterOptions` on `<GuideLegend>`                      | Data-changing filtering on **that aesthetic's** discrete legend: changes included rows and reruns the grammar while preserving stable color identity. Options: `mode` (`"exclude" \| "include"`), `multiple`. Combine with focus: `<GuideLegend channel="color" focus filter />`.                                                                                                                                               |
| `identity`     | column or `(row, index) => PropertyKey` on Inspect / Select / controller | Durable row identity for public interaction payloads. **Default:** `id` column when present, else row index (order-stable only). Prefer this over plot-level `key`.                                                                                                                                                                                                                                                             |
| `key`          | column or accessor on `<GGPlot>` (**deprecated** since 0.21)             | Dual-read until 0.22. Prefer `identity` on Inspect / Select / `createPlotInteraction`.                                                                                                                                                                                                                                                                                                                                          |
| `tool`         | `"inspect" \| "point" \| "select-area" \| "zoom-area"`                   | Controlled initial/active tool; observe changes with `ontoolchange`.                                                                                                                                                                                                                                                                                                                                                            |
| `ariaLabel`    | `string`                                                                 | Accessible chart name; falls back to the plot title or a generated label.                                                                                                                                                                                                                                                                                                                                                       |
| `a11y`         | `A11yMode`                                                               | `"force-svg"` keeps every layer as SVG marks.                                                                                                                                                                                                                                                                                                                                                                                   |

### Deprecated: plot-level `legendFocus` / `legendFilter`

Since 0.19.0, use `<GuideLegend channel="color" focus />` and
`<GuideLegend channel="color" filter />`. The old GGPlot props still dual-read
and emit `DEPRECATED_PLOT_PROP` — never teach them as the current API.

After an interval or zoom commit, accessible controls accept exact bounds.

## Faceted interval presets

`select={{ type: "interval", preset }}` coordinates durable intervals across
facet panels:

- `independent` — only the matching panel consumes its interval.
- `union` — matching rows from every stored panel interval are combined.
- `cross-panel` — the sole origin interval is projected into compatible panels.

`union` and `cross-panel` use the resolved row identity (default `id` / index,
or an explicit `identity` override on Select / Inspect / controller). The
engine always supplies an identity, so these presets no longer fail solely
because identity was omitted.

## Controller: durable shared state

`createPlotInteraction<Key>()` creates chart-independent semantic state that
outlives any one plot. Pass the same controller to every plot that should link,
via the `interaction` prop. The controller owns stable keys and scoped data
domains only; each chart translates them to its own render model.

- Mutation methods: `setSelection(keys, {scope, source?})`, `toggleSelection`,
  `clearSelection`, `setEmphasis`, `clearEmphasis`, `setInterval`,
  `clearInterval`, `clearIntervals`, `setZoom(domains, {scope, source?})`,
  `resetZoom`, `reconcileKeys` (call after replacing rows).
- Reads: `selected(scope)`, `emphasized(scope)`, `isSelected(key, scope)`,
  `intervals(scope)`, `zoom(scope)`, `snapshot`, `revision` (reactive),
  `identity` (optional, from create options).
- `createPlotInteraction({ onchange, identity })` observes every transition
  (`kind`, `source`, `revision`) and may set a shared row-identity override.

`interactionScope` (`{ keys, x?, y?, intervals? }`) names the identity
namespaces used for linking: key state crosses charts only through `keys`;
data-space zoom crosses one positional channel only when that channel's scope
also matches; `intervals` defaults to `keys`. Give plots matching scope
channels only when they should coordinate.

A `<GGPlot>` component instance also exports `resetScales()` and
`setZoom(domains)` for imperative per-chart control.

## Handlers

`oninspect`, `onselect`, `onzoom`, `onlegendfocus`, `onlegendfilter`,
`oninteraction` (union of all five event types), `ondiagnostic`,
`ontoolchange`, and `onrender(model, spec)` — called after each committed
render with the RenderModel (warnings, advisories, scales) and the normalized
PortableSpec.

A handler without its matching capability (for example `onselect` without
`select` or an enabled capability child), or `interactionScope` without an
`interaction` controller, is inert and emits a development advisory
(`INTERACTION_HANDLER_WITHOUT_CAPABILITY`, `INTERACTION_SCOPE_WITHOUT_CONTROLLER`).
Two `<Inspect>` children last-win with
`INTERACTION_DUPLICATE_INSPECT_CAPABILITY`.

## Tooltip

Enabling inspect with `<Inspect />` renders the default HTML tooltip; no extra
component is needed. Customize its body with the `content` prop on `<Inspect>`,
which receives a `PlotInspectionChange` (`focus`/`members` are `PlotDatum`
values whose `fields` are `TooltipField` rows: `{ channel, field, value }`).
The exported `Tooltip` component is the same positioned shell for advanced
custom rendering. `TooltipContext` is a deprecated (0.1.0) alias of
`PlotInspectionChange`.

### Default content policy (high-n stacks)

For axis-group inspection (`mode: "x"` / `"y"`), the **default** hover tooltip
does not dump every series:

1. **Focused series** is always included (the band under the pointer).
2. Up to **7 more** members are chosen by **largest absolute value** at that
   axis position (y when grouping by x, x when grouping by y) — not by stacking
   order — so tiny early series cannot crowd out the large contributors.
3. A **Total** row appears only when the group includes a **stack** or **fill**
   layer. It sums unique numeric contributions in the full group across layers
   (not just the capped hover window or the focus layer). Multi-layer paints of
   the same series (line+point) count once; a thin overlay over a stack still
   includes every distinct series in the total. Parallel multi-series lines or
   points (`position: identity` / dodge) omit Total — their y-values are not
   parts of a whole. Axis-group modes show this Total automatically. Exact /
   xy inspection does not — set `tooltipTotal="bottom"` or `"top"` on
   `<Inspect>` (or `inspect={{ tooltipTotal: "bottom" }}`) to show one Total
   without switching `mode` to `"x"` / `"y"`. `"off"` hides it even in axis
   mode.

4. An overflow line (`+N more · pin to inspect all`) appears when the group is
   larger than eight display members (full-group unique count, all layers).

**Pin** the tooltip (click, or keyboard pin) to scroll the full group inside the
320px panel. **Opt into a full custom listing** with
`<Inspect content={snippet} />` or `oninspect` — public `members` still lists
the complete group when those paths request complete snapshots. With a large
discrete color/fill domain and inspect enabled, an advisory
(`INTERACTION_INSPECT_HIGH_CARDINALITY_DISCRETE`) suggests top-n data prep or a
custom content snippet.

## Diagnostics

`ondiagnostic` receives `PlotDiagnostic`, the union of three catalogs (each
entry has `severity`, `code`, `message`, `prop`, `suggestions`, `docUrl`).

**Agent/CLI path:** inspect mode is host-only. `ggts render --inspect MODE`
runs the same pure inspect×geom collectors and emits matching codes on stderr
with `source: "interaction"` (for example `INTERACTION_INSPECT_X_ON_COL` when
`MODE` is `x`/`xy` and the spec has a `col` layer). Without `--inspect`, the
CLI does not invent host intent. Full wiring/key/lineage diagnostics still need
a mounted plot.

- `INTERACTION_DIAGNOSTIC_CATALOG` — capability/key/lineage checks, e.g.
  `INTERACTION_POINT_REQUIRES_KEY`, `INTERACTION_DUPLICATE_KEY`,
  `INTERACTION_UNSTABLE_KEY`, `INTERACTION_INTERVAL_FACET_UNSUPPORTED`,
  `INTERACTION_INTERVAL_SCALE_UNSUPPORTED` (continuous linear/log/time only),
  `INTERACTION_LEGEND_DISCRETE_ONLY`, `INTERACTION_TOOL_UNAVAILABLE`,
  `INTERACTION_INSPECT_X_ON_COL` / `INTERACTION_INSPECT_X_ON_BAR` (vertical
  guide through columns/bars), `INTERACTION_INSPECT_X_BISECTS_COL_LABELS` /
  `INTERACTION_INSPECT_X_BISECTS_BAR_LABELS` (same guide through on-bar value
  labels), `INTERACTION_INSPECT_AXIS_ON_VIOLIN` / `_BOXPLOT` / `_ERRORBAR` /
  `_LINERANGE` / `_POINTRANGE` / `_CROSSBAR` (any freescrolling x/y/xy guide
  through distribution or interval band geoms — use exact),
  `INTERACTION_INSPECT_HIGH_CARDINALITY_DISCRETE` (discrete color/fill domain
  ≥ 16 with inspect on — default tooltip is top-k + total, not a full dump),
  and the two wiring advisories named above.
- `DEPRECATION_DIAGNOSTIC_CATALOG` — one code, `DEPRECATED_PLOT_PROP`, for
  every grammar prop deprecated in 0.11.0 (`prop` carries the name).
- `COMPOSITION_DIAGNOSTIC_CATALOG` — child-layer composition collisions:
  `DUPLICATE_PLOT_LAYER`, `DUPLICATE_SCALE_CHANNEL`, `DUPLICATE_MERGE_KEY`.

## Worked example: linked faceted selection

```svelte fragment
<script lang="ts">
  import {
    createPlotInteraction,
    Facet,
    GeomPoint,
    GGPlot,
    GuideLegend,
  } from "@ggts-sh/svelte";

  const interaction = createPlotInteraction<number>();
  const scope = { keys: "sales-rows", intervals: "sales-range" } as const;
</script>

<GGPlot
  data={rows}
  aes={{ x: "date", y: "value", color: "series" }}
  select={{ type: "interval", mode: "x", preset: "cross-panel" }}
  {interaction}
  interactionScope={scope}
  oninteraction={(event) => console.log(event.type, event)}
>
  <GeomPoint />
  <Facet wrap="region" ncol={3} />
  <GuideLegend channel="color" focus filter />
</GGPlot>
```

Any second plot given the same `interaction` controller and a matching
`interactionScope` stays linked: brushing an interval in one panel projects it
cross-panel, external UI can call `interaction.setSelection(...)`, and legend
filtering reruns the grammar without reshuffling series colors.
