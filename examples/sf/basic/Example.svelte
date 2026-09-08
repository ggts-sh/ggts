<script lang="ts">
  import {
    CoordFixed,
    GeomSf,
    GGPlot,
    Inspect,
    Labs,
    ScaleFillContinuous,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  import { heightRings } from "./data.js";
</script>

<GGPlot data={heightRings} aes={{ fill: "height" }} width={640} height={400}>
  <GeomSf alpha={0.55} linewidth={0.9} />
  <CoordFixed />
  <ScaleFillContinuous scheme="viridis" />
  <ThemeClassic />
  <Labs
    title="Simple features as filled polygons"
    subtitle="Elevation bands on a hill drawn from simple-feature rings"
    fill="Metres"
  />
  <Inspect mode="exact" pin />
</GGPlot>
