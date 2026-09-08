<script lang="ts">
  import { GGPlot } from "@ggts-sh/svelte";

  const spec = { layers: [{ geom: "point" as const }] };
</script>

<GGPlot {spec} theme="tufte" />
