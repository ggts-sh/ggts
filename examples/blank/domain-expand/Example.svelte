<script lang="ts">
  import {
    GeomBlank,
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  import { earthDensity, waterDensity } from "./data.js";
</script>

<GGPlot
  data={earthDensity}
  aes={{ x: "trial", y: "density" }}
  width={640}
  height={400}
>
  <GeomPoint size={3.5} alpha={0.9} />
  <GeomBlank data={waterDensity} aes={{ x: "trial", y: "density" }} />
  <ThemeClassic />
  <Labs
    title="Expanded domain with no marks"
    subtitle="Domain opened so a known constant sits inside the frame"
    x="Determination"
    y="Density of the earth, water = 1"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
