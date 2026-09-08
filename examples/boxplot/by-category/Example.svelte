<script lang="ts">
  import {
    GeomBoxplot,
    GGPlot,
    Inspect,
    Labs,
    ScaleXDiscrete,
    ThemeFew,
  } from "@ggts-sh/svelte";

  import { michelsonRuns } from "./data.js";
</script>

<GGPlot
  data={michelsonRuns}
  aes={{ x: "run", y: "velocity" }}
  width={640}
  height={400}
>
  <GeomBoxplot />
  <ScaleXDiscrete domain={["Jun 5", "Jun 7", "Jun 9", "Jun 12", "Jul 2"]} />
  <ThemeFew />
  <Labs
    title="Boxplots for five runs of the same experiment"
    subtitle="Runs differ more than readings within a run"
    x="Run"
    y="Velocity (km/s − 299,000)"
  />
  <Inspect mode="exact" pin />
</GGPlot>
