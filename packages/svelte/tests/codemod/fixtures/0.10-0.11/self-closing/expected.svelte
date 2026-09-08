<script lang="ts">
  import { GGPlot, Theme } from "@ggts-sh/svelte";

  const spec = { layers: [{ geom: "point" as const }] };
</script>

<GGPlot {spec}>
  <Theme name="tufte" />
</GGPlot>
