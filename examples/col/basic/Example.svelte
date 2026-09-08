<script lang="ts">
  import {
    GeomCol,
    GGPlot,
    Inspect,
    Labs,
    ScaleXContinuous,
    ThemeClassic,
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
  <ThemeClassic />
  <Labs
    title="Counts across ordered chest sizes"
    subtitle="How many men fell in each chest-measure class"
    x="Chest circumference (inches)"
    y="Soldiers"
  />
  <Inspect mode="exact" pin />
</GGPlot>
