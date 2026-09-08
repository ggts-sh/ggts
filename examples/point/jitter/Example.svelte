<script lang="ts">
  import {
    GeomPoint,
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
  <GeomPoint
    position="jitter"
    positionParams={{ width: 0.22, height: 0 }}
    alpha={0.65}
  />
  <ScaleColorDiscrete scheme="observable10" />
  <ThemeClean />
  <GuideNone channel="color" />
  <Labs
    title="Calories by restaurant, with jitter"
    subtitle="Horizontal jitter spreads marks that share a restaurant"
    x="Restaurant"
    y="Calories"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
