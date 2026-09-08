<script lang="ts">
  import {
    CoordFlip,
    GeomCol,
    GGPlot,
    Guides,
    Inspect,
    Labs,
    Scale,
    Theme,
  } from "@ggts-sh/svelte";
  import type { CATEGORICAL_SCHEME_NAMES, ThemeName } from "@ggts-sh/spec";

  import { paletteSpecimenChart } from "$lib/theme-specimens/palette-bars";

  type CategoricalSchemeName = (typeof CATEGORICAL_SCHEME_NAMES)[number];

  const {
    name,
    label,
    capacity,
    reverse,
    paperTheme,
    height,
  }: {
    name: CategoricalSchemeName;
    label: string;
    capacity: number;
    reverse: boolean;
    paperTheme: ThemeName;
    height: number;
  } = $props();

  const chart = $derived(paletteSpecimenChart(capacity));
</script>

<GGPlot
  data={chart.rows}
  aes={{ x: "category", y: "value", fill: "category" }}
  {height}
  ariaLabel={`${label} palette on ${paperTheme} paper`}
>
  <GeomCol width={0.75} />
  {#if chart.flip}
    <CoordFlip />
  {/if}
  <Scale value={{ fill: { type: "ordinal", scheme: name, reverse } }} />
  <Theme name={paperTheme} />
  <Guides value={{ fill: { type: "none" } }} />
  <Labs title={chart.title} x={chart.x} y={chart.y} />
  <Inspect mode="exact" />
</GGPlot>
