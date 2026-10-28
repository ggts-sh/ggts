<script lang="ts">
  import GeomPoint from "../../src/lib/geoms/GeomPoint.svelte";
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";

  const cars = [
    { weight: 1.8, economy: 37 },
    { weight: 2.4, economy: 31 },
    { weight: 3.1, economy: 25 },
    { weight: 4.0, economy: 19 },
  ];
</script>

<GGPlot
  data={cars}
  aes={{ x: "weight", y: "economy" }}
  ariaLabel="Fuel economy decreases as vehicle weight increases"
>
  <GeomPoint />
</GGPlot>
