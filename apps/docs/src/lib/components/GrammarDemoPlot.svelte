<script lang="ts">
  import {
    GeomJitter,
    GeomSmooth,
    GGPlot,
    GuideLegend,
    Inspect,
    Labs,
    Theme,
  } from "@ggts-sh/svelte";
  import { palmerPenguins } from "@ggts-sh/core/data";

  import { contrastChartTheme } from "$lib/docs-appearance-state.svelte";

  /**
   * Live homepage grammar plot. Dynamically imported so the section chrome +
   * static SVG shell can SSR without pulling @ggts-sh into the home node.
   *
   * Full interactive state (same as the old accordion step 4 / Interaction):
   * xy inspect (numeric crosshair) + GuideLegend focus + loess smooth.
   * Full palmerPenguins (333 complete cases).
   *
   * Labs titles must match `homeGrammarStaticSvgFromData` so the shell→live
   * upgrade does not flash raw field names onto the axes.
   */
  const chartTheme = $derived(contrastChartTheme());
</script>

<!--
  mode "xy": full crosshair on two continuous axes (not path auto "x").
  GuideLegend focus uses default row identity (`id` on palmerPenguins).
  GeomJitter + alpha: 333 points stack on integer measurements; seeded jitter
  (default 0.4·resolution) and alpha spread the cloud. degree 1 loess stays
  cheap when remounting.
-->
<GGPlot
  data={palmerPenguins}
  aes={{
    x: "flipperLengthMm",
    y: "bodyMassG",
    color: "species",
  }}
  ariaLabel="Penguin body mass increases with flipper length, grouped by species"
>
  <GeomJitter alpha={0.88} />
  <GeomSmooth method="loess" span={0.75} degree={1} se={false} />
  <Theme name={chartTheme} />
  <GuideLegend channel="color" focus />
  <Labs x="Flipper length mm" y="Body mass g" color="species" />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
