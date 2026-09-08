<script lang="ts">
  import {
    CoordFixed,
    GeomSf,
    GGPlot,
    Inspect,
    Labs,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  import { aboveOneEighty } from "./data.js";
</script>

<GGPlot data={aboveOneEighty} aes={{ fill: "ground" }} width={640} height={400}>
  <GeomSf alpha={0.85} linewidth={0.9} />
  <CoordFixed />
  <ThemeClassic />
  <Labs
    title="One feature with two separate polygons"
    subtitle="Land above 180 m as a single collection: the summit ridge and a rise east of it"
    fill=""
  />
  <Inspect mode="exact" pin />
</GGPlot>
