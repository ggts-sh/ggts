<script lang="ts">
  /**
   * SSR fixture: mark child + ThemeDark. Theme must land in the first server
   * pass (children register before registry-consuming markup).
   */
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import ThemeDark from "../../src/lib/theme/ThemeDark.svelte";

  const rows = [
    { x: 1, y: 2 },
    { x: 2, y: 4 },
  ];
</script>

<GGPlot data={rows} aes={{ x: "x", y: "y" }} width={480} height={320}>
  <GeomPoint size={3} />
  <ThemeDark />
</GGPlot>
