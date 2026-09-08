<script lang="ts">
  import { GeomCol, GGPlot, Labs, Legend } from "@ggts-sh/svelte";

  const rows = [{ q: "Q1", v: 10 }];
</script>

<GGPlot
  data={rows}
  aes={{ x: "q", y: "v" }}
>
  <Labs title="Sales" x="Quarter" />
  <Legend order="sorted" />
  <GeomCol />
</GGPlot>
