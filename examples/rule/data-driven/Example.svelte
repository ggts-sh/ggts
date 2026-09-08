<script lang="ts">
  import {
    GeomRule,
    GGPlot,
    GuideNone,
    Inspect,
    Labs,
    ThemeMinimal,
  } from "@ggts-sh/svelte";

  import { coffeeRatings } from "./data.js";
</script>

<GGPlot
  data={coffeeRatings}
  aes={{ x: "totalCupPoints" }}
  width={640}
  height={400}
>
  <GeomRule alpha={0.2} linewidth={1} />
  <ThemeMinimal />
  <!-- y is synthetic for panel-spanning vertical rules; hide the 0–1 ladder (#700) -->
  <GuideNone channel="y" />
  <Labs
    title="A rug of every cupping score"
    subtitle="One vertical line per coffee lot. Most lots sit between about 80 and 88 total cup points"
    x="Total cup points"
  />
  <Inspect mode="x" pin />
</GGPlot>
