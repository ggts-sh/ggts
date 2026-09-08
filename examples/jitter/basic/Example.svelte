<script lang="ts">
  import {
    GeomJitter,
    GGPlot,
    GuideNone,
    Inspect,
    Labs,
    ScaleColorDiscrete,
    ThemeClean,
  } from "@ggts-sh/svelte";

  import { fastfoodMenu } from "./data.js";
</script>

<GGPlot
  data={fastfoodMenu}
  aes={{ x: "restaurant", y: "calories", color: "restaurant" }}
  width={640}
  height={400}
>
  <GeomJitter width={0.22} height={0} alpha={0.65} />
  <ScaleColorDiscrete scheme="observable10" />
  <ThemeClean />
  <GuideNone channel="color" />
  <Labs
    title="Menu calories, spread so items do not stack"
    subtitle="Each point is one entrée. Jitter separates items that share a restaurant"
    x="Restaurant"
    y="Calories"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
