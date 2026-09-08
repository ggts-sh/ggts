<script lang="ts">
  import {
    CoordFlip,
    GeomCol,
    GGPlot,
    Inspect,
    Labs,
    ThemeFivethirtyeight,
  } from "@ggts-sh/svelte";

  import { armadaMen } from "./data.js";
</script>

<GGPlot
  data={armadaMen}
  aes={{ x: "squadron", y: "men" }}
  width={640}
  height={400}
>
  <GeomCol />
  <CoordFlip />
  <ThemeFivethirtyeight />
  <Labs
    title="Category totals, flipped so labels read across"
    subtitle="Ordered smallest to largest so the flip reads bottom-up"
    x="Squadron"
    y="Men"
  />
  <Inspect mode="exact" pin />
</GGPlot>
