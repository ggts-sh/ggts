<script lang="ts">
  import { GeomCol, GGPlot } from "@ggts-sh/svelte";

  const rows = [{ q: "Q1", v: 10 }];
</script>

<GGPlot
  data={rows}
  aes={{ x: "q", y: "v" }}
  labs={{ title: "Sales", x: "Quarter" }}
  legend={{ order: "sorted" }}
>
  <GeomCol />
</GGPlot>
