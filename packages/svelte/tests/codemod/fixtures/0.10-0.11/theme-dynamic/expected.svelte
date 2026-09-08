<script lang="ts">
  import { GeomPoint, GGPlot } from "@ggts-sh/svelte";
  import type { ThemeName } from "@ggts-sh/spec";

  const rows = [{ x: 1, y: 2 }];
  let current: ThemeName = $state("dark");
</script>

<GGPlot data={rows} aes={{ x: "x", y: "y" }} theme={current}>
  <GeomPoint />
</GGPlot>
