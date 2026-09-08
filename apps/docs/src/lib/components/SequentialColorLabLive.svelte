<script lang="ts">
  import {
    GeomRaster,
    GGPlot,
    Inspect,
    Labs,
    Scale,
    Theme,
  } from "@ggts-sh/svelte";
  import type { ColorScaleSpec } from "@ggts-sh/spec";

  import { grid } from "$lib/theme-specimens/data";

  const {
    label,
    scale,
    height,
  }: {
    label: string;
    scale: ColorScaleSpec;
    height: number;
  } = $props();
</script>

<GGPlot
  data={grid}
  aes={{ x: "x", y: "y", fill: "z" }}
  {height}
  ariaLabel={`${label} sequential color example`}
>
  <GeomRaster />
  <Scale value={{ fill: scale }} />
  <Theme name="light" />
  <Labs
    title={`${label} Macdonell counts`}
    x="Finger index"
    y="Height index"
    fill="Men"
  />
  <Inspect mode="xy" />
</GGPlot>
