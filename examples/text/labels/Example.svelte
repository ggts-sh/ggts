<script lang="ts">
  import {
    GeomPoint,
    GeomText,
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
  <GeomText
    aes={{ label: "name", color: { value: "#1a202c" } }}
    anchor="middle"
    dy={-18}
    size={20}
  />
  <ScaleXContinuous limits={[18, 30]} />
  <ScaleYContinuous limits={[0.2, 3.8]} />
  <ThemeMinimal />
  <Labs
    title="Bare text labels"
    subtitle="Three short names — ink only, no box"
    x="Estimated longitude (°)"
    y="Order"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
