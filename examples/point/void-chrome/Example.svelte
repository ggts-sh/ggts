<script lang="ts">
  import {
    GeomLine,
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    ThemeVoid,
  } from "@ggts-sh/svelte";

  import { britishExports } from "./data.js";
</script>

<GGPlot
  data={britishExports}
  aes={{ x: "year", y: "value" }}
  width={640}
  height={400}
>
  <GeomLine linewidth={1.5} />
  <GeomPoint size={2.4} alpha={0.8} />
  <ThemeVoid />
  <Labs
    title="A sparkline without axes or grid"
    subtitle="Exports over decades reduced to a thin line with no chart furniture"
    x=""
    y=""
  />
  <Inspect mode="x" pin />
</GGPlot>
