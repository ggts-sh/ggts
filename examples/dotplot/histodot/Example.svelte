<script lang="ts">
  import {
    GeomDotplot,
    GGPlot,
    Inspect,
    Labs,
    ScaleYContinuous,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  import { earthDensity } from "./data.js";
</script>

<GGPlot data={earthDensity} aes={{ x: "density" }} width={640} height={400}>
  <GeomDotplot binwidth={0.05} boundary={0} stackdir="up" />
  <ScaleYContinuous breaks={[0, 1, 2, 3, 4, 5]} />
  <ThemeClassic />
  <Labs
    title="One dot per measurement, stacked in bins"
    subtitle="29 Cavendish density readings (modern 5.517)"
    x="Density of the earth, water = 1"
    y="Runs"
  />
  <Inspect mode="exact" pin />
</GGPlot>
