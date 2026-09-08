<script lang="ts">
  import {
    GeomBlank,
    GGPlot,
    Labs,
    ScaleXContinuous,
    ScaleYContinuous,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  import { halleyFrame } from "./data.js";
</script>

<GGPlot
  data={halleyFrame}
  aes={{ x: "age", y: "survivors" }}
  width={640}
  height={400}
>
  <GeomBlank />
  <ScaleXContinuous breaks={[1, 10, 20, 30, 40, 50, 60, 70, 80]} nice={false} />
  <ScaleYContinuous breaks={[0, 200, 400, 600, 800, 1000]} />
  <ThemeClassic />
  <Labs
    title="Axes without marks"
    subtitle="The trained frame alone, before any geometry is drawn"
    x="Age"
    y="Surviving"
  />
</GGPlot>
