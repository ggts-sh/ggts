<script lang="ts">
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";

  const rows = [
    { id: "a", x: 1, y: 2 },
    { id: "b", x: 2, y: 4 },
  ];
</script>

<GGPlot
  data={rows}
  aes={{ x: "x", y: "y" }}
  layers={[{ geom: "point" }]}
  key="id"
  inspect={{ contentMode: "interactive" }}
  ariaLabel="First interactive chart"
  width={480}
  height={320}
/>

<GGPlot
  data={rows}
  aes={{ x: "x", y: "y" }}
  layers={[{ geom: "point" }]}
  key="id"
  inspect={{ contentMode: "interactive" }}
  ariaLabel="Second interactive chart"
  width={480}
  height={320}
/>
