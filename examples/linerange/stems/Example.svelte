<script lang="ts">
  import {
    GeomLinerange,
    GGPlot,
    Inspect,
    Labs,
    ScaleXDiscrete,
    ScaleYContinuous,
    ThemeMinimal,
  } from "@ggts-sh/svelte";

  import { groupIntervals } from "./data.js";
</script>

<GGPlot
  data={groupIntervals}
  aes={{ x: "group", ymin: "lo", ymax: "hi" }}
  width={640}
  height={400}
>
  <GeomLinerange linewidth={3.2} aes={{ color: { value: "#1a202c" } }} />
  <ScaleXDiscrete domain={["A", "B", "C"]} />
  <ScaleYContinuous limits={[0, 12]} />
  <ThemeMinimal />
  <Labs
    title="Bare vertical stems"
    subtitle="Three identity intervals from ymin to ymax without end caps"
    x="Group"
    y="Value"
  />
  <Inspect mode="exact" pin />
</GGPlot>
