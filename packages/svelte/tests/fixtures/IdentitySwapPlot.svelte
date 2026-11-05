<script lang="ts">
  /** Stable data and aes, so a change of row identity keeps the same render model. */
  import GGPlot from "../../src/lib/GGPlot.svelte";
  import "../../src/lib/host-init.js";
  import GeomSmooth from "../../src/lib/geoms/GeomSmooth.svelte";
  import Inspect from "../../src/lib/inspection/Inspect.svelte";

  type Route = "key" | "inspect" | "child";
  const {
    route,
    onrender,
    oninspect,
  }: { route: Route; onrender: (model: unknown) => void; oninspect: (event: unknown) => void } =
    $props();
  const data = Array.from({ length: 50 }, (_, index) => ({
    id: `r${index}`,
    name: `n${index}`,
    x: index,
    y: index * 0.5 + (index % 7),
  }));
  const aes = { x: "x", y: "y" };
  let identity = $state("id");
</script>

<button type="button" data-swap onclick={() => (identity = "name")}>Swap</button>
{#if route === "key"}
  <GGPlot
    {data}
    {aes}
    key={identity}
    inspect={{ mode: "x" }}
    width={480}
    height={320}
    {onrender}
    {oninspect}
  >
    <GeomSmooth method="lm" />
  </GGPlot>
{:else if route === "inspect"}
  <GGPlot
    {data}
    {aes}
    inspect={{ mode: "x", identity }}
    width={480}
    height={320}
    {onrender}
    {oninspect}
  >
    <GeomSmooth method="lm" />
  </GGPlot>
{:else}
  <GGPlot {data} {aes} width={480} height={320} {onrender} {oninspect}>
    <GeomSmooth method="lm" />
    <Inspect mode="x" {identity} />
  </GGPlot>
{/if}
