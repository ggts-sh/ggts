<script lang="ts">
  /**
   * Seam C fixture (#1420): smooth marks rendered with NO registerAll anywhere
   * in the module graph — the GeomSmooth import alone must register the
   * smooth stat + geom batches.
   */
  import GeomSmooth from "../../src/lib/geoms/GeomSmooth.svelte";
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";

  const data = [
    { x: 1, y: 10 },
    { x: 2, y: 20 },
    { x: 3, y: 15 },
    { x: 4, y: 25 },
    { x: 5, y: 22 },
  ];
</script>

<GGPlot {data} aes={{ x: "x", y: "y" }} width={480} height={320}>
  <GeomSmooth method="lm" />
</GGPlot>
