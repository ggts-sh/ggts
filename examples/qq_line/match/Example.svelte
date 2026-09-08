<script lang="ts">
  import {
    GeomQqLine,
    GGPlot,
    Inspect,
    Labs,
    ThemeMinimal,
  } from "@ggts-sh/svelte";

  import { shortSample } from "./data.js";
</script>

<GGPlot data={shortSample} aes={{ sample: "value" }} width={640} height={400}>
  <GeomQqLine linewidth={3.2} alpha={1} aes={{ color: { value: "#1a202c" } }} />
  <ThemeMinimal />
  <Labs
    title="Q–Q reference line"
    subtitle="Line through the sample/theoretical quartile match"
    x="Theoretical quantile"
    y="Sample quantile"
  />
  <Inspect mode="x" pin />
</GGPlot>
