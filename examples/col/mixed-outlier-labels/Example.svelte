<script lang="ts">
  import { GeomCol, GGPlot, Inspect, Labs } from "@ggts-sh/svelte";

  import { filings } from "./data.js";
</script>

<!--
  640px width is intentional (#634): mixed short + one multi-word outlier must
  wrap at desktop width, not escalate to −90° + truncate.
-->
<GGPlot
  data={filings}
  aes={{ x: "category", y: "count" }}
  width={640}
  height={320}
>
  <GeomCol />
  <Labs
    title="One long label among short ones"
    subtitle="At a normal panel width the axis should wrap the outlier, not rotate every label"
    x="Category"
    y="Count"
  />
  <Inspect mode="exact" pin />
</GGPlot>
