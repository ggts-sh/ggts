<script lang="ts">
  import {
    CoordFixed,
    GeomSpoke,
    GGPlot,
    Inspect,
    Labs,
    ScaleXContinuous,
    ScaleYContinuous,
    ThemeMinimal,
  } from "@ggts-sh/svelte";

  import { rays } from "./data.js";
</script>

<GGPlot
  data={rays}
  aes={{ x: "x", y: "y", angle: "angle", radius: "radius" }}
  width={640}
  height={400}
>
  <GeomSpoke
    linewidth={3.2}
    lineend="round"
    alpha={1}
    aes={{ color: { value: "#1a202c" } }}
  />
  <CoordFixed />
  <ScaleXContinuous limits={[-5, 5]} />
  <ScaleYContinuous limits={[-5, 5]} />
  <ThemeMinimal />
  <Labs
    title="Eight rays from one origin"
    subtitle="Radius is length in data units"
    x="x"
    y="y"
  />
  <Inspect mode="xy" pin maxDistance={24} />
</GGPlot>
