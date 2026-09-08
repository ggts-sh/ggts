<script lang="ts">
  import { GeomCol, GGPlot, Inspect, Labs } from "@ggts-sh/svelte";

  import { filings } from "./data.js";
</script>

<!--
  480px width is intentional (#406): band label planner escalates wrap→rotate
  for long Spanish multi-word and German single-token categories.
-->
<GGPlot
  data={filings}
  aes={{ x: "category", y: "count" }}
  width={480}
  height={420}
>
  <GeomCol />
  <Labs
    title="Long category labels at a narrow width"
    subtitle="The band axis has to wrap and rotate to fit these names at 480px"
    x="Category"
    y="Count"
  />
  <Inspect mode="exact" pin />
</GGPlot>
