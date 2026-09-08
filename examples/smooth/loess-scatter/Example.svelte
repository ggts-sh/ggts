<script lang="ts">
  import {
    GeomPoint,
    GeomSmooth,
    GGPlot,
    Inspect,
    Labs,
    ThemeTufte,
  } from "@ggts-sh/svelte";

  import { chocolateBarsSample } from "./data.js";
</script>

<GGPlot
  data={chocolateBarsSample}
  aes={{ x: "cocoaPercent", y: "rating" }}
  width={640}
  height={400}
>
  <GeomSmooth method="loess" span={0.75} />
  <GeomPoint alpha={0.25} size={2} />
  <ThemeTufte />
  <Labs
    title="Cocoa percent against bar rating"
    subtitle="Loess through a sample of chocolate reviews, with a confidence band"
    x="Cocoa (%)"
    y="Rating (1–4)"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
