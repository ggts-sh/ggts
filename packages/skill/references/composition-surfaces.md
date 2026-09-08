<!-- Source of truth: packages/svelte/src/lib/index.ts (component exports), packages/svelte/src/lib/plot-props.ts, packages/svelte/src/lib/layers/ (merge semantics, grammar-families). Theme roster lives in themes.md (asserted complete by scripts/skill-content/inventory.test.ts). -->

# Composition surfaces: coords, facets, guides, labs

Every surface here is a **grammar layer** (non-mark `Layer` kind). Each exists
in three equivalent forms: a key in the JSON `PortableSpec`, a removed
`<GGPlot>` prop (gone since 0.13.0; codemod rewrites old sources), and a
declaration-only child component
(canonical in Svelte). Child components emit no markup, register on init via
`createPlotLayer` / `registerPlotLayer`, unregister on destroy, and are inert
without a `<GGPlot>` ancestor.

**Ontology:** scale, theme, coord, facet, labs, guides, and legend **are
layers**. PortableSpec’s top-level `layers[]` array holds marks only; these
families fold into sibling keys. That is wire format, not “not a layer.”

## Themes

Full product roster (37 names), shells, and role overrides:
[themes.md](themes.md). Theme is a REPLACE family (last registration wins) —
see replace-vs-merge below.

## Coords

Components: `Coord` (escape hatch, `value: CoordSpec | "flip"`), `CoordFlip`,
`CoordCartesian`, `CoordTransform`, `CoordFixed`, `CoordEqual` (alias of
`CoordFixed`), `CoordSf`, `CoordRadial`, `CoordPolar` (ggplot2 `coord_polar`
alias shell — prefer `CoordRadial` for new work). `<CoordCartesian/>`
registers `{"type":"cartesian"}`, which `normalize()` drops when bare — use
it to clear an earlier coord under REPLACE. JSON forms:

```json fragment
"coord": {"type": "flip"}
```

```json fragment
"coord": {
  "type": "transform",
  "x": {"transform": "log10", "limits": [1, 1000], "reverse": false, "expand": true},
  "y": {"transform": "sqrt"},
  "clip": true
}
```

```json fragment
"coord": {
  "type": "radial",
  "theta": "y",
  "innerRadius": 0.4,
  "expand": false
}
```

- Coord transform runs AFTER stats and scale training (scale `transform` runs
  before stats). It preserves stat inputs; coordinate `limits` are a viewport —
  they never remove rows or recompute statistics. `expand` (default true) adds
  a 5% display expansion to explicit limits; `clip` (default true) clips marks
  to the panel.
- Non-identity coordinate transforms require continuous, non-temporal
  position scales on the transformed axes.
- `{"type": "fixed", "ratio": 1}`: ratio is physical y-unit length divided by
  physical x-unit length (default 1). Layout fits the largest centered data
  rectangle after chart chrome. Fixed-aspect coords reject free positional
  facet scales (`coord-fixed-free-scales` error).
- `{"type": "sf"}` (`<CoordSf/>`): fixed-aspect coords for already-projected
  map data; no CRS reprojection in v1. Accepts `ratio` like fixed.
- `{"type": "radial", …}` (`<CoordRadial/>`, helpers `coordRadial` /
  `coord_radial`): polar coordinates (ggplot2 `coord_radial`). Maps one
  aesthetic to angle and the other to radius — pie, coxcomb, polar scatter.
  Options: `theta` (`"x"` default | `"y"` for pie), `start` / `end` (radians
  from 12 o'clock; default full circle), `innerRadius` (0–1 fraction, donut
  hole), `expand` (default true; false for pie/coxcomb), `clip` (default
  off), `reverse` (`"none"` | `"theta"` | `"r"` | `"thetar"`),
  `thetaLimits` / `rLimits`. Full-circle panels use a square data rectangle.
  Equivalent skins: JSON ≡ `coordRadial({…})` ≡ `.coordRadial({…})` ≡
  `<CoordRadial …/>`.
- `CoordPolar` / `coordPolar` / `coord_polar`: superseded ggplot2
  `coord_polar` alias. Emits `{ type: "radial", clip: true, … }`;
  `direction: -1` maps to `reverse: "theta"`. Prefer `<CoordRadial/>` for
  partial arcs, inner radius, and reverse.

## Facets

Components: `Facet` (full `FacetInput` surface), `FacetWrap` (`field`,
`ncol?`, `scales?`, `strip?`), `FacetGrid` (`rows?`, `cols?`, `scales?`,
`strip?`). `field`/`rows`/`cols` accept a bare string or
`{ field, levels?, labels? }` for authored panel order and strip text. Wrap
form is mutually exclusive with rows/cols; a bare `<Facet/>` fails validate
with `facet-form-missing`.

```json fragment
"facet": {"wrap": {"field": "region"}, "ncol": 3, "scales": "free_y",
          "strip": {"position": "top", "show": true}}
```

- Panels partition the data BEFORE stats and positions run — each panel
  computes its own counts, bins, and stacks.
- `scales`: `"fixed"` (default — panels share both positional scales) |
  `"free"` | `"free_x"` | `"free_y"`. Discrete color/fill assignments are
  ALWAYS global (one legend), whatever `scales` says.
- `strip`: `position` `"top"` (default) | `"bottom"` | `"left"` | `"right"`
  (left/right strips take layout space rather than overlaying the panel);
  `show` (default true) — set false when direct labels are authored elsewhere.

## Guides, legend, labs

Guides are keyed by aesthetic channel: `x`, `y`, `color`, `fill`, `size`,
`linewidth`, `alpha`, `shape`, `linetype`. Components: `Guides`
(escape hatch, `value: GuidesSpec`), plus one shell per guide type carrying a
`channel` prop — `GuideAxis` (channels `x`/`y` only), `GuideLegend`,
`GuideColorbar`, `GuideColorsteps` (non-position channels), `GuideNone` (any
channel). `<GuideLegend channel="color" position="bottom"/>` assembles
`guides: {"color": {"type": "legend", "position": "bottom"}}`.

- Top-level `guides` override a scale-local `guide`.
- Shared options: `title`, `theme` (bounded size/gap overrides), `collision`;
  non-position guides add integer `order` (placement rank), `position`
  `"auto"|"right"|"bottom"`, `direction` `"auto"|"vertical"|"horizontal"`,
  and `force` (show a guide suppressed by default, e.g. identity scales).
- Responsive rule: `auto`-positioned non-position guides move below the panel
  when the viewport is 480px wide or less, or when a right guide would leave
  under 320px of panel (after an estimated 80px of other chrome).
- `<Legend order="stable-domain"|"present-first-seen"|"sorted"/>` is the
  plot-wide legend ENTRY-SORT enum (default `stable-domain`; ordering never
  changes color assignments). Distinct from `<GuideLegend order={2}/>`, a
  per-aesthetic integer placement rank — same word, unrelated concepts.
- `Labs` takes flat string props: `title`, `subtitle`, `caption`, `x`, `y`,
  `color`, `fill`, `size`, `linewidth`, `alpha`, `shape`, `linetype`. The
  spec type is re-exported from `@ggts-sh/svelte` as `LabsSpec`.

```svelte fragment
<GGPlot
  data={rows}
  aes={{ x: "cat", y: "val", fill: "group" }}
  layers={[{ geom: "col" }]}
>
  <CoordFlip />
  <FacetWrap field="region" ncol={2} />
  <ThemeMinimal />
  <Labs title="Sales by category" x="Category" y="Sales" />
  <GuideLegend channel="fill" position="bottom" />
  <Legend order="sorted" />
</GGPlot>
```

Equivalent complete JSON spec:

```json complete
{
  "data": {
    "values": [
      { "cat": "a", "val": 3, "group": "g1", "region": "west" },
      { "cat": "b", "val": 5, "group": "g2", "region": "west" },
      { "cat": "a", "val": 2, "group": "g1", "region": "east" },
      { "cat": "b", "val": 4, "group": "g2", "region": "east" }
    ]
  },
  "layers": [
    {
      "geom": "col",
      "aes": {
        "x": { "field": "cat" },
        "y": { "field": "val" },
        "fill": { "field": "group" }
      }
    }
  ],
  "coord": { "type": "flip" },
  "facet": { "wrap": { "field": "region" }, "ncol": 2 },
  "theme": "minimal",
  "labs": { "title": "Sales by category", "x": "Category", "y": "Sales" },
  "guides": { "fill": { "type": "legend", "position": "bottom" } },
  "legend": { "order": "sorted" }
}
```

## Replace-vs-merge semantics (child layers)

- The `spec` prop wins over everything — when set, all other props and all
  children are ignored.
- Mark layers: the `layers` prop, when set, is used INSTEAD of geom children.
  Otherwise geom children register in document order, and registration order
  is z-order (first = bottom).
- Grammar (non-mark) families fold onto the builder in registration order —
  later siblings beat earlier ones.
- REPLACE families — `coord`, `facet`, `theme`: the last registration fully
  replaces earlier ones (and any matching prop). Two or more children of one
  kind emit a `DUPLICATE_PLOT_LAYER` advisory.
- Scales merge per-channel; two scale children configuring the same channel
  emit `DUPLICATE_SCALE_CHANNEL` (note British/American spellings write the
  same channel: `<ScaleColorDiscrete/>` and `<ScaleColourContinuous/>` both
  configure `color`).
- `labs`, `guides`, `legend` are keyed-MERGE families: siblings touching
  different keys all survive; a colliding key emits `DUPLICATE_MERGE_KEY` and
  the later child's value wins. The value at a key is replaced whole — a
  guide child never field-merges into another guide object for that channel.
- All three advisory codes arrive through `ondiagnostic` with severity
  `"advisory"`; the chart still renders.
- Grammar children emit no markup and are inert without a `<GGPlot>` ancestor.
