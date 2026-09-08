<script lang="ts">
  import {
    GeomBin2d,
    GGPlot,
    Inspect,
    Labs,
    ScaleFillContinuous,
    ThemeMinimal,
  } from "@ggts-sh/svelte";

  import { oldFaithful } from "./data.js";
</script>

<GGPlot
  data={oldFaithful}
  aes={{ x: "duration", y: "waiting" }}
  width={640}
  height={400}
>
  <GeomBin2d bins={16} />
  <ScaleFillContinuous scheme="viridis" />
  <ThemeMinimal />
  <Labs
    title="Two-dimensional bins for a dense cloud"
    subtitle="Waiting time against eruption length for Old Faithful"
    x="Eruption length (minutes)"
    y="Wait for the next eruption (minutes)"
    fill="Eruptions"
  />
  <Inspect mode="exact" pin />
</GGPlot>
