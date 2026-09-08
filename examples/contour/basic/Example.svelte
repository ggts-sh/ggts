<script lang="ts">
  import {
    CoordFixed,
    GeomContour,
    GGPlot,
    Inspect,
    Labs,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  import { maungaWhau } from "./data.js";
</script>

<GGPlot
  data={maungaWhau}
  aes={{ x: "east", y: "north", z: "height" }}
  width={640}
  height={400}
>
  <GeomContour bins={10} linewidth={1} />
  <CoordFixed />
  <ThemeClassic />
  <Labs
    title="Contours of height on a grid"
    subtitle="Elevation bands on Maunga Whau from a regular height matrix"
    x="Metres east"
    y="Metres north"
  />
  <Inspect mode="x" pin />
</GGPlot>
