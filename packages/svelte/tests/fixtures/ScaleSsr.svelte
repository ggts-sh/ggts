<script lang="ts">
  /**
   * SSR fixture: mark child + ScaleColorManual. Manual colors must land in
   * the first server pass (children register before registry-consuming markup).
   */
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import ScaleColorManual from "../../src/lib/scale/ScaleColorManual.svelte";

  const rows = [
    { x: 1, y: 2, c: "a" },
    { x: 2, y: 4, c: "b" },
  ];
</script>

<GGPlot
  data={rows}
  aes={{ x: "x", y: "y", color: "c" }}
  width={480}
  height={320}
>
  <GeomPoint size={3} />
  <ScaleColorManual values={["#ff0000", "#00ff00"]} />
</GGPlot>
