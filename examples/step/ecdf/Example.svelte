<script lang="ts">
  import {
    GeomPoint,
    GeomStep,
    GGPlot,
    Inspect,
    Labs,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  import { maizeDifferences } from "./data.js";
</script>

<GGPlot
  data={maizeDifferences}
  aes={{ x: "difference", y: "share" }}
  width={640}
  height={400}
>
  <GeomStep direction="hv" linewidth={1.8} />
  <GeomPoint size={2.6} alpha={0.85} />
  <ThemeClassic />
  <Labs
    title="Step ECDF of paired differences"
    subtitle="Cross-fertilised height minus self-fertilised"
    x="Cross-fertilised height less self-fertilised (inches)"
    y="Share of pairs at or below"
  />
  <Inspect mode="x" pin />
</GGPlot>
