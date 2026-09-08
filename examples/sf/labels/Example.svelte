<script lang="ts">
  import {
    CoordFixed,
    GeomSf,
    GeomSfText,
    GGPlot,
    GuideNone,
    Inspect,
    Labs,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  import { pumpNeighbourhoods } from "./data.js";
</script>

<GGPlot
  data={pumpNeighbourhoods}
  aes={{ fill: "pump", label: "pump" }}
  width={640}
  height={400}
>
  <GeomSf alpha={0.35} linewidth={0.8} />
  <GeomSfText size={11} />
  <CoordFixed />
  <ThemeClassic />
  <GuideNone channel="fill" />
  <Labs
    title="Every pump in Snow's Soho, named"
    subtitle="Plain labels at the centre of the area each pump served"
  />
  <Inspect mode="exact" pin />
</GGPlot>
