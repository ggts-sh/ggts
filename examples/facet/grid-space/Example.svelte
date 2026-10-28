<script lang="ts">
  import {
    FacetGrid,
    GeomHline,
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    ScaleYContinuous,
    ThemeMinimal,
  } from "@ggts-sh/svelte";

  import { meanHwy, mpg } from "./data.js";
</script>

<GGPlot data={mpg} aes={{ x: "class", y: "hwy" }} width={640} height={400}>
  <GeomPoint size={2.2} alpha={0.45} />
  <GeomHline yintercept={meanHwy} linetype="dashed" />
  <FacetGrid
    cols={{
      field: "drv",
      levels: ["f", "r", "4"],
      labels: {
        f: "Front-wheel drive",
        r: "Rear-wheel drive",
        "4": "Four-wheel drive",
      },
    }}
    scales="free_x"
    space="free_x"
  />
  <ScaleYContinuous
    breaks={[10, 20, meanHwy, 30, 40]}
    labels={["10", "20", `mean ${meanHwy.toFixed(1)}`, "30", "40"]}
  />
  <ThemeMinimal />
  <Labs
    title="Grid facets sized by category count"
    subtitle="Highway fuel economy of 234 cars by class; the dashed line is the mean"
    x="Vehicle class"
    y="Highway miles per gallon"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
