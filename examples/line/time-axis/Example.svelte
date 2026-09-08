<script lang="ts">
  import {
    GeomLine,
    GGPlot,
    Inspect,
    Labs,
    ThemeFivethirtyeight,
  } from "@ggts-sh/svelte";

  import { britishExports } from "./data.js";
</script>

<GGPlot
  data={britishExports}
  aes={{ x: "year", y: "value" }}
  width="container"
  height={400}
>
  <GeomLine linewidth={1.5} />
  <ThemeFivethirtyeight />
  <Labs
    title="Years inferred from raw four-digit strings"
    subtitle="Export totals over time without pre-parsing dates in the table"
    x="Year"
    y="£ millions"
  />
  <Inspect mode="x" pin />
</GGPlot>
