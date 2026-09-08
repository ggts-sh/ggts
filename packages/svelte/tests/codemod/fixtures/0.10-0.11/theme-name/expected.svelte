<script lang="ts">
  import { GeomPoint, GGPlot, Theme } from "@ggts-sh/svelte";

  const rows = [{ x: 1, y: 2 }];
</script>

<GGPlot data={rows} aes={{ x: "x", y: "y" }}>
  <Theme name="dark" />
  <GeomPoint />
</GGPlot>
