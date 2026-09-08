<script lang="ts">
  import {
    GeomBar,
    GGPlot,
    Inspect,
    Labs,
    ScaleFillDiscrete,
    ScaleYContinuous,
    ThemeFivethirtyeight,
  } from "@ggts-sh/svelte";

  import { armadaCrews } from "./data.js";
</script>

<GGPlot
  data={armadaCrews}
  aes={{ x: "squadron", fill: "role", weight: "men" }}
  width={640}
  height={400}
>
  <GeomBar position="fill" />
  <ScaleYContinuous labels=".0%" />
  <ScaleFillDiscrete
    domain={["Soldiers", "Sailors"]}
    scheme="fivethirtyeight"
  />
  <ThemeFivethirtyeight />
  <Labs
    title="Parts of a whole within each group"
    subtitle="Share of soldiers and sailors in each squadron"
    x="Squadron"
    y="Share of complement"
    fill="Role"
  />
  <Inspect mode="exact" pin />
</GGPlot>
