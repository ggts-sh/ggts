<script lang="ts">
  import {
    GeomCount,
    GGPlot,
    Inspect,
    Labs,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  import { galtonHeights } from "./data.js";
</script>

<GGPlot
  data={galtonHeights}
  aes={{ x: "parent", y: "child" }}
  width={640}
  height={400}
>
  <GeomCount alpha={0.7} />
  <ThemeClassic />
  <Labs
    title="Overlapping points sized by how many share a cell"
    subtitle="Heights to the nearest inch"
    x="Mid-parent height (inches)"
    y="Child height (inches)"
    size="Children"
  />
  <Inspect mode="exact" pin />
</GGPlot>
