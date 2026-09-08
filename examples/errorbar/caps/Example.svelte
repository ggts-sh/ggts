<script lang="ts">
  import {
    GeomErrorbar,
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
  <GeomErrorbar
    width={0.55}
    linewidth={2.6}
    aes={{ color: { value: "#1a202c" } }}
  />
  <ScaleXDiscrete domain={["A", "B", "C"]} />
  <ScaleYContinuous limits={[0, 12]} />
  <ThemeMinimal />
  <Labs
    title="Capped error bars"
    subtitle="Three identity intervals with end caps at ymin and ymax"
    x="Group"
    y="Value"
  />
  <Inspect mode="exact" pin />
</GGPlot>
