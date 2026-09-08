<script lang="ts">
  import {
    CoordFixed,
    GeomSf,
    GeomSfLabel,
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
  <GeomSf alpha={0.75} linewidth={0.8} />
  <GeomSfLabel padding={3} radius={2} size={11} />
  <CoordFixed />
  <ThemeClassic />
  <GuideNone channel="fill" />
  <Labs
    title="Pump names on measured boxes"
    subtitle="Each label sits on a padded box so it stays readable over a busy fill"
  />
  <Inspect mode="exact" pin />
</GGPlot>
