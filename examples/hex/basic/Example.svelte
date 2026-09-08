<script lang="ts">
  import {
    GeomHex,
    GGPlot,
    Inspect,
    Labs,
    ScaleFillContinuous,
    ThemeMinimal,
  } from "@ggts-sh/svelte";

  import { fijiQuakes } from "./data.js";
</script>

<GGPlot
  data={fijiQuakes}
  aes={{ x: "long", y: "lat" }}
  width={640}
  height={400}
>
  <GeomHex bins={18} />
  <ScaleFillContinuous scheme="viridis" />
  <ThemeMinimal />
  <Labs
    title="Hex bins for a dense cloud"
    subtitle="A thousand earthquakes by location off Fiji"
    x="Longitude (°E)"
    y="Latitude (°)"
    fill="Events"
  />
  <Inspect mode="exact" pin />
</GGPlot>
