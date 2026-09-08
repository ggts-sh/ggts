<script lang="ts">
  import {
    GeomJitter,
    GGPlot,
    Inspect,
    Labs,
    ScaleXDiscrete,
    ScaleYContinuous,
    ThemeMinimal,
  } from "@ggts-sh/svelte";

  import { sparseGroups } from "./data.js";
</script>

<GGPlot
  data={sparseGroups}
  aes={{ x: "group", y: "value" }}
  width={640}
  height={400}
>
  <GeomJitter
    width={0.35}
    height={0}
    seed={7}
    size={6.5}
    alpha={0.9}
    aes={{ color: { value: "#1a202c" } }}
  />
  <ScaleXDiscrete domain={["A", "B", "C"]} />
  <ScaleYContinuous limits={[0, 10]} />
  <ThemeMinimal />
  <Labs
    title="Jittered points by group"
    subtitle="Sideways jitter unstacks points"
    x="Group"
    y="Value"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
