<script lang="ts">
  import {
    GeomLine,
    GeomRect,
    GGPlot,
    Inspect,
    Labs,
    ScaleFillDiscrete,
    ScaleXContinuous,
    ThemeEconomist,
  } from "@ggts-sh/svelte";

  import { reigns, wheatPrices } from "./data.js";
</script>

<GGPlot data={reigns} width={640} height={400}>
  <GeomRect
    aes={{
      xmin: "start",
      xmax: "end",
      ymin: "ymin",
      ymax: "ymax",
      fill: "rule",
      color: { value: "#ffffff" },
    }}
    alpha={0.55}
    linewidth={1}
  />
  <GeomLine
    data={wheatPrices}
    aes={{ x: "year", y: "shillings", color: { value: "#1a1a1a" } }}
    linewidth={2}
  />
  <ScaleXContinuous labels="d" />
  <ScaleFillDiscrete domain={["Monarchy", "Commonwealth"]} scheme="few_light" />
  <ThemeEconomist />
  <Labs
    title="Background rectangles for eras"
    subtitle="Wheat prices with a band for each reign that covered those years"
    x="Year"
    y="Shillings per quarter"
    fill=""
  />
  <Inspect mode="x" pin />
</GGPlot>
