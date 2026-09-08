<script lang="ts">
  import { GeomPoint, GGPlot } from "@ggts-sh/svelte";

  const rows = [
    { x: 1, y: 2, g: "a" },
    { x: 2, y: 4, g: "b" },
  ];
</script>

<GGPlot
  data={rows}
  aes={{ x: "x", y: "y", color: "g" }}
  coord="flip"
  scales={{ color: { scheme: "colorblind" } }}
>
  <GeomPoint />
</GGPlot>
