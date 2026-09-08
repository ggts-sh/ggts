<script lang="ts">
  import {
    GeomAbline,
    GeomPoint,
    GGPlot,
    Inspect,
    Labs,
    ThemeDark,
  } from "@ggts-sh/svelte";

  import { soporifics } from "./data.js";
</script>

<GGPlot
  data={soporifics}
  aes={{ x: "hyoscyamine", y: "hyoscine" }}
  width={640}
  height={400}
>
  <GeomAbline slope={1} intercept={0} linewidth={1.2} />
  <GeomPoint size={3.5} />
  <ThemeDark />
  <Labs
    title="Points against the identity line"
    subtitle="Ten of eleven patients improve more on one drug than the other"
    x="Extra sleep on L-hyoscyamine (hours)"
    y="Extra sleep on L-hyoscine (hours)"
  />
  <Inspect mode="xy" pin maxDistance={24} identity="patient" />
</GGPlot>
