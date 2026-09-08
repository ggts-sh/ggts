<script lang="ts">
  import {
    CoordFixed,
    GeomMap,
    GGPlot,
    Inspect,
    Labs,
    ScaleFillContinuous,
    ThemeMap,
  } from "@ggts-sh/svelte";

  import { neighbourhoodDeaths, pumpNeighbourhoods } from "./data.js";
</script>

<GGPlot
  data={neighbourhoodDeaths}
  aes={{ map_id: "pump", fill: "deaths" }}
  width={640}
  height={400}
>
  <GeomMap
    map={{ values: pumpNeighbourhoods }}
    mapId="pump"
    linewidth={1.2}
    alpha={0.95}
  />
  <CoordFixed />
  <ScaleFillContinuous scheme="viridis" />
  <ThemeMap />
  <Labs
    title="359 of 578 deaths were nearest the Broad Street pump"
    subtitle="The 1854 Soho outbreak counted into the area closest to each public pump"
    fill="Deaths"
  />
  <Inspect mode="exact" pin identity="pump" />
</GGPlot>
