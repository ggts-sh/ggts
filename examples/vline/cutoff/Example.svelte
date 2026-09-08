<script lang="ts">
  import {
    GeomPoint,
    GeomVline,
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
  <GeomVline
    xintercept={6.5}
    linewidth={2.6}
    aes={{ color: { value: "#d4615c" } }}
  />
  <ThemeMinimal />
  <Labs
    title="One vertical cutoff"
    subtitle="Wire changed after this trial"
    x="Determination"
    y="Density of the earth (water = 1)"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
