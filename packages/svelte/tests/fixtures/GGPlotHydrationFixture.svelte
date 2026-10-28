<script lang="ts">
  import { onMount } from "svelte";

  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";

  const rows = [
    { id: "a", x: 1, y: 2 },
    { id: "b", x: 2, y: 4 },
  ];

  let hydrated = $state(false);
  let phase = $state("none");

  onMount(() => {
    hydrated = true;
  });
</script>

<section
  data-ggplot-hydration-fixture
  data-hydrated={String(hydrated)}
  data-last-phase={phase}
>
  <GGPlot
    data={rows}
    aes={{ x: "x", y: "y" }}
    layers={[{ geom: "point" }]}
    key="id"
    inspect
    ariaLabel="Hydrated scatter plot"
    width={480}
    height={320}
    oninspect={(event) => (phase = event.phase)}
  />
</section>
