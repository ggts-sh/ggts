<script lang="ts">
  import { GeomPoint, GGPlot } from "@ggts-sh/svelte";

  const rows = [{ x: 1, y: 2 }];
</script>

<GGPlot data={rows} aes={{ x: "x", y: "y" }} theme="dark">
  <GeomPoint />
</GGPlot>
