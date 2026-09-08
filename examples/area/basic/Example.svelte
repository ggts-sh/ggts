<script lang="ts">
  import {
    GeomArea,
    GeomLine,
    GGPlot,
    Inspect,
    Labs,
    ScaleXContinuous,
    ScaleYContinuous,
    ThemeClassic,
  } from "@ggts-sh/svelte";

  import { halleyLifeTable } from "./data.js";
</script>

<GGPlot
  data={halleyLifeTable}
  aes={{ x: "age", y: "survivors" }}
  width={640}
  height={400}
>
  <GeomArea alpha={0.7} />
  <GeomLine linewidth={1.5} />
  <ScaleXContinuous breaks={[1, 10, 20, 30, 40, 50, 60, 70, 80]} nice={false} />
  <ScaleYContinuous breaks={[0, 200, 400, 600, 800, 1000]} />
  <ThemeClassic />
  <Labs
    title="Survivors from a cohort of one thousand"
    subtitle="Filled area under a life table from birth to old age"
    x="Age"
    y="Surviving"
  />
  <Inspect mode="x" pin />
</GGPlot>
