<script lang="ts">
  import {
    GeomPointrange,
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
  aes={{ x: "group", y: "mid", ymin: "lo", ymax: "hi" }}
  width={640}
  height={400}
>
  <GeomPointrange
    linewidth={2.6}
    size={5.5}
    aes={{ color: { value: "#1a202c" } }}
  />
  <ScaleXDiscrete domain={["A", "B", "C"]} />
  <ScaleYContinuous limits={[0, 12]} />
  <ThemeMinimal />
  <Labs
    title="Stem plus mid point"
    subtitle="Three identity intervals with a point at (x, y)"
    x="Group"
    y="Value"
  />
  <Inspect mode="exact" pin />
</GGPlot>
