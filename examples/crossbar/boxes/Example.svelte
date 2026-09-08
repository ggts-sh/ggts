<script lang="ts">
  import {
    GeomCrossbar,
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
  <GeomCrossbar
    width={0.55}
    linewidth={1.8}
    fatten={3.2}
    aes={{
      color: { value: "#1a202c" },
      fill: { value: "#cbd5e1" },
    }}
  />
  <ScaleXDiscrete domain={["A", "B", "C"]} />
  <ScaleYContinuous limits={[0, 12]} />
  <ThemeMinimal />
  <Labs
    title="Interval boxes with mid line"
    subtitle="Three identity boxes from ymin to ymax with a horizontal line at y"
    x="Group"
    y="Value"
  />
  <Inspect mode="exact" pin />
</GGPlot>
