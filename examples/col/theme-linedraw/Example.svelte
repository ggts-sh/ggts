<script lang="ts">
  import {
    GeomCol,
    GGPlot,
    Inspect,
    Labs,
    ScaleXContinuous,
    ThemeLinedraw,
  } from "@ggts-sh/svelte";

  import { chestSizes } from "./data.js";
</script>

<GGPlot
  data={chestSizes}
  aes={{ x: "chest", y: "soldiers" }}
  width={640}
  height={400}
>
  <GeomCol />
  <ScaleXContinuous nice={false} />
  <ThemeLinedraw />
  <Labs
    title="Linedraw theme on chest-size columns"
    subtitle="Hard black lines, white panel, no grey fill"
    x="Chest circumference (inches)"
    y="Soldiers"
  />
  <Inspect mode="exact" pin />
</GGPlot>
