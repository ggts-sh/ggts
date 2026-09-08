<script lang="ts">
  import {
    GeomLine,
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    ScaleXContinuous,
    ThemeEconomist,
  } from "@ggts-sh/svelte";

  import { laborCostOfWheat } from "./data.js";
</script>

<GGPlot
  data={laborCostOfWheat}
  aes={{ x: "year", y: "weeks" }}
  width={640}
  height={400}
>
  <GeomLine linewidth={2} aes={{ color: { value: "#014d64" } }} />
  <GeomPoint size={1.6} aes={{ color: { value: "#014d64" } }} />
  <ScaleXContinuous
    breaks={[1600, 1650, 1700, 1750, 1800]}
    labels="d"
    nice={false}
  />
  <ThemeEconomist />
  <Labs
    title="Weeks of work for a quarter of wheat"
    subtitle="Wheat price ÷ weekly mechanic wage (~8 bushels)"
    x="Year"
    y="Weeks of work"
  />
  <Inspect mode="x" pin />
</GGPlot>
