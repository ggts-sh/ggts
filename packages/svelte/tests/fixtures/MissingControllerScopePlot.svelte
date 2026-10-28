<script lang="ts">
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";
  import { createPlotInteraction } from "../../src/lib/interaction/controller.svelte.js";

  const interaction = createPlotInteraction<string>();
</script>

<GGPlot
  data={[{ id: "a", x: 1, y: 2 }]}
  aes={{ x: "x", y: "y" }}
  layers={[{ geom: "point" }]}
  key="id"
  select="point"
  {interaction}
/>
