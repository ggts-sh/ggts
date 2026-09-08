<script lang="ts">
  import {
    GeomLabel,
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    ScaleXContinuous,
    ScaleYContinuous,
    ThemeMinimal,
  } from "@ggts-sh/svelte";

  import { langrenLabels } from "./data.js";
</script>

<GGPlot
  data={langrenLabels}
  aes={{ x: "longitude", y: "rank" }}
  width={640}
  height={400}
>
  <GeomPoint size={4} alpha={0.5} aes={{ color: { value: "#4a5568" } }} />
  <GeomLabel
    aes={{
      label: "name",
      fill: { value: "#b8c9e0" },
      color: { value: "#0f172a" },
    }}
    anchor="middle"
    dy={-18}
    size={20}
    padding={7}
    radius={6}
    linewidth={2.2}
  />
  <ScaleXContinuous limits={[18, 30]} />
  <ScaleYContinuous limits={[0.2, 3.8]} />
  <ThemeMinimal />
  <Labs
    title="Boxed labels"
    subtitle="Same three names, each in a rounded box"
    x="Estimated longitude (°)"
    y="Order"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
