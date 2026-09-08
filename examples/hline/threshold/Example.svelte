<script lang="ts">
  import {
    GeomHline,
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    ThemeMinimal,
  } from "@ggts-sh/svelte";

  import { earthDensity } from "./data.js";
</script>

<GGPlot
  data={earthDensity}
  aes={{ x: "trial", y: "density" }}
  width={640}
  height={400}
>
  <GeomPoint size={2.2} alpha={0.55} />
  <GeomHline
    yintercept={5.517}
    linewidth={2.6}
    aes={{ color: { value: "#2f6fed" } }}
  />
  <ThemeMinimal />
  <Labs
    title="One horizontal threshold"
    subtitle="Twenty-nine density readings with a line at the modern earth density 5.517"
    x="Determination"
    y="Density of the earth (water = 1)"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
