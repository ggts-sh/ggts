<script lang="ts">
  /**
   * SSR fixture: mark child + labs plot layer. Labs title is observable in
   * the first server pass (aria-label) only when children register before
   * registry-consuming markup (ADR 0001 finding 1).
   */
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import PlotLayerChild from "./PlotLayerChild.svelte";

  const rows = [
    { x: 1, y: 2 },
    { x: 2, y: 4 },
  ];
</script>

<GGPlot data={rows} aes={{ x: "x", y: "y" }} width={480} height={320}>
  <GeomPoint size={3} />
  <PlotLayerChild kind="labs" value={{ title: "ssr-plot-layer-title" }} />
</GGPlot>
