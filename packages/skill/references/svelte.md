# Svelte 5

Use this reference for a Svelte target. Shared grammar and validation live in
[the skill](../SKILL.md). For browser interactions, read
[interaction rules](interactions.md) before adding Inspect, selection, zoom, or linked plots.

## Svelte composition — children are canonical

```svelte complete
<script lang="ts">
  import {
    GeomPoint,
    GeomSmooth,
    GGPlot,
    Labs,
    ScaleColorDiscrete,
    ThemeMinimal,
  } from "@ggsvelte/svelte";

  const cars = [
    { displ: 1.8, hwy: 29, class: "compact" },
    { displ: 2.0, hwy: 31, class: "compact" },
    { displ: 3.5, hwy: 26, class: "midsize" },
    { displ: 5.3, hwy: 20, class: "suv" },
    { displ: 5.7, hwy: 17, class: "suv" },
    { displ: 6.2, hwy: 16, class: "suv" },
  ];
</script>

<GGPlot data={cars} aes={{ x: "displ", y: "hwy", color: "class" }} height={400}>
  <GeomSmooth method="loess" se={false} />
  <GeomPoint size={3} alpha={0.85} />
  <ScaleColorDiscrete scheme="observable10" />
  <ThemeMinimal />
  <Labs
    title="Bigger engines, thirstier cars"
    x="Displacement (l)"
    y="Highway mpg"
    color="Class"
  />
</GGPlot>
```

Convention (ggplot2 thinking order): mark layers first, then scales / coords /
facets, then theme / guides / labs, then host-only `<Inspect>` last. Grammar
**layers** (theme/scale/coord/facet/guides/labs/legend) render no markup and
register declaratively as non-mark `Layer` kinds; mark-layer registration
order is z-order (points above smooth here). Interleave does not change the
assembled PortableSpec beyond mark z-order and last-wins folds within a
family. Every geom takes aesthetics through one `aes` object prop
(bare-string shorthand allowed) and constant style params as direct props
(`size={3}`); structural props are `data`, `stat`, `position`,
`positionParams`, `render`.

`<GGPlot>` props: `spec`, `data`, `aes`, `layers`, `width`
(number | "container"), `height`, `a11y`, `ariaLabel`, the interaction props
(`select`, `zoom`, `tool`, `interaction`, `interactionScope`; prefer
`<Inspect>` for inspection and `<GuideLegend channel focus>` /
`<GuideLegend channel filter>` for legend interaction — do not put
`inspect` / `legendFocus` / `legendFilter` on `<GGPlot>` in new code), the
`on*` handlers, and `children`. Plot-level `key` is **deprecated** since
0.21 — prefer `identity` on `<Inspect>`, object-form `select`, or
`createPlotInteraction` (default: `id` column when present, else row index).
Instance methods: `resetScales()`, `setZoom()`.

Precedence: `spec` wins over everything else. For mark layers, an explicit
`layers` prop wins over geom children — use it for dynamic layer lists (a keyed
`{#each}` reorder does not preserve z-order). For grammar families, children
win. Coord/facet/theme REPLACE (last wins); scales merge per channel;
labs/guides/legend merge per key. Duplicates emit `DUPLICATE_PLOT_LAYER` /
`DUPLICATE_SCALE_CHANNEL` / `DUPLICATE_MERGE_KEY` advisories — full semantics
in
[references/composition-surfaces.md](composition-surfaces.md).

**Removed in 0.13.0** (deprecated since 0.11.0): the seven `<GGPlot>` grammar
props `facet`, `coord`, `scales`, `guides`, `legend`, `theme`, `labs`. Compose
them as children instead; `spec`, `data`, `aes`, and `layers` stay first-class.
Migrate old sources with `npx ggsvelte-codemod --write src` (dry-run without
`--write`).
